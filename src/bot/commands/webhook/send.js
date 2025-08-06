const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { Webhook } = require('../../../models');
const webhookService = require('../../../services/webhookService');
const logger = require('../../../utils/logger')('commands:webhook:send');

class WebhookSendCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('webhook-send')
      .setDescription('Send a message to a webhook')
      .addStringOption(option =>
        option.setName('target')
          .setDescription('Webhook ID, name, or tag')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The message to send')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('username')
          .setDescription('Override the webhook username')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('avatar')
          .setDescription('URL to override the webhook avatar')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName('tts')
          .setDescription('Whether to use text-to-speech')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('file')
          .setDescription('URL of a file to send with the message')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.ManageWebhooks];
    this.guildOnly = true;
    this.ephemeral = true;
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const target = interaction.options.getString('target');
    const message = interaction.options.getString('message');
    const username = interaction.options.getString('username');
    const avatarURL = interaction.options.getString('avatar');
    const tts = interaction.options.getBoolean('tts') || false;
    const fileURL = interaction.options.getString('file');
    
    try {
      // Find webhook by ID, name, or tag
      const webhook = await this.findWebhook(interaction.guildId, target);
      
      if (!webhook) {
        return this.sendError(
          interaction,
          `No webhook found with ID, name, or tag "${target}".`
        );
      }
      
      if (!webhook.is_active) {
        return this.sendError(
          interaction,
          `The webhook "${webhook.name}" is currently inactive.`
        );
      }
      
      // Build the payload
      const payload = {
        content: message,
        username: username || interaction.client.user.username,
        avatar_url: avatarURL || interaction.client.user.displayAvatarURL(),
        tts: tts
      };
      
      // Add file if provided
      if (fileURL) {
        try {
          // In a real implementation, you would download the file and upload it
          // For now, we'll just add the URL to the payload
          payload.file = { url: fileURL };
        } catch (error) {
          logger.error('Error processing file:', error);
          return this.sendError(
            interaction,
            'Failed to process the file. Please check the URL and try again.'
          );
        }
      }
      
      // Send the webhook
      const result = await webhookService.send(webhook.id, payload);
      
      // Update last used timestamp
      webhook.last_used_at = new Date();
      await webhook.save();
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle(`✉️ Message Sent to ${webhook.name}`)
        .setColor('#43B581')
        .addFields(
          { name: 'Status', value: '✅ Success', inline: true },
          { name: 'Response Code', value: `\`${result.status || 200}\``, inline: true },
          { name: 'Message', value: message.length > 500 ? `${message.substring(0, 497)}...` : message, inline: false }
        )
        .setTimestamp();
      
      if (fileURL) {
        embed.addFields({
          name: 'File',
          value: `[View File](${fileURL})`,
          inline: false
        });
      }
      
      await this.logUsage(interaction, { status: 'COMPLETED' });
      
      return interaction.editReply({ 
        embeds: [embed],
        ephemeral: this.ephemeral 
      });
      
    } catch (error) {
      logger.error('Error sending webhook message:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        `An error occurred while sending the message: ${error.message}`
      );
    }
  }
  
  /**
   * Find a webhook by ID, name, or tag
   * @param {string} guildId - The guild ID
   * @param {string} identifier - The webhook ID, name, or tag
   * @returns {Promise<Object|null>} - The webhook or null if not found
   */
  async findWebhook(guildId, identifier) {
    // Try to find by ID
    let webhook = await Webhook.findOne({
      where: {
        id: identifier,
        server_id: guildId
      }
    });
    
    if (webhook) return webhook;
    
    // Try to find by name
    webhook = await Webhook.findOne({
      where: {
        name: identifier,
        server_id: guildId
      }
    });
    
    if (webhook) return webhook;
    
    // Try to find by tag
    webhook = await Webhook.findOne({
      where: {
        server_id: guildId,
        tags: {
          [this.sequelize.Op.contains]: [identifier.toLowerCase()]
        }
      }
    });
    
    return webhook;
  }
}

module.exports = WebhookSendCommand;
