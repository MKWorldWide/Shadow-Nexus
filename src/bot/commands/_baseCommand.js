const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('commands:base');
const { CommandLog } = require('../../models');

class BaseCommand {
  constructor() {
    if (this.constructor === BaseCommand) {
      throw new Error("Can't instantiate abstract class!");
    }
    
    this.data = new SlashCommandBuilder()
      .setName('base')
      .setDescription('Base command - should be overridden')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
      
    this.ephemeral = false;
    this.requiredPermissions = [];
    this.requiredRoles = [];
    this.ownerOnly = false;
    this.guildOnly = false;
  }
  
  /**
   * Execute the command
   * @param {import('discord.js').CommandInteraction} interaction - The interaction that triggered the command
   * @param {import('discord.js').Client} client - The Discord client
   * @param {import('winston').Logger} logger - The logger instance
   */
  async execute(interaction, client, logger) {
    throw new Error('Method execute() must be implemented by subclasses');
  }
  
  /**
   * Check if the user has the required permissions
   * @param {import('discord.js').CommandInteraction} interaction - The interaction that triggered the command
   * @param {import('discord.js').Client} client - The Discord client
   * @returns {Promise<{hasPermission: boolean, reason?: string}>}
   */
  async checkPermissions(interaction, client) {
    // Check if command is guild only
    if (this.guildOnly && !interaction.inGuild()) {
      return { hasPermission: false, reason: 'This command can only be used in a server.' };
    }
    
    // Check if user is the bot owner
    if (this.ownerOnly && interaction.user.id !== process.env.OWNER_ID) {
      return { hasPermission: false, reason: 'This command can only be used by the bot owner.' };
    }
    
    // If no specific permissions required, allow
    if (this.requiredPermissions.length === 0 && this.requiredRoles.length === 0) {
      return { hasPermission: true };
    }
    
    // Check if in DM
    if (!interaction.inGuild()) {
      return { hasPermission: false, reason: 'This command cannot be used in DMs.' };
    }
    
    // Check permissions
    const member = await interaction.guild.members.fetch(interaction.user.id);
    
    // Check if user has required permissions
    if (this.requiredPermissions.length > 0) {
      const missingPermissions = this.requiredPermissions.filter(
        permission => !member.permissions.has(permission)
      );
      
      if (missingPermissions.length > 0) {
        return {
          hasPermission: false,
          reason: `You need the following permissions: ${missingPermissions.join(', ')}`
        };
      }
    }
    
    // Check if user has required roles
    if (this.requiredRoles.length > 0) {
      const hasRole = this.requiredRoles.some(roleId => 
        member.roles.cache.has(roleId)
      );
      
      if (!hasRole && !member.permissions.has(PermissionFlagsBits.Administrator)) {
        return {
          hasPermission: false,
          reason: 'You do not have the required role to use this command.'
        };
      }
    }
    
    return { hasPermission: true };
  }
  
  /**
   * Send an error response
   * @param {import('discord.js').CommandInteraction} interaction - The interaction to respond to
   * @param {string} message - The error message
   * @param {boolean} [ephemeral] - Whether the response should be ephemeral
   */
  async sendError(interaction, message, ephemeral = true) {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: `❌ ${message}`,
        ephemeral: ephemeral || this.ephemeral
      });
    }
    
    return interaction.reply({
      content: `❌ ${message}`,
      ephemeral: ephemeral || this.ephemeral
    });
  }
  
  /**
   * Send a success response
   * @param {import('discord.js').CommandInteraction} interaction - The interaction to respond to
   * @param {string} message - The success message
   * @param {boolean} [ephemeral] - Whether the response should be ephemeral
   */
  async sendSuccess(interaction, message, ephemeral = false) {
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: `✅ ${message}`,
        ephemeral: ephemeral || this.ephemeral
      });
    }
    
    return interaction.reply({
      content: `✅ ${message}`,
      ephemeral: ephemeral || this.ephemeral
    });
  }
  
  /**
   * Log command usage
   * @param {import('discord.js').CommandInteraction} interaction - The interaction that triggered the command
   * @param {Object} [options] - Additional options
   * @param {string} [options.status='COMPLETED'] - The status of the command
   * @param {string} [options.error] - Any error that occurred
   * @returns {Promise<import('../../models/command_log')>}
   */
  async logUsage(interaction, { status = 'COMPLETED', error } = {}) {
    try {
      return await CommandLog.logCommand({
        command: interaction.commandName,
        subcommand: interaction.options?.getSubcommand(false),
        options: interaction.options?.data.reduce((acc, opt) => ({
          ...acc,
          [opt.name]: opt.value
        }), {}),
        serverId: interaction.guildId,
        userId: interaction.user.id,
        userAgent: interaction.client.options.http.userAgent,
        metadata: {
          channelId: interaction.channelId,
          channelType: interaction.channel?.type,
          guildId: interaction.guildId,
          memberId: interaction.member?.id,
          messageId: interaction.id,
          isDM: !interaction.inGuild(),
          locale: interaction.locale,
          guildLocale: interaction.guildLocale,
          status,
          error: error?.message || error
        }
      });
    } catch (error) {
      logger.error('Error logging command usage:', error);
      return null;
    }
  }
}

module.exports = BaseCommand;
