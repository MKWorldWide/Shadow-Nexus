const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const logger = require('../config/logger')('athenaLog');

  const AthenaLog = sequelize.define('AthenaLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    level: {
      type: DataTypes.ENUM('info', 'success', 'warning', 'error', 'critical'),
      defaultValue: 'info',
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Source of the log (e.g., athena:core, athena:vision, etc.)',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      comment: 'Additional structured data related to the log entry',
      get() {
        const rawValue = this.getDataValue('data');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('data', JSON.stringify(value || {}));
      },
    },
    tags: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      comment: 'Tags for filtering and categorization',
      get() {
        const rawValue = this.getDataValue('tags');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      },
      set(value) {
        this.setDataValue('tags', JSON.stringify(Array.isArray(value) ? value : []));
      },
    },
    related_to: {
      type: DataTypes.STRING,
      comment: 'Related entity ID (e.g., user ID, document ID, etc.)',
    },
    context: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      comment: 'Additional context about the log entry',
      get() {
        const rawValue = this.getDataValue('context');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('context', JSON.stringify(value || {}));
      },
    },
  }, {
    tableName: 'athena_logs',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      { fields: ['level'] },
      { fields: ['source'] },
      { fields: ['created_at'] },
      { fields: ['related_to'] },
    ],
  });

  // Add a method to create a log entry with standardized formatting
  AthenaLog.createLog = async ({
    level = 'info',
    source,
    title,
    message,
    data = {},
    tags = [],
    relatedTo,
    context = {},
    transaction
  }) => {
    try {
      // Ensure tags are lowercase and trimmed
      const processedTags = Array.isArray(tags) 
        ? tags.map(tag => tag.toString().toLowerCase().trim())
        : [];

      return await AthenaLog.create({
        level,
        source: source || 'unknown',
        title: title || message.substring(0, 100),
        message,
        data,
        tags: processedTags,
        related_to: relatedTo,
        context: {
          ...context,
          server_id: context.serverId || context.server_id || null,
          user_id: context.userId || context.user_id || null,
        },
      }, { transaction });
    } catch (error) {
      logger.error('Failed to create Athena log entry:', error);
      throw error;
    }
  };

  // Add a method to query logs with common filters
  AthenaLog.findLogs = async ({
    level,
    source,
    tags = [],
    relatedTo,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
    order = [['created_at', 'DESC']],
    transaction
  } = {}) => {
    const { Op } = require('sequelize');
    const where = {};
    
    if (level) where.level = level;
    if (source) where.source = source;
    if (relatedTo) where.related_to = relatedTo;
    
    if (tags && tags.length > 0) {
      where.tags = {
        [Op.overlap]: tags
      };
    }
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }
    
    return await AthenaLog.findAndCountAll({
      where,
      limit,
      offset,
      order,
      transaction,
    });
  };

  // Add a method to clean up old logs
  AthenaLog.cleanupOldLogs = async (daysToKeep = 30, transaction) => {
    const { Op } = require('sequelize');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return await AthenaLog.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoffDate
        }
      },
      transaction
    });
  };

  return AthenaLog;
};
