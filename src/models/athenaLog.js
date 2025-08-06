const { DataTypes } = require('sequelize');
const sequelize = require('../services/database');
const logger = require('../utils/logger')('models:athenaLog');

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
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional structured data related to the log entry',
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'Tags for filtering and categorization',
  },
  relatedTo: {
    type: DataTypes.STRING,
    comment: 'Related entity ID (e.g., user ID, document ID, etc.)',
  },
  context: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional context about the log entry',
  },
}, {
  timestamps: true,
  indexes: [
    { fields: ['level'] },
    { fields: ['source'] },
    { fields: ['tags'] },
    { fields: ['createdAt'] },
    { fields: ['relatedTo'] },
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
      relatedTo,
      context: {
        ...context,
        serverId: context.serverId || null,
        userId: context.userId || null,
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
  order = [['createdAt', 'DESC']],
  transaction
} = {}) => {
  try {
    const where = {};
    
    if (level) where.level = level;
    if (source) where.source = source;
    if (relatedTo) where.relatedTo = relatedTo;
    
    // Date range filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    
    // Tag filtering (using array contains operator)
    if (tags && tags.length > 0) {
      where.tags = {
        [Op.overlap]: tags
      };
    }
    
    return await AthenaLog.findAndCountAll({
      where,
      limit,
      offset,
      order,
      transaction,
    });
  } catch (error) {
    logger.error('Failed to query Athena logs:', error);
    throw error;
  }
};

module.exports = AthenaLog;
