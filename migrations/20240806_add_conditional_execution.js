'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Add condition field for conditional execution
      await queryInterface.addColumn(
        'ScheduledNotes',
        'condition',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Conditional expression to determine if the note should execute',
        },
        { transaction }
      );

      // Create a junction table for note dependencies
      await queryInterface.createTable(
        'ScheduledNoteDependencies',
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          noteId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'ScheduledNotes',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          dependsOnId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'ScheduledNotes',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          requiredStatus: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'success',
            comment: 'Required status of the dependency (success, failed, any)',
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      );

      // Add index for faster lookups
      await queryInterface.addIndex('ScheduledNoteDependencies', ['noteId'], { transaction });
      await queryInterface.addIndex('ScheduledNoteDependencies', ['dependsOnId'], { transaction });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Remove the condition field
      await queryInterface.removeColumn('ScheduledNotes', 'condition', { transaction });
      
      // Drop the dependencies table
      await queryInterface.dropTable('ScheduledNoteDependencies', { transaction });
    });
  },
};
