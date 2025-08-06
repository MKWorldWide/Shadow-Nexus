const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { Webhook } = require('../../../models');
const logger = require('../../../utils/logger')('commands:webhook:delete');

class WebhookDeleteCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('webhook-delete')
      .setDescription('Delete a webhook by ID or name')
      .addStringOption(option =>
        option.setName('identifier')
          .setDescription('The webhook ID or name to delete')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option.setName('force')
          .setDescription('Skip confirmation')
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
    
    const identifier = interaction.options.getString('identifier');
    const force = interaction.options.getBoolean('force') || false;
    
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
      
      // If not forcing, ask for confirmation
      if (!force) {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Confirm Deletion')
          .setDescription(`Are you sure you want to delete the webhook **${webhook.name}**?`)
          .addFields(
            { name: 'ID', value: `\`${webhook.id}\``, inline: true },
            { name: 'URL', value: `||${webhook.url}||`, inline: true },
            { name: 'Status', value: webhook.is_active ? '🟢 Active' : '🔴 Inactive', inline: true },
            { 
              name: 'Tags', 
              value: webhook.tags && webhook.tags.length 
                ? webhook.tags.map(t => `\`${t}\``).join(', ')
                : 'No tags',
              inline: false 
            }
          )
          .setColor('#FFA500')
          .setFooter({ 
            text: 'This action cannot be undone. Use the force option to skip this confirmation.'
          });
        
        await interaction.editReply({
          embeds: [confirmEmbed],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: '✅ Confirm',
                  style: 3,
                  customId: `confirm_delete_${webhook.id}`
                },
                {
                  type: 2,
                  label: '❌ Cancel',
                  style: 4,
                  customId: 'cancel_delete'
                }
              ]
            }
          ],
          ephemeral: this.ephemeral
        });
        
        // Wait for button interaction
        try {
          const filter = i => 
            i.user.id === interaction.user.id && 
            (i.customId === `confirm_delete_${webhook.id}` || i.customId === 'cancel_delete');
          
          const response = await interaction.channel.awaitMessageComponent({
            filter,
            componentType: 'BUTTON',
            time: 30000 // 30 seconds
          });
          
          if (response.customId === 'cancel_delete') {
            await response.update({
              content: '❌ Deletion cancelled.',
              embeds: [],
              components: []
            });
            
            await this.logUsage(interaction, { status: 'CANCELLED' });
            return;
          }
          
          // If confirmed, continue with deletion
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
      
      // Delete the webhook
      await webhook.destroy();
      
      await this.logUsage(interaction, { status: 'COMPLETED' });
      
      return this.sendSuccess(
        interaction,
        `✅ Successfully deleted webhook **${webhook.name}** (\`${webhook.id}\`).`
      );
      
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message 
      });
      
      return this.sendError(
        interaction,
        'An error occurred while deleting the webhook. Please try again later.'
      );
    }
  }
}

module.exports = WebhookDeleteCommand;
