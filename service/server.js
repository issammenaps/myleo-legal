const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const config = require('../config/config');
const logger = require('./utils/logger');
const Database = require('./database/database');
const ChatService = require('./services/chatService');
const ZendeskService = require('./services/zendeskService');
const CacheService = require('./services/cacheService');
const LanguageService = require('./services/languageService');

// Import routes
const chatRoutes = require('./routes/chat');
const healthRoutes = require('./routes/health');

class ChatbotServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.database = null;
    this.setupRateLimiter();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupRateLimiter() {
    this.rateLimiter = new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: config.rateLimiting.maxRequests,
      duration: config.rateLimiting.windowMs / 1000, // Convert to seconds
      blockDuration: config.rateLimiting.windowMs / 1000
    });
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false, // Allow embedding in other sites
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:", "http://localhost:*"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors(config.server.cors));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting middleware
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip);
        next();
      } catch (rateLimiterRes) {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: rateLimiterRes.msBeforeNext
        });
      }
    });

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Static files for widget and demo
    this.app.use('/widget', express.static(path.join(__dirname, '../public')));
    this.app.use('/languages', express.static(path.join(__dirname, '../languages')));
    this.app.use('/public', express.static(path.join(__dirname, '../public')));

    // Add services to request object
    this.app.use((req, res, next) => {
      req.services = {
        database: this.database,
        chat: this.chatService,
        zendesk: this.zendeskService,
        cache: this.cacheService,
        language: this.languageService
      };
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.use('/health', healthRoutes);
    
    // API routes
    this.app.use('/api/chat', chatRoutes);
    
    // Widget endpoint
    this.app.get('/widget.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/widget.js'));
    });

    // Demo page endpoint
    this.app.get('/demo.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/demo.html'));
    });

    // Test page for URL-based rubrique detection
    this.app.get('/fr/page/nos-avocats-partenaires', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-avocats-partenaires.html'));
    });

    // Additional test routes for different rubriques
    this.app.get('/test-avocats-partenaires.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-avocats-partenaires.html'));
    });

    // Test route for product page (Chlordécone action)
    this.app.get('/action/chlordecone', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-action-chlordecone.html'));
    });

    this.app.get('/test-action-chlordecone.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-action-chlordecone.html'));
    });

    // Test route for client account page
    this.app.get('/compte', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-compte-client.html'));
    });

    this.app.get('/mon-compte', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-compte-client.html'));
    });

    this.app.get('/test-compte-client.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-compte-client.html'));
    });

    // Test detection page
    this.app.get('/test-detection.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, '../public/test-detection.html'));
    });

    // Root redirect to test detection page
    this.app.get('/', (req, res) => {
      res.redirect('/test-detection.html');
    });

    // Fallback route
    this.app.get('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      res.status(err.status || 500).json({
        success: false,
        error: config.isProduction ? 'Internal server error' : err.message
      });
    });
  }

  async initialize() {
    try {
      logger.info('Initializing chatbot server...');

      // Initialize database
      this.database = new Database(config.database);
      await this.database.connect();
      logger.info('Database connected successfully');

      // Initialize services
      this.cacheService = new CacheService(config.cache);
      this.languageService = new LanguageService();
      await this.languageService.loadLanguages();
      
      this.zendeskService = new ZendeskService(config.zendesk, logger);
      this.chatService = new ChatService({
        database: this.database,
        cache: this.cacheService,
        language: this.languageService,
        zendesk: this.zendeskService,
        config: config.chat,
        logger
      });

      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`Chatbot server running on http://${config.server.host}:${config.server.port}`);
        logger.info(`Environment: ${config.environment}`);
        logger.info(`Widget available at: http://${config.server.host}:${config.server.port}/widget.js`);
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        if (this.server) {
          this.server.close(async () => {
            logger.info('HTTP server closed');
            
            if (this.database) {
              await this.database.close();
              logger.info('Database connection closed');
            }
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
          });
        }
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new ChatbotServer();
  server.start().catch(error => {
    console.error('Failed to start chatbot server:', error);
    process.exit(1);
  });
}

module.exports = ChatbotServer;