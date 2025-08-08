const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const logger = require('../config/logger')('scheduledNote');
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
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0 9 * * *', // 9 AM daily
      comment: 'CRON expression or interval for scheduling',
    },
    tags: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
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
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    last_sent: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_sent',
    },
    next_send: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_send',
    },
    webhook_ids: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const rawValue = this.getDataValue('webhook_ids');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return [];
        }
      },
      set(value) {
        this.setDataValue('webhook_ids', JSON.stringify(Array.isArray(value) ? value : []));
      },
      comment: 'Specific webhook IDs to send to',
    },
    metadata: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      get() {
        const rawValue = this.getDataValue('metadata');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('metadata', JSON.stringify(value || {}));
      },
    },
    template_variables: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '{}',
      field: 'template_variables',
      comment: 'Variables available in template processing',
      get() {
        const rawValue = this.getDataValue('template_variables');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('template_variables', JSON.stringify(value || {}));
      },
    },
    condition: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Conditional expression to determine if the note should execute',
    },
    execution_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'execution_count',
      comment: 'Number of times the note has been executed',
    },
    last_execution_status: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_execution_status',
      comment: 'Status of the last execution (success/failed)',
    },
    last_execution_error: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_execution_error',
      comment: 'Error message if last execution failed',
    },
    last_execution_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_execution_time',
      comment: 'When the note was last executed',
    },
    next_execution_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_execution_time',
      comment: 'When the note is scheduled to run next',
    },
    is_waiting_for_dependencies: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_waiting_for_dependencies',
      comment: 'Whether execution is waiting for dependencies',
    },
  }, {
    tableName: 'scheduled_notes',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ['is_active'] },
      { fields: ['next_execution_time'] },
      { fields: ['last_execution_status'] },
    ],
    hooks: {
      beforeSave: async (note) => {
        if (note.changed('content')) {
          try {
            // Process template variables if any
            const templateVars = note.template_variables || {};
            if (Object.keys(templateVars).length > 0) {
              note.content = templateService.render(note.content, templateVars);
            }
            
            // Parse and validate condition if present
            if (note.condition) {
              try {
                parseCondition(note.condition);
              } catch (error) {
                logger.error(`Invalid condition in scheduled note ${note.id}:`, error);
                throw new Error(`Invalid condition: ${error.message}`);
              }
            }
          } catch (error) {
            logger.error('Error processing scheduled note:', error);
            throw error;
          }
        }
      },
    },
  });

  // Add instance methods
  ScheduledNote.prototype.addExecutionLog = async function(status, error = null) {
    this.execution_count = (this.execution_count || 0) + 1;
    this.last_execution_status = status;
    this.last_execution_time = new Date();
    
    if (error) {
      this.last_execution_error = error.message || String(error);
    }
    
    await this.save();
  };

  ScheduledNote.prototype.scheduleNextRun = async function() {
    // This would be implemented based on the schedule field
    // For now, we'll just set it to null
    this.next_execution_time = null;
    await this.save();
  };

  return ScheduledNote;
};
