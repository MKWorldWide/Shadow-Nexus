const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Server = sequelize.define('Server', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: 'Discord Server ID'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    owner_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        prefix: '!',
        language: 'en-US',
        timezone: 'UTC',
        modules: {
          mommyNotes: {
            enabled: true,
            channelId: null,
            schedule: '0 12 * * *', // Daily at 12 PM
            timezone: 'UTC'
          },
          broadcast: {
            enabled: true,
            allowedRoles: [],
            allowedUsers: []
          }
        }
      }
    },
    last_seen: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'servers',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['is_active']
      },
      {
        fields: ['owner_id']
      }
    ]
  });

  Server.associate = (models) => {
    Server.hasMany(models.Webhook, {
      foreignKey: 'server_id',
      as: 'webhooks',
      onDelete: 'CASCADE'
    });
    
    Server.hasMany(models.CommandLog, {
      foreignKey: 'server_id',
      as: 'command_logs'
    });
  };

  // Instance methods
  Server.prototype.getModuleSetting = function(module, setting) {
    const path = `modules.${module}.${setting}`.split('.');
    return path.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, this.settings);
  };

  Server.prototype.setModuleSetting = async function(module, setting, value) {
    const settings = { ...this.settings };
    
    if (!settings.modules) settings.modules = {};
    if (!settings.modules[module]) settings.modules[module] = {};
    
    const path = setting.split('.');
    let current = settings.modules[module];
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    
    current[path[path.length - 1]] = value;
    this.settings = settings;
    return this.save();
  };

  return Server;
};
