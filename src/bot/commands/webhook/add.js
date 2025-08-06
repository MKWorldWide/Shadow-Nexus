const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { Webhook, Server } = require('../../../models');
const webhookService = require('../../../services/webhookService');
const logger = require('../../../utils/logger')('commands:webhook:add');

class WebhookAddCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('webhook-add')
      .setDescription('Add a new webhook to the system')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('A name to identify this webhook')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('url')
          .setDescription('The webhook URL')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('tags')
          .setDescription('Comma-separated tags for this webhook (e.g., "announcements,updates")')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.ManageWebhooks];
    this.guildOnly = true;
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const name = interaction.options.getString('name');
    const url = interaction.options.getString('url');
    const tagsInput = interaction.options.getString('tags');
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return this.sendError(interaction, 'Invalid URL provided. Please provide a valid webhook URL.');
    }
    
    // Check if webhook with this name already exists
    const existingWebhook = await Webhook.findOne({
      where: { 
        name,
        server_id: interaction.guildId 
      }
    });
    
    if (existingWebhook) {
      return this.sendError(interaction, `A webhook with the name "${name}" already exists.`);
    }
    
    // Process tags
    const tags = tagsInput 
      ? tagsInput.split(',').map(tag => tag.trim().toLowerCase())
      : [];
    
    try {
      // Test the webhook
      const testResult = await webhookService.testWebhook(url);
      
      if (!testResult.success) {
        logger.warn(`Failed to verify webhook ${name} (${url}): ${testResult.error}`);
        return this.sendError(
          interaction, 
          `Failed to verify webhook: ${testResult.error || 'Unknown error'}. ` +
          'Please check the URL and try again.'
        );
      }
      
      // Get or create server record
      const [server] = await Server.findOrCreate({
        where: { id: interaction.guildId },
        defaults: {
          name: interaction.guild.name,
          owner_id: interaction.guild.ownerId,
          last_seen: new Date()
        }
      });
      
      // Create webhook record
      const webhook = await Webhook.create({
        name,
        url,
        tags,
        server_id: interaction.guildId,
        created_by: interaction.user.id,
        is_active: true,
        last_used_at: new Date()
      });
      
      await this.logUsage(interaction, { status: 'COMPLETED' });
      
      return this.sendSuccess(
        interaction,
        `Successfully added webhook **${webhook.name}** with ID: \`${webhook.id}\`\n` +
        `Status: ${testResult.status} ${testResult.statusText}\n` +
        `Tags: ${tags.length ? tags.map(t => `\`${t}\``).join(', ') : 'None'}`,
        true
      );
      
    } catch (error) {
      logger.error('Error adding webhook:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        'An error occurred while adding the webhook. Please try again later.'
      );
    }
  }
}

module.exports = WebhookAddCommand;
