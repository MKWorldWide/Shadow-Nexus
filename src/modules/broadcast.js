const { Collection } = require('discord.js');
const { Webhook } = require('../models');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger')('broadcast');

class BroadcastService {
  constructor() {
    this.activeBroadcasts = new Collection();
  }

  /**
   * Broadcast a message to multiple webhooks
   * @param {Object} options - Broadcast options
   * @param {string} options.message - The message to broadcast
   * @param {Array<string>} [options.tags] - Filter webhooks by tags
   * @param {Array<string>} [options.webhookIds] - Specific webhook IDs to send to
   * @param {string} [options.username] - Override the webhook username
   * @param {string} [options.avatarURL] - Override the webhook avatar URL
   * @param {boolean} [options.tts=false] - Whether to use text-to-speech
   * @param {string} [options.fileURL] - URL of a file to send with the message
   * @param {string} [options.guildId] - The guild ID to filter webhooks by
   * @returns {Promise<Object>} - Results of the broadcast
   */
  async broadcastMessage({
    message,
    tags = [],
    webhookIds = [],
    username,
    avatarURL,
    tts = false,
    fileURL,
    guildId
  } = {}) {
    if (!message) {
      throw new Error('Message is required');
    }

    // Build the where clause
    const where = { is_active: true };
    
    if (guildId) {
      where.server_id = guildId;
    }
    
    if (tags && tags.length > 0) {
      where.tags = {
        [this.sequelize.Op.overlap]: tags
      };
    }
    
    if (webhookIds && webhookIds.length > 0) {
      where.id = {
        [this.sequelize.Op.in]: webhookIds
      };
    }

    // Find matching webhooks
    const webhooks = await Webhook.findAll({ where });
    
    if (webhooks.length === 0) {
      return {
        success: false,
        message: 'No matching webhooks found',
        results: []
      };
    }

    // Create broadcast ID
    const broadcastId = this.generateBroadcastId();
    const results = [];
    
    // Store broadcast in active broadcasts
    this.activeBroadcasts.set(broadcastId, {
      startTime: new Date(),
      total: webhooks.length,
      completed: 0,
      failed: 0,
      results: []
    });

    // Send to each webhook
    const promises = webhooks.map(async (webhook) => {
      const result = {
        webhookId: webhook.id,
        webhookName: webhook.name,
        success: false,
        status: 'pending',
        error: null,
        response: null
      };

      try {
        // Build the payload
        const payload = {
          content: message,
          username: username || webhook.username || undefined,
          avatar_url: avatarURL || webhook.avatar_url || undefined,
          tts: tts || false
        };

        // Add file if provided
        if (fileURL) {
          payload.file = { url: fileURL };
        }

        // Send the webhook
        const response = await webhookService.send(webhook.id, payload);
        
        // Update webhook last used timestamp
        webhook.last_used_at = new Date();
        await webhook.save();
        
        // Update result
        result.success = true;
        result.status = 'success';
        result.response = {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        };
        
        // Update broadcast stats
        const broadcast = this.activeBroadcasts.get(broadcastId);
        broadcast.completed++;
        broadcast.results.push(result);
        
      } catch (error) {
        // Update result with error
        result.success = false;
        result.status = 'failed';
        result.error = {
          message: error.message,
          code: error.code,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : null
        };
        
        // Update broadcast stats
        const broadcast = this.activeBroadcasts.get(broadcastId);
        broadcast.failed++;
        broadcast.results.push(result);
        
        logger.error(`Error broadcasting to webhook ${webhook.id}:`, error);
      }
      
      results.push(result);
      return result;
    });
    
    // Wait for all webhooks to complete
    await Promise.all(promises);
    
    // Clean up completed broadcast
    const broadcast = this.activeBroadcasts.get(broadcastId);
    broadcast.endTime = new Date();
    broadcast.duration = broadcast.endTime - broadcast.startTime;
    
    // Remove from active broadcasts after a delay
    setTimeout(() => {
      this.activeBroadcasts.delete(broadcastId);
    }, 5 * 60 * 1000); // 5 minutes
    
    return {
      success: true,
      message: `Broadcast completed: ${broadcast.completed} succeeded, ${broadcast.failed} failed`,
      broadcastId,
      results
    };
  }
  
  /**
   * Get the status of an active broadcast
   * @param {string} broadcastId - The broadcast ID
   * @returns {Object} - Broadcast status
   */
  getBroadcastStatus(broadcastId) {
    const broadcast = this.activeBroadcasts.get(broadcastId);
    
    if (!broadcast) {
      return {
        exists: false,
        message: 'Broadcast not found or has expired'
      };
    }
    
    const progress = (broadcast.completed + broadcast.failed) / broadcast.total * 100;
    
    return {
      exists: true,
      broadcastId,
      startTime: broadcast.startTime,
      duration: new Date() - broadcast.startTime,
      total: broadcast.total,
      completed: broadcast.completed,
      failed: broadcast.failed,
      progress: Math.min(100, Math.round(progress * 100) / 100), // Round to 2 decimal places
      results: broadcast.results
    };
  }
  
  /**
   * Generate a unique broadcast ID
   * @private
   * @returns {string} - A unique broadcast ID
   */
  generateBroadcastId() {
    return `bcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get all active broadcasts
   * @returns {Array<Object>} - List of active broadcasts
   */
  getActiveBroadcasts() {
    return Array.from(this.activeBroadcasts.entries()).map(([id, data]) => ({
      id,
      ...data,
      duration: new Date() - data.startTime
    }));
  }
}

module.exports = new BroadcastService();
