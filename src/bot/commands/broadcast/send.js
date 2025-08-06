const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const broadcastService = require('../../../modules/broadcast');
const { Webhook } = require('../../../models');
const logger = require('../../../utils/logger')('commands:broadcast:send');

class BroadcastSendCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('broadcast')
      .setDescription('Send a broadcast message to multiple webhooks')
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The message to broadcast')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('tags')
          .setDescription('Comma-separated tags to filter webhooks')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('webhook_ids')
          .setDescription('Comma-separated webhook IDs to send to (overrides tags)')
          .setRequired(false)
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
      .addBooleanOption(option =>
        option.setName('confirm')
          .setDescription('Skip confirmation (use with caution)')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.Administrator];
    this.guildOnly = true;
    this.ephemeral = true;
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const message = interaction.options.getString('message');
    const tagsInput = interaction.options.getString('tags');
    const webhookIdsInput = interaction.options.getString('webhook_ids');
    const username = interaction.options.getString('username');
    const avatarURL = interaction.options.getString('avatar');
    const tts = interaction.options.getBoolean('tts') || false;
    const fileURL = interaction.options.getString('file');
    const skipConfirmation = interaction.options.getBoolean('confirm') || false;
    
    // Process tags and webhook IDs
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const webhookIds = webhookIdsInput ? webhookIdsInput.split(',').map(id => id.trim()) : [];
    
    try {
      // Build the where clause to count matching webhooks
      const where = { is_active: true, server_id: interaction.guildId };
      
      if (webhookIds.length > 0) {
        where.id = webhookIds;
      } else if (tags.length > 0) {
        where.tags = {
          [this.sequelize.Op.overlap]: tags
        };
      }
      
      // Count matching webhooks
      const webhookCount = await Webhook.count({ where });
      
      if (webhookCount === 0) {
        return this.sendError(
          interaction,
          'No matching webhooks found. Check your filters or add webhooks first.'
        );
      }
      
      // Show confirmation if not skipped
      if (!skipConfirmation) {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Confirm Broadcast')
          .setDescription(`You are about to send a broadcast to **${webhookCount}** webhook${webhookCount !== 1 ? 's' : ''}.`)
          .addFields(
            { name: 'Message', value: message.length > 500 ? `${message.substring(0, 497)}...` : message, inline: false },
            { name: 'Tags', value: tags.length > 0 ? tags.map(t => `\`${t}\``).join(', ') : 'All webhooks', inline: true },
            { name: 'TTS', value: tts ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'File', value: fileURL ? `[View File](${fileURL})` : 'None', inline: true }
          )
          .setColor('#FFA500')
          .setFooter({ 
            text: 'This action cannot be undone. Use the confirm option to skip this confirmation.'
          });
        
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_broadcast')
              .setLabel('✅ Confirm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_broadcast')
              .setLabel('❌ Cancel')
              .setStyle(ButtonStyle.Danger)
          );
        
        await interaction.editReply({
          embeds: [confirmEmbed],
          components: [row],
          ephemeral: this.ephemeral
        });
        
        // Wait for button interaction
        try {
          const filter = i => 
            i.user.id === interaction.user.id && 
            (i.customId === 'confirm_broadcast' || i.customId === 'cancel_broadcast');
          
          const response = await interaction.channel.awaitMessageComponent({
            filter,
            componentType: 'BUTTON',
            time: 30000 // 30 seconds
          });
          
          if (response.customId === 'cancel_broadcast') {
            await response.update({
              content: '❌ Broadcast cancelled.',
              embeds: [],
              components: []
            });
            
            await this.logUsage(interaction, { status: 'CANCELLED' });
            return;
          }
          
          // If confirmed, continue with broadcast
          await response.deferUpdate();
          
        } catch (error) {
          // Timeout or other error
          if (error.name === 'Error [INTERACTION_COLLECTOR_ERROR]') {
            await interaction.editReply({
              content: '❌ Confirmation timed out. Please try again.',
              embeds: [],
              components: []
            });
            
            await this.logUsage(interaction, { 
              status: 'FAILED', 
              error: 'Confirmation timed out' 
            });
            return;
          }
          
          throw error;
        }
      }
      
      // Start the broadcast
      const broadcastResult = await broadcastService.broadcastMessage({
        message,
        tags,
        webhookIds,
        username: username || interaction.member.displayName,
        avatarURL: avatarURL || interaction.user.displayAvatarURL(),
        tts,
        fileURL,
        guildId: interaction.guildId
      });
      
      // Create status embed
      const statusEmbed = new EmbedBuilder()
        .setTitle('📢 Broadcast Started')
        .setDescription(`Broadcast ID: \`${broadcastResult.broadcastId}\``)
        .addFields(
          { name: 'Status', value: '🟡 In Progress', inline: true },
          { name: 'Total', value: `\`${broadcastResult.results.length}\``, inline: true },
          { name: 'Succeeded', value: '`0`', inline: true },
          { name: 'Failed', value: '`0`', inline: true },
          { name: 'Progress', value: '`0%`', inline: true }
        )
        .setColor('#FEE75C')
        .setTimestamp();
      
      // Add view status button
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`broadcast_status_${broadcastResult.broadcastId}`)
          .setLabel('🔄 Check Status')
          .setStyle(ButtonStyle.Primary)
      );
      
      await interaction.editReply({
        content: '✅ Broadcast started!',
        embeds: [statusEmbed],
        components: [row],
        ephemeral: this.ephemeral
      });
      
      await this.logUsage(interaction, { 
        status: 'COMPLETED',
        metadata: {
          broadcastId: broadcastResult.broadcastId,
          webhookCount: broadcastResult.results.length
        }
      });
      
    } catch (error) {
      logger.error('Error sending broadcast:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        `An error occurred while starting the broadcast: ${error.message}`
      );
    }
  }
}

module.exports = BroadcastSendCommand;
