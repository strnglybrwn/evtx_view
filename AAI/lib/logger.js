const winston = require('winston');

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Configure transports
const transports = [];

// File transport for errors
transports.push(
  new winston.transports.File({
    filename: './logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

// File transport for all logs
transports.push(
  new winston.transports.File({
    filename: './logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

// Console transport (development and higher levels)
if (nodeEnv !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
          return `${info.timestamp} [${info.level}]: ${info.message}${info.meta ? ' ' + JSON.stringify(info.meta) : ''}`;
        })
      )
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  transports
});

module.exports = logger;
