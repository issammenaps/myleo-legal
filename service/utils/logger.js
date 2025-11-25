const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

// Create logs directory if it doesn't exist
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for log messages
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { 
    service: 'myleo-chatbot',
    version: require('../../package.json').version
  },
  transports: [
    // File transport
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true,
      format: customFormat
    }),
    
    // Console transport for non-production
    ...(config.isDevelopment ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let metaString = '';
            if (Object.keys(meta).length > 0) {
              metaString = ' ' + JSON.stringify(meta, null, 2);
            }
            return `${timestamp} [${level}]: ${message}${metaString}`;
          })
        )
      })
    ] : [])
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

// Helper methods for structured logging
logger.logRequest = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  if (next) next();
};

logger.logChat = (sessionId, messageType, message, metadata = {}) => {
  logger.info('Chat Message', {
    sessionId,
    messageType,
    message: message.substring(0, 100), // Truncate long messages
    ...metadata
  });
};

logger.logFaqSearch = (query, results, metadata = {}) => {
  logger.info('FAQ Search', {
    query: query.substring(0, 100),
    resultCount: results.length,
    ...metadata
  });
};

logger.logZendeskTicket = (ticketData, ticketId, metadata = {}) => {
  logger.info('Zendesk Ticket Created', {
    ticketId,
    subject: ticketData.subject?.substring(0, 100),
    requesterEmail: ticketData.requester?.email,
    ...metadata
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Add custom log levels for chatbot-specific events
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
});

module.exports = logger;