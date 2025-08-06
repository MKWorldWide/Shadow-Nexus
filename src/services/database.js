const { Sequelize } = require('sequelize');
const path = require('path');
const winston = require('winston');

// Configure logger for database operations
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'database' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE_PATH || 'logs/database.log',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Initialize Sequelize with SQLite for development
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'data', 'shadow-nexus.sqlite'),
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Test the database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
}

// Define models
const models = {
  Webhook: require('../../models/webhook')(sequelize, Sequelize),
  Server: require('../../models/server')(sequelize, Sequelize),
  CommandLog: require('../../models/command_log')(sequelize, Sequelize),
  // Add more models as needed
};

// Set up model associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Synchronize all models with the database
async function syncModels(force = false) {
  try {
    await sequelize.sync({ force });
    logger.info('Database models synchronized successfully.');
    return true;
  } catch (error) {
    logger.error('Error synchronizing database models:', error);
    return false;
  }
}

// Export the database instance and models
module.exports = {
  sequelize,
  ...models,
  testConnection,
  syncModels,
  // Add transaction helper
  async transaction(callback) {
    const t = await sequelize.transaction();
    try {
      const result = await callback(t);
      await t.commit();
      return result;
    } catch (error) {
      await t.rollback();
      logger.error('Transaction failed:', error);
      throw error;
    }
  }
};
