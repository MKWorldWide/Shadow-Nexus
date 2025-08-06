const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const Webhook = sequelize.define('Webhook', {
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
        len: [2, 100]
      }
    },
    url: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      validate: {
        isUrl: true,
        notEmpty: true
      }
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: () => crypto.randomBytes(32).toString('hex'),
      validate: {
        notEmpty: true
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'webhooks',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ['name']
      },
      {
        fields: ['tags']
      },
      {
        fields: ['is_active']
      }
    ]
  });

  Webhook.associate = (models) => {
    Webhook.belongsTo(models.Server, {
      foreignKey: 'server_id',
      as: 'server',
      onDelete: 'CASCADE'
    });
    
    Webhook.hasMany(models.CommandLog, {
      foreignKey: 'webhook_id',
      as: 'command_logs'
    });
  };

  // Instance methods
  Webhook.prototype.verifySignature = function(payload, signature) {
    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(signature, 'hex')
    );
  };

  return Webhook;
};
