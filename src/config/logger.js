const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { format } = winston;

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create a logger instance with the given service name
const createLogger = (service = 'app') => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat
      }),
      // File transport for error logs
      new winston.transports.File({
        filename: path.join(logDir, `${service}.error.log`),
        level: 'error',
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        tailable: true
      }),
      // File transport for combined logs
      new winston.transports.File({
        filename: path.join(logDir, `${service}.log`),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        tailable: true
      })
    ]
  });
};

// Create default logger instance
const logger = createLogger('app');

// Export both the default logger and createLogger function
module.exports = {
  logger,
  createLogger
};

// Also set the default logger as the module's default export
module.exports.default = logger;
