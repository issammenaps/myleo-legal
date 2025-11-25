const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class Database {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        charset: this.config.charset,
        timezone: this.config.timezone,
        connectionLimit: this.config.connectionLimit,
        acquireTimeout: this.config.acquireTimeout,
        timeout: this.config.timeout,
        ssl: this.config.ssl,
        multipleStatements: false,
        namedPlaceholders: true
      });

      // Test the connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.isConnected = true;
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }

  async query(sql, params = {}) {
    const startTime = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      const [rows, fields] = await this.pool.execute(sql, params);
      const duration = Date.now() - startTime;

      if (duration > 1000) { // Log slow queries
        logger.warn('Slow query detected', {
          sql: sql.substring(0, 100),
          duration: `${duration}ms`,
          params: Object.keys(params)
        });
      }

      return { rows, fields, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        sql: sql.substring(0, 100),
        duration: `${duration}ms`,
        error: error.message,
        params: Object.keys(params)
      });
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // FAQ-related database methods
  async getFaqs(filters = {}) {
    let sql = `
      SELECT 
        id, title, language_code, rubrique, product_ref, 
        meta_keywords, meta_description, qa_data, last_updated
      FROM faq_search_view 
      WHERE 1=1
    `;
    const params = {};

    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode';
      params.languageCode = filters.languageCode;
    }

    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique';
      params.rubrique = filters.rubrique;
    }

    if (filters.productRef) {
      sql += ' AND product_ref = :productRef';
      params.productRef = filters.productRef;
    }

    if (filters.search) {
      sql += ' AND (MATCH(title, meta_keywords, meta_description) AGAINST(:search IN NATURAL LANGUAGE MODE))';
      params.search = filters.search;
    }

    sql += ' ORDER BY last_updated DESC';

    if (filters.limit) {
      const limitVal = parseInt(filters.limit, 10);
      if (!isNaN(limitVal) && limitVal > 0) {
        sql += ` LIMIT ${limitVal}`;
      }
    }

    const result = await this.query(sql, params);
    return result.rows;
  }

  async getFaqById(id) {
    const sql = 'SELECT * FROM faqs WHERE id = :id AND is_active = TRUE';
    const result = await this.query(sql, { id });
    return result.rows[0] || null;
  }

  async searchFaqs(searchTerm, filters = {}) {
    // Normalize search term - lowercase and clean for better matching
    const normalizedSearch = this.normalizeSearchTerm(searchTerm);
    
    // Create word variations for better matching
    const searchWords = this.extractSearchWords(normalizedSearch);
    
    // Build comprehensive search query with multiple strategies
    let sql = `
      SELECT 
        id, title, language_code, rubrique, product_ref,
        meta_keywords, meta_description, qa_data, last_updated,
        MATCH(title, meta_keywords, meta_description) AGAINST(:searchTerm IN NATURAL LANGUAGE MODE) as relevance,
        'fulltext' as search_type
      FROM faq_search_view 
      WHERE MATCH(title, meta_keywords, meta_description) AGAINST(:searchTerm IN NATURAL LANGUAGE MODE)
    `;
    
    // FIX 1: Initialize params ONLY with keys used as :placeholders in the SQL
    // (removed normalizedSearch which was causing the first error)
    const params = { 
      searchTerm: normalizedSearch
    };
    
    // Add filters for first query
    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode';
      params.languageCode = filters.languageCode;
    }
    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique';
      params.rubrique = filters.rubrique;
    }
    if (filters.productRef) {
      sql += ' AND product_ref = :productRef';
      params.productRef = filters.productRef;
    }
    
    // UNION: Case-insensitive JSON content search with multiple patterns
    sql += `
      UNION ALL
      SELECT 
        id, title, language_code, rubrique, product_ref,
        meta_keywords, meta_description, qa_data, last_updated,
        CASE
          WHEN (
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.question'))) LIKE :exactPattern OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question'))) LIKE :exactPattern
          ) THEN 3.0
          WHEN (
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.answer'))) LIKE :exactPattern OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer'))) LIKE :exactPattern
          ) THEN 2.5
          WHEN (
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.question'))) REGEXP :wordRegex OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question'))) REGEXP :wordRegex
          ) THEN 2.0
          WHEN (
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.answer'))) REGEXP :wordRegex OR
            LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer'))) REGEXP :wordRegex
          ) THEN 1.5
          ELSE 1.0
        END as relevance,
        'json_enhanced' as search_type
      FROM faq_search_view 
      WHERE (
        LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.question'))) LIKE :exactPattern
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question'))) LIKE :exactPattern
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.answer'))) LIKE :exactPattern
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer'))) LIKE :exactPattern
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.question'))) REGEXP :wordRegex
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question'))) REGEXP :wordRegex
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.answer'))) REGEXP :wordRegex
        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer'))) REGEXP :wordRegex
      )
    `;
    
    // Add exact and word-based patterns
    params.exactPattern = `%${normalizedSearch}%`;
    params.wordRegex = this.buildWordRegex(searchWords);
    
    // Add filters for second query
    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode2';
      params.languageCode2 = filters.languageCode;
    }
    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique2';
      params.rubrique2 = filters.rubrique;
    }
    if (filters.productRef) {
      sql += ' AND product_ref = :productRef2';
      params.productRef2 = filters.productRef;
    }
    
    // UNION: Individual word matching for broader results (only if we have words)
    if (searchWords.length > 0) {
      sql += `
        UNION ALL
        SELECT 
          id, title, language_code, rubrique, product_ref,
          meta_keywords, meta_description, qa_data, last_updated,
          1.2 as relevance,
          'word_match' as search_type
        FROM faq_search_view 
        WHERE (`;
      
      // Add individual word searches
      const wordConditions = [];
      searchWords.forEach((word, index) => {
        const wordParam = `word${index}`;
        wordConditions.push(`
          LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.question'))) LIKE :${wordParam}
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question'))) LIKE :${wordParam}
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$.data.answer'))) LIKE :${wordParam}
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer'))) LIKE :${wordParam}
          OR LOWER(title) LIKE :${wordParam}
        `);
        params[wordParam] = `%${word}%`;
      });
      
      sql += wordConditions.join(' OR ') + ')';
      
      // Add filters for third query
      if (filters.languageCode) {
        sql += ' AND language_code = :languageCode3';
        params.languageCode3 = filters.languageCode;
      }
      if (filters.rubrique) {
        sql += ' AND rubrique = :rubrique3';
        params.rubrique3 = filters.rubrique;
      }
      if (filters.productRef) {
        sql += ' AND product_ref = :productRef3';
        params.productRef3 = filters.productRef;
      }
    }
    
    // UNION: Fallback title and metadata search
    sql += `
      UNION ALL
      SELECT 
        id, title, language_code, rubrique, product_ref,
        meta_keywords, meta_description, qa_data, last_updated,
        0.8 as relevance,
        'metadata_like' as search_type
      FROM faq_search_view 
      WHERE (
        LOWER(title) LIKE :metaPattern
        OR LOWER(meta_keywords) LIKE :metaPattern
        OR LOWER(meta_description) LIKE :metaPattern
      )
    `;
    
    params.metaPattern = `%${normalizedSearch}%`;
    
    // Add filters for fourth query
    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode4';
      params.languageCode4 = filters.languageCode;
    }
    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique4';
      params.rubrique4 = filters.rubrique;
    }
    if (filters.productRef) {
      sql += ' AND product_ref = :productRef4';
      params.productRef4 = filters.productRef;
    }
    
    sql += ' ORDER BY relevance DESC, last_updated DESC';
    
    // FIX 2: Safely interpolate LIMIT as an integer to avoid MySQL2/MySQL 8.0 type bug with LIMIT ?
    if (filters.limit) {
      const limitVal = parseInt(filters.limit, 10);
      if (!isNaN(limitVal)) {
        sql += ` LIMIT ${limitVal}`;
      }
    }
    
    const result = await this.query(sql, params);
    
    // Remove duplicates and enhance scoring
    const uniqueResults = this.deduplicateAndScore(result.rows, normalizedSearch, searchWords);
    
    return uniqueResults;
  }

  /**
   * Build word regex for search matching
   */
  buildWordRegex(words) {
    if (words.length === 0) return '(?!x)x'; // Regex that matches nothing
    
    // Create regex that matches any of the words with word boundaries
    const escapedWords = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return `\\b(${escapedWords.join('|')})\\b`;
  }

  /**
   * Normalize search term for better matching
   */
  normalizeSearchTerm(searchTerm) {
    return searchTerm
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract meaningful words from search term
   */
  extractSearchWords(normalizedSearch) {
    const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'au', 'aux', 'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'que', 'qui', 'quoi', 'dont', 'où', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'nous', 'vous', 'se', 'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans', 'entre', 'chez', 'vers', 'depuis', 'pendant', 'avant', 'après', 'mais', 'car', 'donc', 'or', 'ni', 'soit']);
    
    return normalizedSearch
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => this.stemWord(word));
  }

  /**
   * Create word patterns for flexible matching
   */
  createWordPatterns(words) {
    return words.map(word => {
      // Create variations: exact, with common prefixes/suffixes
      const variations = [word];
      
      // Add common French word variations
      if (word.endsWith('er')) {
        variations.push(word.slice(0, -2) + 'e'); // contacter -> contacte
        variations.push(word.slice(0, -2) + 'ez'); // contacter -> contactez
      }
      
      if (word.endsWith('e')) {
        variations.push(word + 'r'); // contacte -> contacter
        variations.push(word + 's'); // contacte -> contactes
      }
      
      return variations;
    }).flat();
  }



  /**
   * Remove duplicates and enhance scoring based on match quality
   */
  deduplicateAndScore(rows, normalizedSearch, searchWords) {
    const uniqueResults = [];
    const seenIds = new Set();
    
    for (const row of rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        
        // Enhance relevance score based on match quality
        const enhancedScore = this.calculateEnhancedRelevance(row, normalizedSearch, searchWords);
        row.enhanced_relevance = enhancedScore;
        
        uniqueResults.push(row);
      }
    }
    
    // Sort by enhanced relevance
    return uniqueResults.sort((a, b) => b.enhanced_relevance - a.enhanced_relevance);
  }

  /**
   * Calculate enhanced relevance score
   */
  calculateEnhancedRelevance(row, normalizedSearch, searchWords) {
    let score = row.relevance || 0;
    
    try {
      const qaData = typeof row.qa_data === 'string' ? JSON.parse(row.qa_data) : row.qa_data;
      const title = (row.title || '').toLowerCase();
      
      // Extract questions and answers for scoring
      const questions = [];
      const answers = [];
      
      if (Array.isArray(qaData)) {
        qaData.forEach(entry => {
          if (entry && entry.data) {
            if (entry.data.question) questions.push(entry.data.question.toLowerCase());
            if (entry.data.answer) answers.push(entry.data.answer.toLowerCase());
          }
        });
      } else if (qaData && qaData.data) {
        if (qaData.data.question) questions.push(qaData.data.question.toLowerCase());
        if (qaData.data.answer) answers.push(qaData.data.answer.toLowerCase());
      }
      
      // Boost score for exact phrase matches
      if (questions.some(q => q.includes(normalizedSearch)) || 
          answers.some(a => a.includes(normalizedSearch)) ||
          title.includes(normalizedSearch)) {
        score += 2.0;
      }
      
      // Boost score for word matches
      const wordMatchScore = searchWords.reduce((acc, word) => {
        const questionMatches = questions.filter(q => q.includes(word)).length;
        const answerMatches = answers.filter(a => a.includes(word)).length;
        const titleMatches = title.includes(word) ? 1 : 0;
        
        return acc + (questionMatches * 0.8) + (answerMatches * 0.6) + (titleMatches * 0.4);
      }, 0);
      
      score += wordMatchScore;
      
    } catch (error) {
      // If JSON parsing fails, keep original score
    }
    
    return score;
  }

  /**
   * Enhanced stemming for French words
   */
  stemWord(word) {
    // Enhanced French stemming rules
    const frenchSuffixes = [
      { suffix: 'ation', replacement: '' },
      { suffix: 'tion', replacement: '' },
      { suffix: 'sion', replacement: '' },
      { suffix: 'ment', replacement: '' },
      { suffix: 'ique', replacement: '' },
      { suffix: 'able', replacement: '' },
      { suffix: 'ible', replacement: '' },
      { suffix: 'eur', replacement: '' },
      { suffix: 'euse', replacement: '' },
      { suffix: 'ant', replacement: '' },
      { suffix: 'ent', replacement: '' },
      { suffix: 'er', replacement: '' },
      { suffix: 'ir', replacement: '' },
      { suffix: 'oir', replacement: '' },
      { suffix: 'ez', replacement: '' },
      { suffix: 'ons', replacement: '' },
      { suffix: 'ont', replacement: '' },
      { suffix: 'ais', replacement: '' },
      { suffix: 'ait', replacement: '' },
      { suffix: 'es', replacement: '' },
      { suffix: 's', replacement: '' }
    ];

    let stemmed = word;
    for (const { suffix, replacement } of frenchSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        stemmed = word.slice(0, -suffix.length) + replacement;
        break;
      }
    }

    return stemmed;
  }
  /**
   * Search specifically in FAQ questions and answers (JSON content)
   * @param {string} searchTerm 
   * @param {Object} filters 
   * @returns {Array}
   */
  async searchFaqContent(searchTerm, filters = {}) {
    let sql = `
      SELECT 
        id, title, language_code, rubrique, product_ref,
        meta_keywords, meta_description, qa_data, last_updated
      FROM faq_search_view 
      WHERE (
        JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.question')) LIKE :searchPattern
        OR JSON_UNQUOTE(JSON_EXTRACT(qa_data, '$[*].data.answer')) LIKE :searchPattern
        OR title LIKE :searchPattern
        OR meta_keywords LIKE :searchPattern
        OR meta_description LIKE :searchPattern
      )
    `;
    
    const params = { 
      searchPattern: `%${searchTerm}%`
    };

    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode';
      params.languageCode = filters.languageCode;
    }

    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique';
      params.rubrique = filters.rubrique;
    }

    if (filters.productRef) {
      sql += ' AND product_ref = :productRef';
      params.productRef = filters.productRef;
    }

    sql += ' ORDER BY last_updated DESC';

    if (filters.limit) {
      const limitVal = parseInt(filters.limit, 10);
      if (!isNaN(limitVal) && limitVal > 0) {
        sql += ` LIMIT ${limitVal}`;
      }
    }

    const result = await this.query(sql, params);
    return result.rows;
  }

  // Conversation-related database methods
  async createConversation(conversationData) {
    const sql = `
      INSERT INTO conversations 
      (session_id, language_code, rubrique, product_code, user_ip, user_agent)
      VALUES (:sessionId, :languageCode, :rubrique, :productCode, :userIp, :userAgent)
    `;
    
    const result = await this.query(sql, {
      sessionId: conversationData.sessionId,
      languageCode: conversationData.languageCode,
      rubrique: conversationData.rubrique,
      productCode: conversationData.productCode || null,
      userIp: conversationData.userIp || null,
      userAgent: conversationData.userAgent || null
    });

    return result.rows.insertId;
  }

  async getConversation(sessionId) {
    const sql = 'SELECT * FROM conversations WHERE session_id = :sessionId';
    const result = await this.query(sql, { sessionId });
    return result.rows[0] || null;
  }

  async updateConversationStatus(conversationId, status, additionalData = {}) {
    let sql = 'UPDATE conversations SET status = :status, updated_at = CURRENT_TIMESTAMP';
    const params = { conversationId, status };

    if (additionalData.satisfactionRating) {
      sql += ', satisfaction_rating = :satisfactionRating';
      params.satisfactionRating = additionalData.satisfactionRating;
    }

    if (additionalData.zendeskTicketId) {
      sql += ', zendesk_ticket_id = :zendeskTicketId';
      params.zendeskTicketId = additionalData.zendeskTicketId;
    }

    if (status === 'resolved' || status === 'escalated' || status === 'abandoned') {
      sql += ', ended_at = CURRENT_TIMESTAMP';
    }

    sql += ' WHERE id = :conversationId';

    await this.query(sql, params);
  }

  // Chat message-related database methods
  async saveMessage(messageData) {
    const sql = `
      INSERT INTO chat_messages 
      (conversation_id, message_type, message_text, faq_id, response_time_ms)
      VALUES (:conversationId, :messageType, :messageText, :faqId, :responseTimeMs)
    `;

    const result = await this.query(sql, {
      conversationId: messageData.conversationId,
      messageType: messageData.messageType,
      messageText: messageData.messageText,
      faqId: messageData.faqId || null,
      responseTimeMs: messageData.responseTimeMs || null
    });

    return result.rows.insertId;
  }

  async getConversationMessages(conversationId, limit = 50) {
    let sql = `
      SELECT cm.*, f.title as faq_title
      FROM chat_messages cm
      LEFT JOIN faqs f ON cm.faq_id = f.id
      WHERE cm.conversation_id = :conversationId
      ORDER BY cm.created_at ASC
    `;

    const queryParams = { conversationId };

    const limitVal = parseInt(limit, 10);
    if (!isNaN(limitVal) && limitVal > 0) {
      sql += ` LIMIT ${limitVal}`;
    }

    const result = await this.query(sql, queryParams);
    return result.rows;
  }

  // Analytics and reporting methods
  async getConversationStats(dateFrom, dateTo, filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_conversations,
        COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_conversations,
        AVG(satisfaction_rating) as avg_satisfaction,
        AVG(TIMESTAMPDIFF(SECOND, created_at, ended_at)) as avg_duration_seconds
      FROM conversations
      WHERE created_at BETWEEN :dateFrom AND :dateTo
    `;
    const params = { dateFrom, dateTo };

    if (filters.rubrique) {
      sql += ' AND rubrique = :rubrique';
      params.rubrique = filters.rubrique;
    }

    if (filters.languageCode) {
      sql += ' AND language_code = :languageCode';
      params.languageCode = filters.languageCode;
    }

    const result = await this.query(sql, params);
    return result.rows[0];
  }

  // Health check method
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows[0].health_check === 1;
    } catch (error) {
      return false;
    }
  }
}

module.exports = Database;