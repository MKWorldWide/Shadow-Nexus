const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Op } = require('sequelize');
const BaseCommand = require('../_baseCommand');
const { Webhook } = require('../../../models');
const logger = require('../../../utils/logger')('commands:webhook:list');

class WebhookListCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('webhook-list')
      .setDescription('List all webhooks in this server')
      .addStringOption(option =>
        option.setName('tag')
          .setDescription('Filter webhooks by tag')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.ManageWebhooks];
    this.guildOnly = true;
    this.ephemeral = true; // Make the response ephemeral by default
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const tagFilter = interaction.options.getString('tag');
    const where = { server_id: interaction.guildId };
    
    // Add tag filter if provided
    if (tagFilter) {
      where.tags = {
        [Op.contains]: [tagFilter.toLowerCase()]
      };
    }
    
    try {
      const webhooks = await Webhook.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 25 // Discord embed field limit is 25
      });
      
      if (webhooks.length === 0) {
        return this.sendSuccess(
          interaction,
          tagFilter 
            ? `No webhooks found with tag "${tagFilter}".`
            : 'No webhooks found. Use `/webhook-add` to add a new webhook.',
          true
        );
      }
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`📋 Webhooks (${webhooks.length})`)
        .setColor('#7289DA')
        .setDescription(tagFilter ? `Filtered by tag: \`${tagFilter}\`` : 'All webhooks in this server:')
        .setTimestamp();
      
      // Add fields for each webhook
      webhooks.forEach(webhook => {
        const status = webhook.is_active ? '🟢 Active' : '🔴 Inactive';
        const tags = webhook.tags && webhook.tags.length 
          ? webhook.tags.map(t => `\`${t}\``).join(', ')
          : 'No tags';
        
        const lastUsed = webhook.last_used_at 
          ? `<t:${Math.floor(webhook.last_used_at.getTime() / 1000)}:R>`
          : 'Never';
        
        embed.addFields({
          name: `${webhook.name} (${status})`,
          value: [
            `**ID:** \`${webhook.id}\``,
            `**URL:** ||${webhook.url}||`,
            `**Tags:** ${tags}`,
            `**Last Used:** ${lastUsed}`,
            `**Created:** <t:${Math.floor(webhook.created_at.getTime() / 1000)}:R>`
          ].join('\n'),
          inline: false
        });
      });
      
      // Add footer with additional info
      embed.setFooter({
        text: `Showing ${webhooks.length} webhook${webhooks.length !== 1 ? 's' : ''}` +
              (webhooks.length >= 25 ? ' (max 25 shown)' : '')
      });
      
      await this.logUsage(interaction, { status: 'COMPLETED' });
      
      return interaction.editReply({ 
        embeds: [embed],
        ephemeral: this.ephemeral 
      });
      
    } catch (error) {
      logger.error('Error listing webhooks:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        'An error occurred while fetching webhooks. Please try again later.'
      );
    }
  }
}

module.exports = WebhookListCommand;
