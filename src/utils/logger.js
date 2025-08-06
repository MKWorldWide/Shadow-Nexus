const winston = require('winston');
const { format } = winston;
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Custom log format that includes timestamp and service name
 */
const logFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

/**
 * Console transport format for development
 */
const consoleFormat = format.combine(
  format.colorize(),
  format.printf(
    ({ level, message, label, timestamp, ...meta }) => {
      const service = label ? `[${label}]` : '';
      const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
      return `${timestamp} ${level} ${service} ${message} ${metaString}`;
    }
  )
);

/**
 * Create a new logger instance
 * @param {string} label - Label to identify the service/module
 * @returns {winston.Logger} Configured logger instance
 */
function createLogger(label = 'shadow-nexus') {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: label },
    transports: [
      // Write all logs with level `error` and below to `error.log`
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      }),
      // Write all logs to `combined.log`
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      })
    ]
  });

  // If we're not in production, log to the console with colorization
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: 'HH:mm:ss'
        }),
        format.printf(
          ({ level, message, timestamp, ...meta }) => {
            const service = label ? `[${label}]` : '';
            const metaString = Object.keys(meta).length 
              ? `\n${JSON.stringify(meta, null, 2)}` 
              : '';
            return `${timestamp} ${level} ${service} ${message}${metaString}`;
          }
        )
      )
    }));
  }

  return logger;
}

// Create default logger instance
const logger = createLogger();

// Add a stream for morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = {
  createLogger,
  logger
};

// Example usage:
// const logger = require('./logger')('service-name');
// logger.info('This is an info message');
// logger.error('This is an error message', { error: new Error('Something went wrong') });
// logger.debug('Debug information', { someData: { key: 'value' } });
