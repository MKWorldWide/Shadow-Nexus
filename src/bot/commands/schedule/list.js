const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const BaseCommand = require('../_baseCommand');
const { ScheduledNote } = require('../../../models');
const logger = require('../../../utils/logger')('commands:schedule:list');

class ScheduleListCommand extends BaseCommand {
  constructor() {
    super();
    
    this.data = new SlashCommandBuilder()
      .setName('schedule-list')
      .setDescription('List all scheduled notes')
      .addBooleanOption(option =>
        option.setName('show_all')
          .setDescription('Show all notes, including inactive ones')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setDMPermission(false);
      
    this.requiredPermissions = [PermissionFlagsBits.Administrator];
    this.guildOnly = true;
    this.ephemeral = true;
    this.ITEMS_PER_PAGE = 5;
  }
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: this.ephemeral });
    
    const showAll = interaction.options.getBoolean('show_all') || false;
    const page = 1; // Start with first page
    
    try {
      // Get total count of scheduled notes
      const where = { serverId: interaction.guildId };
      if (!showAll) {
        where.isActive = true;
      }
      
      const totalCount = await ScheduledNote.count({ where });
      const totalPages = Math.ceil(totalCount / this.ITEMS_PER_PAGE);
      
      // Get paginated results
      const notes = await ScheduledNote.findAll({
        where,
        order: [['nextSend', 'DESC NULLS LAST'], ['name', 'ASC']],
        limit: this.ITEMS_PER_PAGE,
        offset: (page - 1) * this.ITEMS_PER_PAGE,
      });
      
      if (notes.length === 0) {
        return this.sendSuccess(
          interaction,
          showAll 
            ? 'No scheduled notes found.' 
            : 'No active scheduled notes found. Use `/schedule-create` to create one.'
        );
      }
      
      // Create embed
      const embed = this.createEmbed(notes, page, totalPages, totalCount, showAll);
      
      // Create pagination buttons
      const row = this.createPaginationRow(page, totalPages, showAll);
      
      await interaction.editReply({
        embeds: [embed],
        components: totalPages > 1 ? [row] : [],
        ephemeral: this.ephemeral
      });
      
      await this.logUsage(interaction, { 
        status: 'COMPLETED',
        metadata: {
          page,
          totalPages,
          totalCount,
          showAll
        }
      });
      
    } catch (error) {
      logger.error('Error listing scheduled notes:', error);
      
      await this.logUsage(interaction, { 
        status: 'FAILED', 
        error: error.message
      });
      
      return this.sendError(
        interaction,
        'Failed to list scheduled notes. Please try again later.'
      );
    }
  }
  
  createEmbed(notes, page, totalPages, totalCount, showAll) {
    const embed = new EmbedBuilder()
      .setTitle('📅 Scheduled Notes')
      .setDescription(showAll ? 'All scheduled notes' : 'Active scheduled notes')
      .setColor('#5865F2')
      .setFooter({ 
        text: `Page ${page} of ${totalPages} • ${totalCount} total${showAll ? '' : ' active'} notes`
      })
      .setTimestamp();
    
    // Add fields for each note
    notes.forEach((note, index) => {
      const status = note.isActive ? '🟢' : '🔴';
      const nextRun = note.nextSend 
        ? `<t:${Math.floor(note.nextSend.getTime() / 1000)}:R>` 
        : 'Not scheduled';
      
      embed.addFields({
        name: `${status} ${note.name}`,
        value: [
          `**ID:** \`${note.id}\``,
          `**Schedule:** \`${note.schedule}\``,
          `**Next Run:** ${nextRun}`,
          `**Last Sent:** ${note.lastSent ? `<t:${Math.floor(note.lastSent.getTime() / 1000)}:R>` : 'Never'}`,
          `**Tags:** ${note.tags.length > 0 ? note.tags.map(t => `\`${t}\``).join(', ') : 'None'}`,
          `**Preview:** ${note.content.length > 50 ? note.content.substring(0, 47) + '...' : note.content}`
        ].join('\n'),
        inline: false
      });
    });
    
    return embed;
  }
  
  createPaginationRow(page, totalPages, showAll) {
    const row = new ActionRowBuilder();
    
    // Previous button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`schedule_list_prev_${page - 1}_${showAll}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1)
    );
    
    // Page info
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('schedule_list_page')
        .setLabel(`Page ${page} of ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    // Next button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`schedule_list_next_${page + 1}_${showAll}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages)
    );
    
    // Toggle show all
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`schedule_list_toggle_${!showAll}`)
        .setLabel(showAll ? 'Show Active Only' : 'Show All')
        .setStyle(showAll ? ButtonStyle.Danger : ButtonStyle.Success)
    );
    
    return row;
  }
}

module.exports = ScheduleListCommand;
