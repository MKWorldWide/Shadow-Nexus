const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommandLog = sequelize.define('CommandLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    command: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    subcommand: {
      type: DataTypes.STRING,
      allowNull: true
    },
    options: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
      defaultValue: 'PENDING'
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    response: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    execution_time: {
      type: DataTypes.INTEGER,
      comment: 'Execution time in milliseconds',
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'command_logs',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['command']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['server_id']
      },
      {
        fields: ['user_id']
      }
    ]
  });

  CommandLog.associate = (models) => {
    CommandLog.belongsTo(models.Server, {
      foreignKey: 'server_id',
      as: 'server'
    });
    
    CommandLog.belongsTo(models.Webhook, {
      foreignKey: 'webhook_id',
      as: 'webhook'
    });
  };

  // Hooks
  CommandLog.beforeSave(async (log) => {
    if (log.changed('status') && log.status === 'COMPLETED' && log.started_at) {
      log.completed_at = new Date();
      log.execution_time = log.completed_at - log.started_at;
    }
  });

  // Static methods
  CommandLog.logCommand = async (data) => {
    const {
      command,
      subcommand,
      options = {},
      serverId,
      webhookId,
      userId,
      ipAddress,
      userAgent,
      metadata = {}
    } = data;

    return CommandLog.create({
      command,
      subcommand,
      options,
      server_id: serverId,
      webhook_id: webhookId,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata,
      status: 'PENDING',
      started_at: new Date()
    });
  };

  return CommandLog;
};
