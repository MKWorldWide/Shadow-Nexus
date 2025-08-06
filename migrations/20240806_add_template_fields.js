const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns
    await queryInterface.addColumn('ScheduledNotes', 'templateVariables', {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Variables available in template processing'
    });

    await queryInterface.addColumn('ScheduledNotes', 'executionCount', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times the note has been executed'
    });

    await queryInterface.addColumn('ScheduledNotes', 'lastExecutionStatus', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Status of the last execution (success/failed)'
    });

    await queryInterface.addColumn('ScheduledNotes', 'lastExecutionError', {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if last execution failed'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ScheduledNotes', 'templateVariables');
    await queryInterface.removeColumn('ScheduledNotes', 'executionCount');
    await queryInterface.removeColumn('ScheduledNotes', 'lastExecutionStatus');
    await queryInterface.removeColumn('ScheduledNotes', 'lastExecutionError');
  }
};
