'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Create the audit_logs table
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        action: {
          type: Sequelize.STRING(50),
          allowNull: false,
          comment: 'The action performed (e.g., create, update, delete, execute)',
        },
        entity: {
          type: Sequelize.STRING(50),
          allowNull: false,
          comment: 'The type of entity that was modified',
        },
        entity_id: {
          type: Sequelize.STRING(50),
          allowNull: false,
          comment: 'The ID of the entity that was modified',
        },
        user_id: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'The ID of the user who performed the action',
        },
        server_id: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'The ID of the server where the action was performed',
        },
        changes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'JSON string of the changes made',
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'success',
          comment: 'Status of the action (success, failed, etc.)',
        },
        error: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Error message if the action failed',
        },
        metadata: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Additional metadata about the action',
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: 'IP address of the requester',
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'User agent string of the requester',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      }, {
        transaction,
        comment: 'Audit log for tracking changes to the system',
      });

      // Add indexes
      await queryInterface.addIndex('audit_logs', ['entity', 'entity_id'], { transaction });
      await queryInterface.addIndex('audit_logs', ['user_id'], { transaction });
      await queryInterface.addIndex('audit_logs', ['server_id'], { transaction });
      await queryInterface.addIndex('audit_logs', ['action'], { transaction });
      await queryInterface.addIndex('audit_logs', ['status'], { transaction });
      await queryInterface.addIndex('audit_logs', ['created_at'], { transaction });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('audit_logs', { transaction });
    });
  },
};
