const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'The action performed (e.g., create, update, delete, execute)',
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'The type of entity that was modified',
    },
    entity_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'The ID of the entity that was modified',
    },
    user_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'The ID of the user who performed the action',
    },
    server_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'The ID of the server where the action was performed',
    },
    changes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string of the changes made',
      get() {
        const rawValue = this.getDataValue('changes');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('changes', JSON.stringify(value || {}));
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'success',
      comment: 'Status of the action (success, failed, etc.)',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if the action failed',
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional metadata about the action',
      get() {
        const rawValue = this.getDataValue('metadata');
        try {
          return rawValue ? JSON.parse(rawValue) : {};
        } catch (e) {
          return {};
        }
      },
      set(value) {
        this.setDataValue('metadata', JSON.stringify(value || {}));
      },
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address of the requester',
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent string of the requester',
    },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      { fields: ['entity', 'entity_id'] },
      { fields: ['user_id'] },
      { fields: ['server_id'] },
      { fields: ['action'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
    comment: 'Audit log for tracking changes to the system',
  });

  // Add instance methods
  AuditLog.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    // Parse JSON fields if they're strings
    if (typeof values.changes === 'string') {
      try { values.changes = JSON.parse(values.changes); } catch (e) { values.changes = {}; }
    }
    if (typeof values.metadata === 'string') {
      try { values.metadata = JSON.parse(values.metadata); } catch (e) { values.metadata = {}; }
    }
    
    // Remove internal fields
    delete values.updatedAt;
    
    return values;
  };

  return AuditLog;
};
