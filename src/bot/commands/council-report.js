const { SlashCommandBuilder } = require('discord.js');
const BaseCommand = require('./_baseCommand');
const { sendCouncilReport } = require('../../modules/councilReport');
const logger = require('../../utils/logger')('commands:council:report');

class CouncilReportCommand extends BaseCommand {
  constructor() {
    super();
    // Define slash command /council report
    this.data = new SlashCommandBuilder()
      .setName('council')
      .setDescription('ShadowFlower council utilities')
      .addSubcommand(sub =>
        sub.setName('report')
          .setDescription('Generate a council report now')
      );

    this.ownerOnly = true; // Restrict to bot owner
    this.ephemeral = true; // Responses are private by default
  }

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'report') return;

    await interaction.deferReply({ ephemeral: this.ephemeral });
    try {
      await sendCouncilReport(client);
      await interaction.editReply('🌙 Council report dispatched.');
      await this.logUsage(interaction);
    } catch (error) {
      logger.error('Failed to send council report', { error: error.message });
      await this.sendError(interaction, 'Failed to send council report.');
    }
  }
}

module.exports = new CouncilReportCommand();

