require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { WebhookAddCommand, WebhookListCommand, WebhookTestCommand, WebhookDeleteCommand, WebhookSendCommand } = require('./commands/webhook');
const { sequelize } = require('../services/database');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE_PATH || 'logs/shadow-nexus.log',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

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
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client, logger));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client, logger));
  }
}

// Deploy commands
async function deployCommands() {
  try {
    logger.info('Started refreshing application (/) commands.');
    
    const commands = [];
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands },
    );

  } catch (error) {
    logger.error('Failed to register commands:', error);
    throw error;
  }
}

// Initialize command handlers
function initializeCommandHandlers() {
  // Store command instances in a Collection
  const commands = new Collection();
  
  // Add webhook commands
  const webhookCommands = {
    'webhook-add': new WebhookAddCommand(),
    'webhook-list': new WebhookListCommand(),
    'webhook-test': new WebhookTestCommand(),
    'webhook-delete': new WebhookDeleteCommand(),
    'webhook-send': new WebhookSendCommand()
  };
  
  // Add commands to collection
  for (const [name, command] of Object.entries(webhookCommands)) {
    commands.set(name, command);
  }
  
  // Handle slash command interactions
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;
    
    const command = commands.get(interaction.commandName);
    
    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    
    try {
      // Check permissions
      const { hasPermission, reason } = await command.checkPermissions(interaction, client);
      
      if (!hasPermission) {
        return interaction.reply({
          content: `❌ ${reason || 'You do not have permission to use this command.'}`,
          ephemeral: true
        });
      }
      
      // Execute the command
      await command.execute(interaction, client, logger);
      
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ There was an error executing this command!',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ There was an error executing this command!',
            ephemeral: true
          });
        }
      } catch (e) {
        logger.error('Failed to send error message:', e);
      }
    }
  });
  
  logger.info('Command handlers initialized');
  return commands;
}

// Initialize database and start bot
async function initialize() {
  try {
    // Initialize database
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // Sync models
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
    
    // Initialize command handlers
    initializeCommandHandlers();
    
    // Register commands
    await registerCommands();
    
    // Start bot
    await client.login(process.env.DISCORD_BOT_TOKEN);
    logger.info(`Logged in as ${client.user.tag}`);
    
    // Set bot presence
    client.user.setPresence({
      activities: [{ name: 'Shadow Nexus', type: 'WATCHING' }],
      status: 'online'
    });
    
  } catch (error) {
    logger.error('Error initializing bot:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

// Start the application
initialize();
