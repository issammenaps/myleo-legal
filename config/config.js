require('dotenv').config();

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
      credentials: true
    }
  },

  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'myleo_chatbot',
    charset: 'utf8mb4',
    timezone: '+00:00',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    acquireTimeout: 60000,
    timeout: 60000,
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  },

  // External API for FAQ sync (preferred method)
  externalApi: {
    baseUrl: process.env.EXT_API_BASE_URL || 'https://api.myleo.legal',
    token: process.env.EXT_API_TOKEN || '',
    faqEndpoint: process.env.EXT_API_FAQ_ENDPOINT || '/v1/faqs',
    timeout: parseInt(process.env.EXT_API_TIMEOUT) || 30000,
    maxRecords: parseInt(process.env.EXT_API_MAX_RECORDS) || 1000,
    retryAttempts: parseInt(process.env.EXT_API_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.EXT_API_RETRY_DELAY) || 1000
  },

  // External database for FAQ sync (fallback method)
  externalDatabase: {
    host: process.env.EXT_DB_HOST || 'localhost',
    port: process.env.EXT_DB_PORT || 3306,
    user: process.env.EXT_DB_USER || 'readonly_user',
    password: process.env.EXT_DB_PASSWORD || '',
    database: process.env.EXT_DB_NAME || 'myleo_main',
    charset: 'utf8mb4',
    timezone: '+00:00',
    // Table and column mappings for external FAQ data
    faqTable: process.env.EXT_FAQ_TABLE || 'faqs',
    columnMappings: {
      id: process.env.EXT_COL_ID || 'id',
      title: process.env.EXT_COL_TITLE || 'title',
      languageCode: process.env.EXT_COL_LANG || 'language_code',
      isActive: process.env.EXT_COL_ACTIVE || 'is_active',
      metaKeywords: process.env.EXT_COL_KEYWORDS || 'meta_keywords',
      metaDescription: process.env.EXT_COL_DESCRIPTION || 'meta_description',
      productName: process.env.EXT_COL_PRODUCT_NAME || 'product_name',
      productRef: process.env.EXT_COL_PRODUCT_REF || 'product_ref',
      rubrique: process.env.EXT_COL_RUBRIQUE || 'rubrique',
      lastUpdated: process.env.EXT_COL_UPDATED || 'last_updated',
      qaData: process.env.EXT_COL_QA_DATA || 'qa_data'
    }
  },

  // Cache configuration
  cache: {
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES) || 1000,
    ttl: parseInt(process.env.CACHE_TTL) || 300000, // 5 minutes
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 60000, // 1 minute
    useClone: false // For performance
  },

  // Zendesk configuration
  zendesk: {
    domain: process.env.ZENDESK_DOMAIN || 'myleo.zendesk.com',
    email: process.env.ZENDESK_EMAIL || 'support@myleo.com',
    token: process.env.ZENDESK_TOKEN || '',
    apiUrl: process.env.ZENDESK_API_URL || 'https://myleo.zendesk.com/api/v2',
    defaultTicketSettings: {
      status: process.env.ZENDESK_DEFAULT_STATUS || 'new',
      priority: process.env.ZENDESK_DEFAULT_PRIORITY || 'normal',
      type: process.env.ZENDESK_DEFAULT_TYPE || 'question',
      collaborator: process.env.ZENDESK_DEFAULT_COLLABORATOR || '',
      group_id: process.env.ZENDESK_DEFAULT_GROUP_ID || '',
      tags: process.env.ZENDESK_DEFAULT_TAGS ? process.env.ZENDESK_DEFAULT_TAGS.split(',') : ['chatbot', 'escalation']
    }
  },

  // Chat configuration
  chat: {
    maxMessageLength: parseInt(process.env.CHAT_MAX_MESSAGE_LENGTH) || 500,
    sessionTimeout: parseInt(process.env.CHAT_SESSION_TIMEOUT) || 1800000, // 30 minutes
    maxMessagesPerSession: parseInt(process.env.CHAT_MAX_MESSAGES) || 50,
    defaultLanguage: process.env.CHAT_DEFAULT_LANGUAGE || 'fr',
    supportedLanguages: process.env.CHAT_SUPPORTED_LANGUAGES ? 
      process.env.CHAT_SUPPORTED_LANGUAGES.split(',') : ['fr', 'en'],
    searchThreshold: parseFloat(process.env.CHAT_SEARCH_THRESHOLD) || 0.6,
    maxSearchResults: parseInt(process.env.CHAT_MAX_SEARCH_RESULTS) || 5
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/chatbot.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    colorize: process.env.NODE_ENV !== 'production',
    timestamp: true
  },

  // Rate limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    jwtSecret: process.env.JWT_SECRET || 'myleo-chatbot-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h'
  },

  // Widget configuration
  widget: {
    defaultTheme: process.env.WIDGET_DEFAULT_THEME || 'myleo',
    maxWidth: process.env.WIDGET_MAX_WIDTH || '400px',
    maxHeight: process.env.WIDGET_MAX_HEIGHT || '600px',
    position: process.env.WIDGET_DEFAULT_POSITION || 'bottom-right',
    zIndex: parseInt(process.env.WIDGET_Z_INDEX) || 9999,
    animationDuration: parseInt(process.env.WIDGET_ANIMATION_DURATION) || 300
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
};

module.exports = config;