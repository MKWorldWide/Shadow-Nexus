require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const { sequelize } = require('../services/database');
const HealthMonitor = require('../services/healthMonitor');
const { scheduleNightlyCouncilReport } = require('../modules/councilReport');

// Log startup
logger.info('Starting Shadow Nexus bot...');

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks
  ]
});

// Collections to store commands and events
client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();

// Load commands
async function loadCommands() {
  try {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          logger.debug(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
        }
      } catch (error) {
        logger.error(`Error loading command ${file}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error loading commands:', error);
  }
}

// Load events
async function loadEvents() {
  try {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client, logger));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client, logger));
        }
        logger.debug(`Loaded event: ${event.name}`);
      } catch (error) {
        logger.error(`Error loading event ${file}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error loading events:', error);
  }
}

// Deploy commands
async function deployCommands() {
  try {
    logger.info('Deploying application (/) commands...');
    
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
        }
      } catch (error) {
        logger.error(`Error processing command ${file}:`, error);
      }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands },
    );
    
    logger.info(`Successfully deployed ${commands.length} application commands.`);
  } catch (error) {
    logger.error('Failed to deploy commands:', error);
    throw error;
  }
}

// Initialize database and start bot
async function initialize() {
  try {
    // Initialize database connection
    logger.info('Initializing database connection...');
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    // Sync database models
    logger.info('Synchronizing database models...');
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized.');

    // Load commands and events
    logger.info('Loading commands and events...');
    await loadCommands();
    await loadEvents();

    // Deploy commands
    await deployCommands();

    // Login to Discord
    logger.info('Logging in to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    // Set bot presence
    client.user.setPresence({
      activities: [{ name: 'Shadow Nexus', type: 'WATCHING' }],
      status: 'online'
    });
    
    logger.info(`Logged in as ${client.user.tag}`);

    // Start health monitor if configured
    if (process.env.COMMAND_CENTER_CHANNEL_ID) {
      logger.info('Starting health monitor...');
      const healthMonitor = new HealthMonitor();
      await healthMonitor.start();
      logger.info('Health monitor started');
    } else {
      logger.warn('Health monitor not started: COMMAND_CENTER_CHANNEL_ID not set');
    }

    // Schedule nightly council report for system status updates
    scheduleNightlyCouncilReport(client);
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Consider whether to exit the process here
  // process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

// Start the application
initialize().catch(error => {
  logger.error('Fatal error during initialization:', error);
  process.exit(1);
});
