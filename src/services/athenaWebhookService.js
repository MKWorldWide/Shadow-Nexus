const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { Webhook, Server } = require('../models');
const athenaLogger = require('./athenaLogger');
const logger = require('../utils/logger')('athena:webhook');

class AthenaWebhookService {
  constructor() {
    this.app = express();
    this.port = process.env.ATHENA_WEBHOOK_PORT || 3001;
    this.secret = process.env.ATHENA_WEBHOOK_SECRET;
    
    // Middleware
    this.app.use(bodyParser.json({ verify: this.verifyRequestSignature.bind(this) }));
    
    // Routes
    this.app.post('/webhook/athena', this.handleWebhook.bind(this));
    this.app.get('/health', (req, res) => res.status(200).send('OK'));
    
    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }
  
  /**
   * Verify the request signature for security
   */
  verifyRequestSignature(req, res, buf, encoding) {
    if (!this.secret) return; // Skip if no secret is configured
    
    const signature = req.headers['x-athena-signature'];
    if (!signature) {
      throw new Error('Missing X-Athena-Signature header');
    }
    
    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = hmac.update(buf).digest('hex');
    
    if (signature !== `sha256=${digest}`) {
      throw new Error('Invalid request signature');
    }
  }
  
  /**
   * Handle incoming webhook requests
   */
  async handleWebhook(req, res) {
    try {
      const { event, data, metadata = {} } = req.body;
      
      if (!event) {
        return res.status(400).json({ error: 'Missing event type' });
      }
      
      // Log the incoming webhook for debugging
      logger.debug(`Received webhook event: ${event}`, { 
        event,
        sourceIp: req.ip,
        userAgent: req.get('user-agent'),
        metadata,
      });
      
      // Process the event
      await this.processEvent(event, data, metadata);
      
      res.status(200).json({ status: 'success' });
    } catch (error) {
      logger.error('Error processing webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
  
  /**
   * Process different types of events
   */
  async processEvent(event, data, metadata) {
    const eventHandlers = {
      'log': this.handleLogEvent.bind(this),
      'status': this.handleStatusEvent.bind(this),
      'alert': this.handleAlertEvent.bind(this),
      'heartbeat': this.handleHeartbeatEvent.bind(this),
      // Add more event types as needed
    };
    
    const handler = eventHandlers[event] || this.handleUnknownEvent.bind(this);
    return handler(data, metadata);
  }
  
  /**
   * Handle log events
   */
  async handleLogEvent(data, metadata) {
    const { 
      level = 'info',
      source = 'unknown',
      title,
      message,
      data: logData = {},
      tags = [],
      relatedTo,
      context = {},
    } = data;
    
    // Add metadata to context
    const fullContext = {
      ...context,
      webhookSource: metadata.source,
      webhookEventId: metadata.eventId,
      webhookTimestamp: metadata.timestamp,
    };
    
    // Forward to our logger
    return athenaLogger.log({
      level,
      source,
      title,
      message,
      data: logData,
      tags: [...new Set([...tags, 'webhook', 'athena'])],
      relatedTo,
      context: fullContext,
      broadcast: true,
    });
  }
  
  /**
   * Handle status events
   */
  async handleStatusEvent(data, metadata) {
    const { 
      service, 
      status, 
      message, 
      metrics = {},
      timestamp = new Date().toISOString() 
    } = data;
    
    // Log the status update
    return athenaLogger.log({
      level: 'info',
      source: `status:${service}`,
      title: `Service Status: ${service} - ${status.toUpperCase()}`,
      message: message || `Status update for ${service}`,
      data: metrics,
      tags: ['status', 'heartbeat', service],
      context: {
        ...metadata,
        status,
        timestamp,
      },
      broadcast: true,
    });
  }
  
  /**
   * Handle alert events
   */
  async handleAlertEvent(data, metadata) {
    const { 
      severity = 'warning',
      title,
      message,
      condition,
      value,
      threshold,
      timestamp = new Date().toISOString(),
    } = data;
    
    // Convert alert severity to log level
    const levelMap = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };
    
    const logLevel = levelMap[severity] || 'warning';
    
    return athenaLogger.log({
      level: logLevel,
      source: 'athena:alert',
      title: `ALERT: ${title}`,
      message: [
        message,
        condition && `Condition: ${condition}`,
        value !== undefined && `Value: ${value}`,
        threshold !== undefined && `Threshold: ${threshold}`,
      ].filter(Boolean).join('\n'),
      data: {
        condition,
        value,
        threshold,
        ...(data.data || {}),
      },
      tags: ['alert', severity, ...(data.tags || [])],
      context: {
        ...metadata,
        timestamp,
      },
      broadcast: true,
    });
  }
  
  /**
   * Handle heartbeat/ping events
   */
  async handleHeartbeatEvent(data, metadata) {
    const { 
      service, 
      timestamp = new Date().toISOString(),
      uptime,
      version,
    } = data;
    
    return athenaLogger.log({
      level: 'info',
      source: `heartbeat:${service || 'unknown'}`,
      title: `Heartbeat from ${service || 'unknown service'}`,
      message: 'Service is alive and responding',
      data: {
        uptime,
        version,
        timestamp,
      },
      tags: ['heartbeat', 'monitoring'],
      context: metadata,
      broadcast: false, // Don't spam channels with heartbeats
    });
  }
  
  /**
   * Handle unknown event types
   */
  async handleUnknownEvent(data, metadata) {
    logger.warn('Received unknown event type', { 
      data,
      metadata,
    });
    
    return athenaLogger.log({
      level: 'warning',
      source: 'athena:webhook',
      title: 'Unknown Webhook Event Received',
      message: 'An unhandled webhook event was received',
      data: {
        rawData: data,
      },
      tags: ['webhook', 'unhandled'],
      context: metadata,
      broadcast: true,
    });
  }
  
  /**
   * Error handling middleware
   */
  errorHandler(err, req, res, next) {
    logger.error('Webhook error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      headers: req.headers,
    });
    
    if (res.headersSent) {
      return next(err);
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
  
  /**
   * Start the webhook server
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Athena webhook service listening on port ${this.port}`);
        resolve();
      }).on('error', (err) => {
        logger.error('Failed to start webhook server:', err);
        reject(err);
      });
    });
  }
  
  /**
   * Stop the webhook server
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      
      this.server.close((err) => {
        if (err) {
          logger.error('Error stopping webhook server:', err);
          return reject(err);
        }
        
        logger.info('Webhook server stopped');
        this.server = null;
        resolve();
      });
    });
  }
}

// Create a singleton instance
const athenaWebhookService = new AthenaWebhookService();

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down webhook server...');
  await athenaWebhookService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down webhook server...');
  await athenaWebhookService.stop();
  process.exit(0);
});

module.exports = athenaWebhookService;
