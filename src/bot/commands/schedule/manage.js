const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { ScheduledNote } = require('../../../models');
const schedulerService = require('../../../services/schedulerService');
const logger = require('../../../utils/logger')('commands:schedule:manage');

class ScheduleManageCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('schedule-manage')
      .setDescription('Manage scheduled notes')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('ID of the note to manage')
          .setAutocomplete(true)
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('action')
          .setDescription('Action to perform')
          .addChoices(
            { name: 'Edit', value: 'edit' },
            { name: 'Delete', value: 'delete' },
            { name: 'Toggle Active', value: 'toggle' },
            { name: 'Trigger Now', value: 'trigger' },
            { name: 'View Details', value: 'view' }
          )
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.Administrator];
    this.guildOnly = true;
    this.ephemeral = true;
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const noteId = interaction.options.getString('id');
    const action = interaction.options.getString('action');
    
    try {
      // Find the note
      const note = await ScheduledNote.findOne({
        where: { 
          id: noteId,
          serverId: interaction.guildId 
        }
      });
      
      if (!note) {
        return this.sendError(interaction, 'Scheduled note not found or you do not have permission to manage it.');
      }
      
      // Handle the requested action
      switch (action) {
        case 'edit':
          return this.handleEdit(interaction, note);
        case 'delete':
          return this.handleDelete(interaction, note);
        case 'toggle':
          return this.handleToggle(interaction, note);
        case 'trigger':
          return this.handleTrigger(interaction, note);
        case 'view':
        default:
          return this.handleView(interaction, note);
      }
      
    } catch (error) {
      logger.error(`Error managing scheduled note ${noteId}:`, error);
      
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message,
        metadata: { noteId, action }
      });
      
      return this.sendError(
        interaction,
        `Failed to ${action} scheduled note: ${error.message}`
      );
    }
  }
  
  async handleView(interaction, note) {
    const embed = this.createNoteEmbed(note);
    const row = this.createActionRow(note);
    
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: this.ephemeral
    });
    
    await this.logUsage(interaction, { 
      status: 'COMPLETED',
      metadata: { noteId: note.id, action: 'view' }
    });
  }
  
  async handleEdit(interaction, note) {
    // In a real implementation, you would provide a modal or follow-up for editing
    // For now, we'll just show a message with the current values
    const embed = new EmbedBuilder()
      .setTitle('✏️ Edit Scheduled Note')
      .setDescription('Editing is not fully implemented in this version. Use the following values to recreate the note if needed:')
      .addFields(
        { name: 'Name', value: `\`${note.name}\``, inline: true },
        { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
        { name: 'Content', value: `\`\`\`${note.content}\`\`\``, inline: false },
        { name: 'Tags', value: note.tags.length > 0 ? note.tags.map(t => `\`${t}\``).join(', ') : 'None', inline: false },
        { name: 'Webhook IDs', value: note.webhookIds.length > 0 ? note.webhookIds.map(id => `\`${id}\``).join(', ') : 'None', inline: false }
      )
      .setColor('#FEE75C')
      .setFooter({ text: 'Edit functionality coming soon!' });
    
    await interaction.editReply({
      embeds: [embed],
      ephemeral: this.ephemeral
    });
    
    await this.logUsage(interaction, { 
      status: 'COMPLETED',
      metadata: { noteId: note.id, action: 'edit' }
    });
  }
  
  async handleDelete(interaction, note) {
    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_delete_${note.id}`)
          .setLabel('✅ Confirm Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Deletion')
      .setDescription(`Are you sure you want to delete the scheduled note **${note.name}**?`)
      .addFields(
        { name: 'ID', value: `\`${note.id}\``, inline: true },
        { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
        { name: 'Status', value: note.isActive ? '🟢 Active' : '🔴 Inactive', inline: true },
        { name: 'Content Preview', value: note.content.length > 100 ? `${note.content.substring(0, 97)}...` : note.content, inline: false }
      )
      .setColor('#ED4245')
      .setFooter({ text: 'This action cannot be undone!' });
    
    const response = await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: this.ephemeral
    });
    
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: i => i.user.id === interaction.user.id,
        time: 30_000
      });
      
      if (confirmation.customId === 'cancel_delete') {
        await confirmation.update({
          content: '✅ Deletion cancelled.',
          embeds: [],
          components: []
        });
        
        await this.logUsage(interaction, { 
          status: 'CANCELLED',
          metadata: { noteId: note.id, action: 'delete' }
        });
        
        return;
      }
      
      // Delete the note
      await schedulerService.deleteScheduledNote(note.id);
      
      await confirmation.update({
        content: `✅ Successfully deleted scheduled note: **${note.name}**`,
        embeds: [],
        components: []
      });
      
      await this.logUsage(interaction, { 
        status: 'COMPLETED',
        metadata: { noteId: note.id, action: 'delete' }
      });
      
    } catch (error) {
      if (error.name === 'Error [InteractionCollectorError]') {
        await interaction.editReply({
          content: '❌ Confirmation timed out. Please try again.',
          embeds: [],
          components: []
        });
      } else {
        throw error;
      }
    }
  }
  
  async handleToggle(interaction, note) {
    const newStatus = !note.isActive;
    
    await schedulerService.updateScheduledNote(note.id, { isActive: newStatus });
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Status Updated')
      .setDescription(`Scheduled note **${note.name}** is now **${newStatus ? 'active' : 'inactive'}**`)
      .addFields(
        { name: 'ID', value: `\`${note.id}\``, inline: true },
        { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
        { name: 'Status', value: newStatus ? '🟢 Active' : '🔴 Inactive', inline: true },
        { name: 'Next Run', value: newStatus && note.nextSend 
          ? `<t:${Math.floor(note.nextSend.getTime() / 1000)}:R>` 
          : 'Not scheduled', 
          inline: true 
        }
      )
      .setColor(newStatus ? '#57F287' : '#ED4245')
      .setTimestamp();
    
    await interaction.editReply({
      embeds: [embed],
      ephemeral: this.ephemeral
    });
    
    await this.logUsage(interaction, { 
      status: 'COMPLETED',
      metadata: { 
        noteId: note.id, 
        action: 'toggle', 
        newStatus 
      }
    });
  }
  
  async handleTrigger(interaction, note) {
    // Trigger the note immediately
    await interaction.editReply({
      content: '⏳ Triggering scheduled note...',
      ephemeral: this.ephemeral
    });
    
    try {
      const result = await schedulerService.executeScheduledNote(note);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Note Triggered')
        .setDescription(`Successfully triggered note: **${note.name}**`)
        .addFields(
          { name: 'ID', value: `\`${note.id}\``, inline: true },
          { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
          { name: 'Status', value: '✅ Completed', inline: true },
          { name: 'Success', value: `\`${result.results.filter(r => r.success).length}\``, inline: true },
          { name: 'Failed', value: `\`${result.results.filter(r => !r.success).length}\``, inline: true }
        )
        .setColor('#57F287')
        .setTimestamp();
      
      await interaction.editReply({
        content: '',
        embeds: [embed],
        ephemeral: this.ephemeral
      });
      
      await this.logUsage(interaction, { 
        status: 'COMPLETED',
        metadata: { 
          noteId: note.id, 
          action: 'trigger',
          success: true,
          results: result.results.length,
          successCount: result.results.filter(r => r.success).length,
          failureCount: result.results.filter(r => !r.success).length
        }
      });
      
    } catch (error) {
      logger.error(`Error triggering note ${note.id}:`, error);
      
      await interaction.editReply({
        content: `❌ Failed to trigger note: ${error.message}`,
        ephemeral: this.ephemeral
      });
      
      await this.logUsage(interaction, { 
        status: 'FAILED',
        error: error.message,
        metadata: { 
          noteId: note.id, 
          action: 'trigger',
          success: false
        }
      });
    }
  }
  
  createNoteEmbed(note) {
    return new EmbedBuilder()
      .setTitle(`📅 ${note.name}`)
      .setDescription(note.content)
      .addFields(
        { name: 'ID', value: `\`${note.id}\``, inline: true },
        { name: 'Status', value: note.isActive ? '🟢 Active' : '🔴 Inactive', inline: true },
        { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
        { name: 'Last Sent', value: note.lastSent ? `<t:${Math.floor(note.lastSent.getTime() / 1000)}:R>` : 'Never', inline: true },
        { name: 'Next Run', value: note.nextSend ? `<t:${Math.floor(note.nextSend.getTime() / 1000)}:R>` : 'Not scheduled', inline: true },
        { name: 'Tags', value: note.tags.length > 0 ? note.tags.map(t => `\`${t}\``).join(', ') : 'None', inline: false },
        { name: 'Webhook IDs', value: note.webhookIds.length > 0 ? note.webhookIds.map(id => `\`${id}\``).join(', ') : 'None', inline: false }
      )
      .setColor(note.isActive ? '#57F287' : '#ED4245')
      .setTimestamp();
  }
  
  createActionRow(note) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`schedule_edit_${note.id}`)
          .setLabel('✏️ Edit')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`schedule_toggle_${note.id}`)
          .setLabel(note.isActive ? '⏸️ Pause' : '▶️ Resume')
          .setStyle(note.isActive ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`schedule_trigger_${note.id}`)
          .setLabel('🚀 Trigger Now')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`schedule_delete_${note.id}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );
  }
  
  // Add autocomplete support for note IDs
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name !== 'id') {
      return [];
    }
    
    try {
      const notes = await ScheduledNote.findAll({
        where: { 
          serverId: interaction.guildId,
          [this.sequelize.Op.or]: [
            { id: { [this.sequelize.Op.like]: `%${focusedOption.value}%` } },
            { name: { [this.sequelize.Op.like]: `%${focusedOption.value}%` } }
          ]
        },
        limit: 25,
        order: [['name', 'ASC']]
      });
      
      return interaction.respond(
        notes.map(note => ({
          name: `${note.name} (${note.id})`,
          value: note.id
        }))
        .catch(error => {
          logger.error('Error in autocomplete:', error);
          return [];
        });
      
    } catch (error) {
      logger.error('Error fetching notes for autocomplete:', error);
      return [];
    }
  }
}

module.exports = ScheduleManageCommand;
