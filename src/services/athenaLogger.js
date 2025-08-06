const { Webhook, Server } = require('../models');
const webhookService = require('./webhookService');
const { AthenaLog } = require('../models/athenaLog');
const logger = require('../utils/logger')('athena:logger');

class AthenaLogger {
  constructor() {
    this.levels = {
      info: { color: 0x3498db, emoji: 'ℹ️' },
      success: { color: 0x2ecc71, emoji: '✅' },
      warning: { color: 0xf39c12, emoji: '⚠️' },
      error: { color: 0xe74c3c, emoji: '❌' },
      critical: { color: 0x9b59b6, emoji: '🚨' },
    };
  }

  /**
   * Log a message to the database and optionally broadcast to webhooks
   * @param {Object} options - Log options
   * @param {string} options.level - Log level (info, success, warning, error, critical)
   * @param {string} options.source - Source of the log (e.g., 'athena:core', 'athena:vision')
   * @param {string} options.title - Short title for the log entry
   * @param {string} options.message - Detailed message
   * @param {Object} [options.data] - Additional structured data
   * @param {string[]} [options.tags=[]] - Tags for filtering
   * @param {string} [options.relatedTo] - Related entity ID
   * @param {Object} [options.context={}] - Additional context
   * @param {boolean} [options.broadcast=true] - Whether to broadcast to webhooks
   * @param {string[]} [options.requiredTags=[]] - Only broadcast to webhooks with these tags
   * @returns {Promise<Object>} - The created log entry
   */
  async log({
    level = 'info',
    source,
    title,
    message,
    data = {},
    tags = [],
    relatedTo,
    context = {},
    broadcast = true,
    requiredTags = [],
  }) {
    // Validate log level
    if (!this.levels[level]) {
      logger.warn(`Invalid log level: ${level}, defaulting to 'info'`);
      level = 'info';
    }

    // Create the log entry in the database
    let logEntry;
    try {
      logEntry = await AthenaLog.createLog({
        level,
        source: source || 'unknown',
        title: title || message.substring(0, 100),
        message,
        data,
        tags: [...new Set([...tags, level, source])], // Ensure unique tags
        relatedTo,
        context,
      });

      // Broadcast to webhooks if enabled
      if (broadcast) {
        await this.broadcastLog(logEntry, { requiredTags });
      }

      return logEntry;
    } catch (error) {
      logger.error('Failed to create Athena log entry:', error);
      throw error;
    }
  }

  /**
   * Broadcast a log entry to webhooks
   * @param {Object} logEntry - The log entry to broadcast
   * @param {Object} [options] - Broadcast options
   * @param {string[]} [options.requiredTags=[]] - Only send to webhooks with these tags
   * @returns {Promise<void>}
   */
  async broadcastLog(logEntry, { requiredTags = [] } = {}) {
    try {
      const { level, source, title, message, data, tags } = logEntry;
      const levelConfig = this.levels[level] || this.levels.info;
      
      // Build the embed
      const embed = {
        title: `${levelConfig.emoji} ${title}`,
        description: message,
        color: levelConfig.color,
        fields: [],
        timestamp: new Date(),
        footer: {
          text: `AthenaCore • ${source}`,
        },
      };

      // Add data as fields if present
      if (data && Object.keys(data).length > 0) {
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined && value !== null) {
            embed.fields.push({
              name: key,
              value: typeof value === 'object' 
                ? '```json\n' + JSON.stringify(value, null, 2) + '\n```'
                : String(value),
              inline: key.length < 15, // Shorter keys can be inline
            });
          }
        }
      }

      // Add tags if present
      if (tags && tags.length > 0) {
        embed.fields.push({
          name: 'Tags',
          value: tags.map(t => `\`${t}\``).join(', '),
          inline: false,
        });
      }

      // Prepare webhook payload
      const payload = {
        username: 'AthenaCore',
        avatar_url: 'https://i.imgur.com/4M34hi2.png', // Athena logo
        embeds: [embed],
      };

      // Find webhooks with matching tags
      const webhooks = await Webhook.findAll({
        where: {
          isActive: true,
          tags: {
            [this.sequelize.Op.contains]: [...requiredTags, 'athena', 'logs', level],
          },
        },
      });

      // Send to each webhook
      const results = await Promise.allSettled(
        webhooks.map(webhook => 
          webhookService.send(webhook.id, payload)
            .catch(error => ({
              webhookId: webhook.id,
              error: error.message,
            }))
        )
      );

      // Log any errors
      const errors = results
        .filter(r => r.status === 'rejected' || r.value.error)
        .map(r => r.reason || r.value);

      if (errors.length > 0) {
        logger.warn(`Failed to broadcast log to ${errors.length} webhooks:`, errors);
      }

      return {
        success: results.length - errors.length,
        failed: errors.length,
        errors,
      };
    } catch (error) {
      logger.error('Error broadcasting log:', error);
      throw error;
    }
  }

  // Convenience methods for different log levels
  async info(...args) {
    return this.log({ level: 'info', ...this.parseArgs(args) });
  }

  async success(...args) {
    return this.log({ level: 'success', ...this.parseArgs(args) });
  }

  async warn(...args) {
    return this.log({ level: 'warning', ...this.parseArgs(args) });
  }

  async error(...args) {
    return this.log({ level: 'error', ...this.parseArgs(args) });
  }

  async critical(...args) {
    return this.log({ level: 'critical', ...this.parseArgs(args) });
  }

  // Helper to parse different method signatures
  parseArgs(args) {
    // If first arg is an object, assume it's the options
    if (typeof args[0] === 'object') {
      return args[0];
    }

    // Otherwise, assume it's (source, title, message, data?, tags?)
    const [source, title, message, data = {}, tags = []] = args;
    return { source, title, message, data, tags };
  }

  // Query logs with filters
  async queryLogs(options = {}) {
    return AthenaLog.findLogs(options);
  }

  // Get a log by ID
  async getLogById(id) {
    return AthenaLog.findByPk(id);
  }

  // Get logs for a specific entity
  async getLogsForEntity(entityId, options = {}) {
    return this.queryLogs({
      ...options,
      relatedTo: entityId,
    });
  }

  // Get logs by source
  async getLogsBySource(source, options = {}) {
    return this.queryLogs({
      ...options,
      source,
    });
  }

  // Get logs by level
  async getLogsByLevel(level, options = {}) {
    return this.queryLogs({
      ...options,
      level,
    });
  }

  // Get logs by tags
  async getLogsByTags(tags, options = {}) {
    return this.queryLogs({
      ...options,
      tags: Array.isArray(tags) ? tags : [tags],
    });
  }
}

module.exports = new AthenaLogger();
