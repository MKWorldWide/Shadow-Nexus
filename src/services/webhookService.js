const axios = require('axios');
const crypto = require('crypto');
const { Webhook, Server } = require('../models');
const logger = require('./logger')('webhook');

class WebhookService {
  constructor() {
    this.axios = axios.create({
      timeout: 10000, // 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShadowNexus/1.0 (+https://github.com/MKWorldWide/Shadow-Nexus)'
      }
    });
  }

  /**
   * Send a message to a webhook
   * @param {string} webhookId - ID of the webhook to send to
   * @param {Object} payload - The payload to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The response data
   */
  async send(webhookId, payload, options = {}) {
    const webhook = await Webhook.findByPk(webhookId);
    if (!webhook) {
      throw new Error(`Webhook with ID ${webhookId} not found`);
    }

    if (!webhook.is_active) {
      throw new Error(`Webhook ${webhook.name} is not active`);
    }

    const { wait = false, threadId = null } = options;
    let url = webhook.url;

    // Add thread ID to URL if provided
    if (threadId) {
      const separator = webhook.url.includes('?') ? '&' : '?';
      url = `${webhook.url}${separator}thread_id=${threadId}&wait=${wait}`;
    } else if (wait) {
      const separator = webhook.url.includes('?') ? '&' : '?';
      url = `${webhook.url}${separator}wait=true`;
    }

    // Add signature if secret is set
    const headers = {};
    if (webhook.secret) {
      const timestamp = Date.now();
      const signature = this._createSignature(webhook.secret, payload, timestamp);
      
      headers['X-Signature'] = signature;
      headers['X-Timestamp'] = timestamp;
    }

    try {
      const response = await this.axios.post(url, payload, { headers });
      
      // Update last used timestamp
      webhook.last_used_at = new Date();
      await webhook.save();
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url
        }
      };
    } catch (error) {
      logger.error(`Error sending to webhook ${webhook.name} (${webhook.id}):`, error);
      
      return {
        success: false,
        status: error.response?.status || 500,
        error: error.message,
        webhook: {
          id: webhook.id,
          name: webhook.name,
          url: webhook.url
        }
      };
    }
  }

  /**
   * Broadcast a message to multiple webhooks
   * @param {string[]} webhookIds - Array of webhook IDs
   * @param {Object} payload - The payload to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Results of all webhook sends
   */
  async broadcast(webhookIds, payload, options = {}) {
    const results = await Promise.all(
      webhookIds.map(id => 
        this.send(id, payload, options)
          .catch(error => ({
            success: false,
            error: error.message,
            webhook: { id }
          }))
      )
    );

    const success = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      total: results.length,
      success: success.length,
      failed: failed.length,
      results,
      successResults: success,
      failedResults: failed
    };
  }

  /**
   * Broadcast to webhooks by tags
   * @param {string[]} tags - Array of tags to match
   * @param {Object} payload - The payload to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Results of all webhook sends
   */
  async broadcastByTags(tags, payload, options = {}) {
    const webhooks = await Webhook.findAll({
      where: {
        is_active: true,
        tags: {
          [Sequelize.Op.overlap]: tags
        }
      }
    });

    return this.broadcast(
      webhooks.map(w => w.id),
      payload,
      options
    );
  }

  /**
   * Create a signature for webhook verification
   * @private
   */
  _createSignature(secret, payload, timestamp) {
    const hmac = crypto.createHmac('sha256', secret);
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return hmac.update(data).digest('hex');
  }

  /**
   * Verify a webhook signature
   * @param {string} secret - The webhook secret
   * @param {string} signature - The signature to verify
   * @param {Object} payload - The payload that was signed
   * @param {number} timestamp - The timestamp when the signature was created
   * @param {number} tolerance - Maximum age of the signature in milliseconds
   * @returns {boolean} - Whether the signature is valid
   */
  verifySignature(secret, signature, payload, timestamp, tolerance = 300000) {
    // Check if timestamp is within tolerance (default 5 minutes)
    const now = Date.now();
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    const expectedSignature = this._createSignature(secret, payload, timestamp);
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Test a webhook URL
   * @param {string} url - The webhook URL to test
   * @returns {Promise<Object>} - Test results
   */
  async testWebhook(url) {
    const testPayload = {
      content: '🔍 Shadow Nexus Webhook Test',
      embeds: [{
        title: 'Webhook Test Successful',
        description: 'This webhook is properly configured and ready to receive messages from Shadow Nexus.',
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Shadow Nexus Webhook Test',
          icon_url: 'https://i.imgur.com/example.png'
        }
      }]
    };

    try {
      const response = await this.axios.post(url, testPayload);
      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: error.message,
        response: error.response?.data
      };
    }
  }
}

module.exports = new WebhookService();
