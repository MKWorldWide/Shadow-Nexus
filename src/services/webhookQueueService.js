const { WebhookClient } = require('discord.js');
const logger = require('../utils/logger')('webhook-queue');

class WebhookQueueService {
  constructor() {
    this.queues = new Map(); // webhookId -> { queue: [], isProcessing: boolean }
    this.rateLimits = new Map(); // webhookId -> { remaining: number, resetAt: number }
    this.DEFAULT_RATE_LIMIT = { remaining: 5, resetAt: 0 }; // 5 requests per 2 seconds
  }

  /**
   * Add a message to the queue for a specific webhook
   * @param {string} webhookId - The webhook ID
   * @param {Object} message - The message to send
   * @param {string} [webhookUrl] - The webhook URL (required for first message)
   * @returns {Promise<Object>} - The result of sending the message
   */
  async enqueue(webhookId, message, webhookUrl) {
    if (!this.queues.has(webhookId)) {
      if (!webhookUrl) {
        throw new Error('webhookUrl is required for new webhook queues');
      }
      this.queues.set(webhookId, {
        queue: [],
        isProcessing: false,
        webhookUrl,
      });
      this.rateLimits.set(webhookId, { ...this.DEFAULT_RATE_LIMIT });
    }

    const queue = this.queues.get(webhookId);
    
    return new Promise((resolve, reject) => {
      queue.queue.push({ message, resolve, reject });
      this.processQueue(webhookId);
    });
  }

  /**
   * Process messages in the queue for a specific webhook
   * @param {string} webhookId - The webhook ID to process
   */
  async processQueue(webhookId) {
    const queue = this.queues.get(webhookId);
    if (!queue || queue.isProcessing || queue.queue.length === 0) {
      return;
    }

    queue.isProcessing = true;
    const rateLimit = this.rateLimits.get(webhookId) || { ...this.DEFAULT_RATE_LIMIT };
    
    try {
      // Check rate limit
      const now = Date.now();
      if (rateLimit.resetAt <= now) {
        // Reset rate limit if the window has passed
        rateLimit.remaining = this.DEFAULT_RATE_LIMIT.remaining;
        rateLimit.resetAt = now + 2000; // 2 second window
      }

      if (rateLimit.remaining <= 0) {
        // Wait until the rate limit resets
        const waitTime = rateLimit.resetAt - now;
        logger.debug(`Rate limit reached for webhook ${webhookId}, waiting ${waitTime}ms`);
        
        setTimeout(() => this.processQueue(webhookId), waitTime);
        return;
      }

      // Get messages to batch (up to 10 embeds per message)
      const batch = [];
      let embedCount = 0;
      
      while (queue.queue.length > 0 && embedCount < 10) {
        const nextMessage = queue.queue[0];
        const messageEmbeds = Array.isArray(nextMessage.message.embeds) 
          ? nextMessage.message.embeds 
          : (nextMessage.message.embeds ? [nextMessage.message.embeds] : []);
        
        if (embedCount + messageEmbeds.length > 10) {
          break; // Don't exceed 10 embeds per message
        }
        
        batch.push(queue.queue.shift());
        embedCount += messageEmbeds.length;
      }

      if (batch.length === 0) {
        queue.isProcessing = false;
        return;
      }

      // Combine messages in the batch
      const combinedMessage = this.combineMessages(batch.map(item => item.message));
      
      // Send the batch
      rateLimit.remaining--;
      const webhook = new WebhookClient({ url: queue.webhookUrl });
      
      try {
        const result = await webhook.send(combinedMessage);
        logger.debug(`Sent batch of ${batch.length} messages to webhook ${webhookId}`);
        
        // Resolve all promises in the batch
        batch.forEach(item => item.resolve({
          success: true,
          result,
          batchSize: batch.length
        }));
      } catch (error) {
        logger.error(`Error sending batch to webhook ${webhookId}:`, error);
        
        // Reject all promises in the batch with the error
        batch.forEach(item => item.reject(error));
      } finally {
        // Continue processing the queue
        queue.isProcessing = false;
        setImmediate(() => this.processQueue(webhookId));
      }
    } catch (error) {
      logger.error(`Error in queue processing for webhook ${webhookId}:`, error);
      queue.isProcessing = false;
    }
  }

  /**
   * Combine multiple messages into a single message
   * @param {Array<Object>} messages - Array of message objects
   * @returns {Object} Combined message object
   */
  combineMessages(messages) {
    if (messages.length === 1) {
      return messages[0];
    }

    // Combine embeds if present
    const embeds = [];
    let content = '';
    let username = null;
    let avatarURL = null;
    
    for (const msg of messages) {
      if (msg.embeds) {
        const msgEmbeds = Array.isArray(msg.embeds) ? msg.embeds : [msg.embeds];
        embeds.push(...msgEmbeds);
      }
      
      if (msg.content) {
        content += (content ? '\n\n' : '') + msg.content;
      }
      
      if (!username && msg.username) username = msg.username;
      if (!avatarURL && msg.avatarURL) avatarURL = msg.avatarURL;
    }

    return {
      content: content || undefined,
      embeds: embeds.length > 0 ? embeds : undefined,
      username: username || undefined,
      avatarURL: avatarURL || undefined,
    };
  }

  /**
   * Update rate limit information from headers
   * @param {string} webhookId - The webhook ID
   * @param {Object} headers - Response headers
   */
  updateRateLimitFromHeaders(webhookId, headers) {
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    const resetAfter = parseFloat(headers['x-ratelimit-reset-after']) * 1000; // Convert to ms
    
    if (!isNaN(remaining) && !isNaN(resetAfter)) {
      this.rateLimits.set(webhookId, {
        remaining,
        resetAt: Date.now() + resetAfter,
      });
    }
  }

  /**
   * Clear the queue for a specific webhook
   * @param {string} webhookId - The webhook ID
   */
  clearQueue(webhookId) {
    const queue = this.queues.get(webhookId);
    if (queue) {
      queue.queue = [];
    }
  }
}

module.exports = new WebhookQueueService();
