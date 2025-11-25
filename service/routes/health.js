const express = require('express');
const router = express.Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('../../package.json').version
  });
});

// Detailed health check with service status
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('../../package.json').version,
    services: {},
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  try {
    // Check database connection
    if (req.services.database) {
      const dbHealthy = await req.services.database.healthCheck();
      health.services.database = {
        status: dbHealthy ? 'OK' : 'ERROR',
        connected: dbHealthy
      };
      
      if (!dbHealthy) {
        health.status = 'DEGRADED';
      }
    } else {
      health.services.database = { status: 'NOT_INITIALIZED' };
      health.status = 'ERROR';
    }

    // Check cache service
    if (req.services.cache) {
      const cacheStats = req.services.cache.getStats();
      health.services.cache = {
        status: 'OK',
        stats: cacheStats
      };
    } else {
      health.services.cache = { status: 'NOT_INITIALIZED' };
    }

    // Check language service
    if (req.services.language) {
      const languageStats = req.services.language.getStats();
      health.services.language = {
        status: languageStats.totalLanguages > 0 ? 'OK' : 'ERROR',
        stats: languageStats
      };
      
      if (languageStats.totalLanguages === 0) {
        health.status = 'DEGRADED';
      }
    } else {
      health.services.language = { status: 'NOT_INITIALIZED' };
    }

    // Check Zendesk service
    if (req.services.zendesk) {
      try {
        const zendeskTest = await req.services.zendesk.testConnection();
        health.services.zendesk = {
          status: zendeskTest.success ? 'OK' : 'ERROR',
          message: zendeskTest.message || zendeskTest.error
        };
        
        if (!zendeskTest.success) {
          health.status = 'DEGRADED';
        }
      } catch (error) {
        health.services.zendesk = {
          status: 'ERROR',
          error: error.message
        };
        health.status = 'DEGRADED';
      }
    } else {
      health.services.zendesk = { status: 'NOT_INITIALIZED' };
    }

    // Check chat service
    if (req.services.chat) {
      const chatStats = req.services.chat.getStats();
      health.services.chat = {
        status: 'OK',
        stats: chatStats
      };
    } else {
      health.services.chat = { status: 'NOT_INITIALIZED' };
      health.status = 'ERROR';
    }

  } catch (error) {
    health.status = 'ERROR';
    health.error = error.message;
  }

  const statusCode = health.status === 'OK' ? 200 : health.status === 'DEGRADED' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Liveness probe (for Kubernetes/Docker)
router.get('/live', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (for Kubernetes/Docker)
router.get('/ready', async (req, res) => {
  try {
    let ready = true;
    const checks = {};

    // Check if all essential services are initialized and working
    if (req.services.database) {
      const dbHealthy = await req.services.database.healthCheck();
      checks.database = dbHealthy;
      ready = ready && dbHealthy;
    } else {
      checks.database = false;
      ready = false;
    }

    if (req.services.chat) {
      checks.chat = true;
    } else {
      checks.chat = false;
      ready = false;
    }

    if (req.services.language) {
      const hasLanguages = req.services.language.getStats().totalLanguages > 0;
      checks.language = hasLanguages;
      ready = ready && hasLanguages;
    } else {
      checks.language = false;
      ready = false;
    }

    const response = {
      status: ready ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks
    };

    res.status(ready ? 200 : 503).json(response);
  } catch (error) {
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;