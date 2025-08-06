const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const schedulerService = require('../../../services/schedulerService');
const logger = require('../../../utils/logger')('commands:schedule:create');
const templateService = require('../../../services/templateService');

class ScheduleCreateCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('schedule-create')
      .setDescription('Create a new scheduled note')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Name for this scheduled note')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('content')
          .setDescription('The note content to send')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('schedule')
          .setDescription('CRON expression or interval (e.g., "0 9 * * *" for daily at 9 AM, or "2h" for every 2 hours)')
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
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.Administrator];
    this.guildOnly = true;
    this.ephemeral = true;
  }
  
  async execute(interaction, client) {
    // Check if we need to collect template variables
    const content = interaction.options.getString('content');
    const hasTemplateVars = content.includes('{{') && content.includes('}}');
    
    if (hasTemplateVars) {
      // Store the command data in the interaction's custom ID
      const commandData = {
        name: interaction.options.getString('name'),
        content,
        schedule: interaction.options.getString('schedule'),
        tags: interaction.options.getString('tags'),
        webhookIds: interaction.options.getString('webhook_ids'),
        guildId: interaction.guildId
      };
      
      // Create a modal to collect template variables
      const modal = new ModalBuilder()
        .setCustomId(`templateVars_${Date.now()}`)
        .setTitle('Template Variables');
      
      // Add a text input for variables
      const varInput = new TextInputBuilder()
        .setCustomId('templateVars')
        .setLabel('Enter template variables as JSON')
        .setPlaceholder('{"username": "User", "role": "Admin"}')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      // Add a note about the variables
      const noteInput = new TextInputBuilder()
        .setCustomId('note')
        .setLabel('Available variables: {{date}}, {{time}}, {{counter}}')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue('Edit the JSON above to set template variables');
      
      // Add inputs to the modal
      const firstActionRow = new ActionRowBuilder().addComponents(varInput);
      const secondActionRow = new ActionRowBuilder().addComponents(noteInput);
      modal.addComponents(firstActionRow, secondActionRow);
      
      // Store the command data for later use
      client.tempData = client.tempData || new Map();
      client.tempData.set(modal.data.custom_id, commandData);
      
      // Show the modal
      await interaction.showModal(modal);
      return;
    }
    
    // If no template variables, proceed with normal execution
    await this.createScheduledNote(interaction, client, {
      name: interaction.options.getString('name'),
      content,
      schedule: interaction.options.getString('schedule'),
      tags: interaction.options.getString('tags'),
      webhookIds: interaction.options.getString('webhook_ids'),
      templateVars: {}
    });
  }
  
  async createScheduledNote(interaction, client, { name, content, schedule, tags, webhookIds, templateVars }) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    // Process tags and webhook IDs
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    const webhookIdsArray = webhookIds ? webhookIds.split(',').map(id => id.trim()) : [];
    
    try {
      // Create the scheduled note
      const note = await schedulerService.createScheduledNote({
        name,
        content,
        schedule,
        tags: tagsArray,
        webhookIds: webhookIdsArray,
        templateVariables: templateVars,
        isActive: true,
        serverId: interaction.guildId,
      });
      
      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Scheduled Note Created')
        .setDescription(`Successfully created scheduled note: **${note.name}**`)
        .addFields(
          { name: 'Schedule', value: `\`${note.schedule}\``, inline: true },
          { name: 'Status', value: note.isActive ? '🟢 Active' : '🔴 Inactive', inline: true },
          { name: 'Next Send', value: note.nextSend ? `<t:${Math.floor(note.nextSend.getTime() / 1000)}:R>` : 'Not scheduled', inline: true },
          { name: 'Tags', value: note.tags.length > 0 ? note.tags.map(t => `\`${t}\``).join(', ') : 'None', inline: false },
          { name: 'Webhook IDs', value: note.webhookIds.length > 0 ? note.webhookIds.map(id => `\`${id}\``).join(', ') : 'None', inline: false },
          { name: 'Template Variables', value: Object.keys(note.templateVariables || {}).length > 0 
              ? '```json\n' + JSON.stringify(note.templateVariables, null, 2) + '\n```' 
              : 'None', 
            inline: false },
          { name: 'Content Preview', value: note.content.length > 200 ? `${note.content.substring(0, 197)}...` : note.content, inline: false }
        )
        .setColor('#57F287')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed], ephemeral: this.ephemeral });
      
      await this.logUsage(interaction, { 
        status: 'COMPLETED',
        metadata: {
          noteId: note.id,
          schedule: note.schedule,
        }
      });
      
    } catch (error) {
      logger.error('Error creating scheduled note:', error);
      
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message,
        metadata: {
          name,
          schedule,
        }
      });
      
      return this.sendError(
        interaction,
        `Failed to create scheduled note: ${error.message}`
      );
    }
  }
}

module.exports = ScheduleCreateCommand;
