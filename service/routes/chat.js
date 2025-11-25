const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Validation middleware
const validateStartConversation = [
  body('language')
    .optional()
    .isIn(['fr', 'en'])
    .withMessage('Language must be fr or en'),
  body('rubrique')
    .optional()
    .isIn(['produit', 'compte_client', 'tunnel_vente', 'general'])
    .withMessage('Invalid rubrique value'),
  body('productCode')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 1, max: 100 })
    .withMessage('Product code must be 1-100 characters'),
  body('userAgent')
    .optional()
    .isLength({ max: 500 })
    .withMessage('User agent too long')
];

const validateMessage = [
  body('sessionId')
    .notEmpty()
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('message')
    .notEmpty()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be 1-500 characters')
];

const validateEscalation = [
  body('sessionId')
    .notEmpty()
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('contactData.firstName')
    .notEmpty()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be 1-50 characters'),
  body('contactData.lastName')
    .notEmpty()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be 1-50 characters'),
  body('contactData.email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('contactData.phone')
    .optional()
    .matches(/^[\d\s\-\(\)+]{10,20}$/)
    .withMessage('Invalid phone number format'),
  body('contactData.subject')
    .notEmpty()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject is required and must be 1-200 characters'),
  body('contactData.availability')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Availability text too long')
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Start a new conversation
router.post('/start', validateStartConversation, handleValidationErrors, async (req, res) => {
  try {
    const { language, rubrique, productCode, userAgent } = req.body;
    
    const conversationParams = {
      language: language || 'fr',
      rubrique: rubrique || 'general',
      productCode,
      userIp: req.ip || req.connection.remoteAddress,
      userAgent: userAgent || req.get('User-Agent')
    };

    const result = await req.services.chat.startConversation(conversationParams);

    res.json(result);
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_start',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Send a message
router.post('/message', validateMessage, handleValidationErrors, async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    const result = await req.services.chat.processMessage(sessionId, message);

    res.json(result);
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_message',
      sessionId: req.body.sessionId,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Escalate conversation to Zendesk
router.post('/escalate', validateEscalation, handleValidationErrors, async (req, res) => {
  try {
    const { sessionId, contactData } = req.body;
    
    const result = await req.services.chat.escalateToZendesk(sessionId, contactData);

    res.json(result);
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_escalate',
      sessionId: req.body.sessionId,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// End conversation
router.post('/end', [
  body('sessionId')
    .notEmpty()
    .isUUID()
    .withMessage('Valid session ID is required'),
  body('feedback.rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
], handleValidationErrors, async (req, res) => {
  try {
    const { sessionId, feedback } = req.body;
    
    const result = await req.services.chat.endConversation(sessionId, feedback || {});

    res.json(result);
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_end',
      sessionId: req.body.sessionId,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get conversation history
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid session ID is required'
      });
    }
    
    const result = await req.services.chat.getConversationHistory(sessionId);

    res.json(result);
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_history',
      sessionId: req.params.sessionId,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get chat service statistics (for monitoring)
router.get('/stats', async (req, res) => {
  try {
    const stats = req.services.chat.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    req.services.logger?.logError(error, {
      action: 'chat_stats',
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;