const { Collection, Events } = require('discord.js');
const logger = require('../../utils/logger')('command-handler');

class CommandHandler {
  constructor(client) {
    this.client = client;
    this.commands = new Collection();
  }

  /**
   * Register a command
   * @param {Object} command - The command to register
   */
  registerCommand(command) {
    if (!command.data || !command.execute) {
      throw new Error('Invalid command: missing data or execute method');
    }
    
    this.commands.set(command.data.name, command);
    logger.debug(`Registered command: ${command.data.name}`);
  }

  /**
   * Register multiple commands
   * @param {Array<Object>} commands - Array of commands to register
   */
  registerCommands(commands) {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }

  /**
   * Initialize the command handler
   */
  initialize() {
    // Handle slash command interactions
    this.client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isCommand()) return;

      const command = this.commands.get(interaction.commandName);

      if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        // Check permissions if the command has a checkPermissions method
        if (typeof command.checkPermissions === 'function') {
          const { hasPermission, reason } = await command.checkPermissions(interaction, this.client);
          
          if (!hasPermission) {
            return interaction.reply({
              content: `❌ ${reason || 'You do not have permission to use this command.'}`,
              ephemeral: true
            });
          }
        }

        // Execute the command
        await command.execute(interaction, this.client, logger);
        
      } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);
        
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: '❌ There was an error executing this command!',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: '❌ There was an error executing this command!',
              ephemeral: true
            });
          }
        } catch (e) {
          logger.error('Failed to send error message:', e);
        }
      }
    });

    logger.info('Command handler initialized');
  }

  /**
   * Get all registered commands
   * @returns {Array<Object>} Array of command data
   */
  getCommandsData() {
    return Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
  }
}

module.exports = CommandHandler;
