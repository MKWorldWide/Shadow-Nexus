const { Events } = require('discord.js');
const logger = require('../../utils/logger')('events:messageCreate');
const { sendGuardianMessage } = require('../../modules/guardianBridge');

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Simple pattern: "!GuardianName: message" routes to guardian bridge
    const match = message.content.match(/^!(\w+):\s*(.+)/);
    if (!match) return;

    const guardian = match[1];
    const text = match[2];

    try {
      await sendGuardianMessage(guardian, text);
      logger.info(`Routed message from ${message.author.tag} to guardian ${guardian}`);
    } catch (error) {
      logger.error('Failed to route guardian message', { error: error.message });
    }
  }
};

