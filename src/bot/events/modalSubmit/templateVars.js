const { ModalSubmitInteraction } = require('discord.js');
const logger = require('../../../utils/logger')('events:modal:templateVars');

module.exports = {
  name: 'templateVars',
  /**
   * @param {ModalSubmitInteraction} interaction 
   * @param {import('discord.js').Client} client 
   */
  async execute(interaction, client) {
    // Extract the original command data
    const commandData = client.tempData?.get(interaction.customId);
    if (!commandData) {
      logger.error('No command data found for modal submission:', interaction.customId);
      await interaction.reply({
        content: '❌ Error: Session expired. Please try creating the scheduled note again.',
        ephemeral: true
      });
      return;
    }

    // Clean up the temp data
    client.tempData.delete(interaction.customId);

    try {
      // Get the template variables from the modal
      const templateVars = interaction.fields.getTextInputValue('templateVars');
      let parsedVars = {};
      
      if (templateVars && templateVars.trim() !== '') {
        try {
          parsedVars = JSON.parse(templateVars);
        } catch (error) {
          logger.error('Error parsing template variables:', error);
          await interaction.reply({
            content: '❌ Invalid JSON format for template variables. Please try again with valid JSON.',
            ephemeral: true
          });
          return;
        }
      }

      // Defer the reply to avoid interaction timeout
      await interaction.deferReply({ ephemeral: true });

      // Call the createScheduledNote method from the command
      const command = client.commands.get('schedule-create');
      if (!command || typeof command.createScheduledNote !== 'function') {
        throw new Error('Command method not found');
      }

      await command.createScheduledNote(interaction, client, {
        ...commandData,
        templateVars: parsedVars
      });

    } catch (error) {
      logger.error('Error handling template variables submission:', error);
      await interaction.followUp({
        content: `❌ An error occurred while creating the scheduled note: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
