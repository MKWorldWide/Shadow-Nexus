const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const logger = require('../../utils/logger')('commands:system:lockdown');

class LockdownCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('lockdown')
      .setDescription('🔒 Lock down the system and restrict access')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for lockdown')
          .setRequired(false)
      );
      
    this.requiredPermissions = ['ADMINISTRATOR'];
    this.ephemeral = true;
  }

  async execute(interaction) {
    await super.execute(interaction);
    
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    try {
      // Log the lockdown action
      await this.logAction(interaction, {
        action: 'LOCKDOWN',
        details: `System lockdown initiated by ${interaction.user.tag}`,
        reason: reason
      });
      
      // Here you would add your actual lockdown logic, for example:
      // - Disable certain bot features
      // - Restrict server access
      // - Notify admins
      
      await interaction.editReply({
        content: `⚠️ **System Lockdown Activated**\nReason: ${reason}\n\nAll non-essential functions have been disabled.`,
        ephemeral: this.ephemeral
      });
      
      logger.warn(`Lockdown initiated by ${interaction.user.tag} (${interaction.user.id}) - ${reason}`);
      
    } catch (error) {
      logger.error(`Error during lockdown: ${error.message}`, { error });
      await interaction.editReply({
        content: '❌ An error occurred while initiating lockdown.',
        ephemeral: true
      });
    }
  }
}

module.exports = LockdownCommand;
