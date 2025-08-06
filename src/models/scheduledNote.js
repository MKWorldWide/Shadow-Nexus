const { DataTypes, Op } = require('sequelize');
const sequelize = require('../services/database');
const logger = require('../utils/logger')('models:scheduledNote');
const templateService = require('../services/templateService');
const { parseCondition } = require('../utils/conditionParser');

const ScheduledNote = sequelize.define('ScheduledNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
    },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  schedule: {
    type: DataTypes.STRING, // CRON expression or 'interval:Xh'
    allowNull: false,
    defaultValue: '0 9 * * *', // 9 AM daily
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastSent: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nextSend: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  webhookIds: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Specific webhook IDs to send to
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  templateVariables: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Variables available in template processing',
    get() {
      const value = this.getDataValue('templateVariables') || {};
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
  },
  condition: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Conditional expression to determine if the note should execute',
  },
  executionCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of times the note has been executed',
  },
  lastExecutionStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Status of the last execution (success/failed)',
  },
  lastExecutionError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if last execution failed',
  },
  lastExecutionTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the note was last executed',
  },
  nextExecutionTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the note is scheduled to run next',
  },
  isWaitingForDependencies: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether execution is waiting for dependencies',
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['nextExecutionTime'],
      where: { isActive: true },
      name: 'scheduled_notes_next_execution_idx',
    },
    {
      fields: ['isWaitingForDependencies'],
      where: { isActive: true },
      name: 'scheduled_notes_waiting_deps_idx',
    },
  ],
  hooks: {
    beforeSave: async (note) => {
      try {
        // Validate schedule format (CRON or interval:Xh)
        if (!/^(\*|([0-9]|1[0-9]|2[0-3])h|(\*|(\*\/\d+)|(\d+(,\d+)*))\s+(\*|(\*\/\d+)|(\d+(,\d+)*))\s+(\*|(\*\/\d+)|(\d+(,\d+)*))\s+(\*|(\*\/\d+)|(\d+(,\d+)*))\s+(\*|(\*\/\d+)|(\d+(,\d+)*)))$/i.test(note.schedule)) {
          throw new Error('Invalid schedule format. Use CRON expression or interval in hours (e.g., "2h")');
        }

        // Process template content if it contains variables
        if (note.content && (note.content.includes('{{') || note.content.includes('}}'))) {
          try {
            // Just validate the template syntax, don't process variables yet
            templateService.process(note.content, { ...(note.templateVariables || {}) }, note.id);
          } catch (error) {
            throw new Error(`Invalid template syntax: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error('Error validating scheduled note:', error);
        throw error;
      }
    },
  },
});

module.exports = ScheduledNote;
