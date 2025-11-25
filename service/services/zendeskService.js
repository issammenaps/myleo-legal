const axios = require('axios');

class ZendeskService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.apiClient = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      auth: {
        username: `${config.email}/token`,
        password: config.token
      }
    });

    // Add request/response interceptors for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        this.logger.info('Zendesk API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? Object.keys(config.data) : []
        });
        return config;
      },
      (error) => {
        this.logger.error('Zendesk API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.apiClient.interceptors.response.use(
      (response) => {
        this.logger.info('Zendesk API Response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Zendesk API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          error: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a ticket in Zendesk
   * @param {Object} ticketData 
   * @returns {Object} Created ticket information
   */
  async createTicket(ticketData) {
    try {
      const ticket = this.prepareTicketData(ticketData);
      
      const response = await this.apiClient.post('/tickets.json', {
        ticket: ticket
      });

      const createdTicket = response.data.ticket;
      
      this.logger.logZendeskTicket(ticketData, createdTicket.id, {
        status: 'created',
        url: `https://${this.config.domain}/agent/tickets/${createdTicket.id}`
      });

      return {
        success: true,
        ticketId: createdTicket.id,
        ticketUrl: `https://${this.config.domain}/agent/tickets/${createdTicket.id}`,
        ticket: createdTicket
      };
    } catch (error) {
      this.logger.error('Failed to create Zendesk ticket', {
        error: error.message,
        ticketData: Object.keys(ticketData),
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Prepare ticket data for Zendesk API
   * @param {Object} ticketData 
   * @returns {Object} Formatted ticket data
   */
  prepareTicketData(ticketData) {
    const {
      firstName,
      lastName,
      email,
      phone,
      subject,
      availability,
      productName,
      conversationHistory = [],
      rubrique,
      language = 'fr'
    } = ticketData;

    // Build ticket description
    let description = this.buildTicketDescription({
      firstName,
      lastName,
      email,
      phone,
      availability,
      productName,
      conversationHistory,
      rubrique,
      language
    });

    // Prepare ticket object
    const ticket = {
      subject: subject || 'Demande de support via chatbot',
      comment: {
        body: description
      },
      requester: {
        name: `${firstName} ${lastName}`.trim() || 'Client Chatbot',
        email: email
      },
      status: this.config.defaultTicketSettings.status,
      priority: this.config.defaultTicketSettings.priority,
      type: this.config.defaultTicketSettings.type,
      tags: [
        ...this.config.defaultTicketSettings.tags,
        `language:${language}`,
        `rubrique:${rubrique || 'general'}`
      ]
    };

    // Add group if specified
    if (this.config.defaultTicketSettings.group_id) {
      ticket.group_id = this.config.defaultTicketSettings.group_id;
    }

    // Add assignee if specified
    if (this.config.defaultTicketSettings.assignee_id) {
      ticket.assignee_id = this.config.defaultTicketSettings.assignee_id;
    }

    // Add custom fields if available
    if (ticketData.customFields) {
      ticket.custom_fields = ticketData.customFields;
    }

    // Add product information as tags if available
    if (productName) {
      ticket.tags.push(`product:${productName.replace(/\s+/g, '_').toLowerCase()}`);
    }

    if (phone) {
      ticket.tags.push('has_phone');
    }

    return ticket;
  }

  /**
   * Build ticket description from provided data
   * @param {Object} data 
   * @returns {string}
   */
  buildTicketDescription(data) {
    const {
      firstName,
      lastName,
      email,
      phone,
      availability,
      productName,
      conversationHistory,
      rubrique,
      language
    } = data;

    let description = '';

    // Header
    description += '=== DEMANDE DE SUPPORT VIA CHATBOT ===\n\n';

    // Client information
    description += '--- INFORMATIONS CLIENT ---\n';
    if (firstName || lastName) {
      description += `Nom: ${firstName} ${lastName}\n`;
    }
    if (email) {
      description += `Email: ${email}\n`;
    }
    if (phone) {
      description += `Téléphone: ${phone}\n`;
    }
    if (availability) {
      description += `Disponibilités: ${availability}\n`;
    }

    description += '\n';

    // Context information
    description += '--- CONTEXTE ---\n';
    description += `Langue: ${language}\n`;
    description += `Section: ${rubrique || 'general'}\n`;
    if (productName) {
      description += `Produit: ${productName}\n`;
    }
    description += `Date: ${new Date().toLocaleString('fr-FR')}\n\n`;

    // Conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      description += '--- HISTORIQUE DE CONVERSATION ---\n';
      
      conversationHistory.forEach((message, index) => {
        const timestamp = new Date(message.created_at).toLocaleTimeString('fr-FR');
        const speaker = message.message_type === 'user' ? 'CLIENT' : 'BOT';
        description += `[${timestamp}] ${speaker}: ${message.message_text}\n`;
        
        // Add FAQ reference if available
        if (message.faq_title) {
          description += `    ^ Référence FAQ: ${message.faq_title}\n`;
        }
      });
      
      description += '\n';
    }

    // Footer
    description += '--- INFORMATIONS SYSTÈME ---\n';
    description += 'Ticket créé automatiquement par le système de chatbot Myleo\n';
    description += 'Le client n\'a pas trouvé de réponse satisfaisante dans la FAQ automatisée.\n';

    return description;
  }

  /**
   * Update ticket with additional information
   * @param {number} ticketId 
   * @param {Object} updateData 
   * @returns {Object}
   */
  async updateTicket(ticketId, updateData) {
    try {
      const response = await this.apiClient.put(`/tickets/${ticketId}.json`, {
        ticket: updateData
      });

      this.logger.info('Zendesk ticket updated', {
        ticketId,
        updateData: Object.keys(updateData)
      });

      return {
        success: true,
        ticket: response.data.ticket
      };
    } catch (error) {
      this.logger.error('Failed to update Zendesk ticket', {
        ticketId,
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add comment to ticket
   * @param {number} ticketId 
   * @param {string} comment 
   * @param {boolean} isPublic 
   * @returns {Object}
   */
  async addComment(ticketId, comment, isPublic = true) {
    try {
      const response = await this.apiClient.put(`/tickets/${ticketId}.json`, {
        ticket: {
          comment: {
            body: comment,
            public: isPublic
          }
        }
      });

      this.logger.info('Comment added to Zendesk ticket', {
        ticketId,
        isPublic,
        commentLength: comment.length
      });

      return {
        success: true,
        ticket: response.data.ticket
      };
    } catch (error) {
      this.logger.error('Failed to add comment to Zendesk ticket', {
        ticketId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get ticket information
   * @param {number} ticketId 
   * @returns {Object}
   */
  async getTicket(ticketId) {
    try {
      const response = await this.apiClient.get(`/tickets/${ticketId}.json`);
      
      return {
        success: true,
        ticket: response.data.ticket
      };
    } catch (error) {
      this.logger.error('Failed to get Zendesk ticket', {
        ticketId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Zendesk connection
   * @returns {Object}
   */
  async testConnection() {
    try {
      const response = await this.apiClient.get('/tickets.json?per_page=1');
      
      this.logger.info('Zendesk connection test successful');
      
      return {
        success: true,
        message: 'Connection successful',
        ticketsFound: response.data.count
      };
    } catch (error) {
      this.logger.error('Zendesk connection test failed', {
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  /**
   * Get Zendesk service statistics
   * @returns {Object}
   */
  getStats() {
    return {
      domain: this.config.domain,
      email: this.config.email,
      hasToken: !!this.config.token,
      defaultSettings: this.config.defaultTicketSettings
    };
  }

  /**
   * Validate ticket data before creation
   * @param {Object} ticketData 
   * @returns {Object}
   */
  validateTicketData(ticketData) {
    const errors = [];

    if (!ticketData.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticketData.email)) {
      errors.push('Valid email is required');
    }

    if (!ticketData.firstName && !ticketData.lastName) {
      errors.push('At least first name or last name is required');
    }

    if (!ticketData.subject || ticketData.subject.trim().length === 0) {
      errors.push('Subject is required');
    }

    if (ticketData.phone && !/^[+]?[\d\s\-\(\)]{10,}$/.test(ticketData.phone)) {
      errors.push('Valid phone number is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create ticket from chat escalation
   * @param {Object} conversationData 
   * @param {Object} contactForm 
   * @returns {Object}
   */
  async escalateConversation(conversationData, contactForm) {
    const validation = this.validateTicketData(contactForm);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Invalid ticket data',
        validationErrors: validation.errors
      };
    }

    const ticketData = {
      ...contactForm,
      productName: conversationData.productName,
      conversationHistory: conversationData.messages || [],
      rubrique: conversationData.rubrique,
      language: conversationData.languageCode
    };

    return await this.createTicket(ticketData);
  }
}

module.exports = ZendeskService;