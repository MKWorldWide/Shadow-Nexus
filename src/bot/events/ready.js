const { Events } = require('discord.js');
const logger = require('../../utils/logger')('discord:ready');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      // Set bot presence
      client.user.setPresence({
        activities: [{
          name: 'your commands',
          type: 3 // WATCHING
        }],
        status: 'online'
      });

      // Log successful login
      logger.info(`Logged in as ${client.user.tag}`);
      logger.info(`Serving ${client.guilds.cache.size} servers`);
      
      // Initialize server records in database
      const { Server } = require('../../models');
      const guilds = await client.guilds.fetch();
      
      for (const [id, guild] of guilds) {
        try {
          const fullGuild = await guild.fetch();
          await Server.upsert({
            id: fullGuild.id,
            name: fullGuild.name,
            icon: fullGuild.iconURL(),
            owner_id: fullGuild.ownerId,
            last_seen: new Date()
          });
          logger.debug(`Initialized server: ${fullGuild.name} (${fullGuild.id})`);
        } catch (error) {
          logger.error(`Error initializing server ${guild.id}:`, error);
        }
      }
      
      logger.info('Bot is ready and initialized');
    } catch (error) {
      logger.error('Error in ready event:', error);
    }
  },
};
