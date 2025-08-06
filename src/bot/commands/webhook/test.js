const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { Webhook } = require('../../../models');
const webhookService = require('../../../services/webhookService');
const logger = require('../../../utils/logger')('commands:webhook:test');

class WebhookTestCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('webhook-test')
      .setDescription('Test a webhook by ID or name')
      .addStringOption(option =>
        option.setName('identifier')
          .setDescription('The webhook ID or name to test')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.ManageWebhooks];
    this.guildOnly = true;
    this.ephemeral = true; // Make the response ephemeral by default
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const identifier = interaction.options.getString('identifier');
    
    try {
      // Find webhook by ID or name
      const webhook = await Webhook.findOne({
        where: {
          server_id: interaction.guildId,
          [this.sequelize.Op.or]: [
            { id: identifier },
            { name: identifier }
          ]
        }
      });
      
      if (!webhook) {
        return this.sendError(
          interaction,
          `No webhook found with ID or name "${identifier}".`
        );
      }
      
      if (!webhook.is_active) {
        return this.sendError(
          interaction,
          `The webhook "${webhook.name}" is currently inactive.`
        );
      }
      
      // Send test message
      const testResult = await webhookService.testWebhook(webhook.url);
      
      // Update last used timestamp
      webhook.last_used_at = new Date();
      await webhook.save();
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle(`🔍 Webhook Test: ${webhook.name}`)
        .setColor(testResult.success ? '#43B581' : '#F04747')
        .addFields(
          { 
            name: 'Status', 
            value: testResult.success ? '✅ Success' : '❌ Failed',
            inline: true 
          },
          { 
            name: 'Response Code', 
            value: testResult.status ? `\`${testResult.status}\`` : 'N/A',
            inline: true 
          },
          { 
            name: 'URL', 
            value: `||${webhook.url}||`,
            inline: false 
          }
        )
        .setTimestamp();
      
      // Add error details if test failed
      if (!testResult.success) {
        embed.addFields({
          name: 'Error',
          value: `\`\`\`${testResult.error || 'Unknown error'}\`\`\``,
          inline: false
        });
      }
      
      // Add additional info for successful tests
      if (testResult.success && testResult.data) {
        embed.addFields({
          name: 'Response',
          value: `\`\`\`json\n${JSON.stringify(testResult.data, null, 2).substring(0, 1000)}\`\`\``,
          inline: false
        });
      }
      
      await this.logUsage(interaction, { status: 'COMPLETED' });
      
      return interaction.editReply({ 
        embeds: [embed],
        ephemeral: this.ephemeral 
      });
      
    } catch (error) {
      logger.error('Error testing webhook:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        'An error occurred while testing the webhook. Please try again later.'
      );
    }
  }
}

module.exports = WebhookTestCommand;
