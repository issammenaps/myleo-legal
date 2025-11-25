const { v4: uuidv4 } = require('uuid');

class ChatService {
  constructor({ database, cache, language, zendesk, config, logger, ragSearch }) {
    this.database = database;
    this.cache = cache;
    this.language = language;
    this.zendesk = zendesk;
    this.config = config;
    this.logger = logger;
    this.ragSearch = ragSearch || null;
    
    // In-memory sessions for active conversations
    this.activeSessions = new Map();
    
    // Set up session cleanup interval
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Run every minute
  }

  /**
   * Start a new conversation
   * @param {Object} params 
   * @returns {Object}
   */
  async startConversation(params) {
    try {
      const {
        language = this.config.defaultLanguage,
        rubrique = 'general',
        productCode,
        userIp,
        userAgent
      } = params;

      // Validate language
      if (!this.language.isLanguageSupported(language)) {
        throw new Error(`Language ${language} is not supported`);
      }

      // Generate session ID
      const sessionId = uuidv4();

      // Create conversation in database
      const conversationData = {
        sessionId,
        languageCode: language,
        rubrique,
        productCode,
        userIp,
        userAgent
      };

      const conversationId = await this.database.createConversation(conversationData);

      // Store session in memory
      const session = {
        id: conversationId,
        sessionId,
        languageCode: language,
        rubrique,
        productCode,
        messageCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active'
      };

      this.activeSessions.set(sessionId, session);

      // Get welcome message
      const context = {};
      if (productCode) {
        // Try to get product name from FAQ data
        const productFaq = await this.findProductFaq(productCode, language);
        if (productFaq) {
          context.productName = productFaq.product_name;
        }
      }

      const welcomeMessage = this.language.getWelcomeMessage(language, context);

      // Save welcome message
      await this.database.saveMessage({
        conversationId,
        messageType: 'bot',
        messageText: welcomeMessage,
        responseTimeMs: 0
      });

      this.logger.logChat(sessionId, 'conversation_started', welcomeMessage, {
        language,
        rubrique,
        productCode
      });

      return {
        success: true,
        sessionId,
        conversationId,
        welcomeMessage,
        language,
        rubrique,
        productCode
      };

    } catch (error) {
      this.logger.logError(error, { 
        action: 'start_conversation',
        params: Object.keys(params)
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process user message and generate response
   * @param {string} sessionId 
   * @param {string} message 
   * @returns {Object}
   */
  async processMessage(sessionId, message) {
    const startTime = Date.now();
    
    try {
      // Validate session
      let session = this.activeSessions.get(sessionId);
      if (!session) {
        const dbConversation = await this.database.getConversation(sessionId);
        if (!dbConversation) {
          throw new Error('Invalid session');
        }
        
        // Restore session from database
        this.restoreSession(dbConversation);
        session = this.activeSessions.get(sessionId);
      }

      // Check session limits
      if (session.messageCount >= this.config.maxMessagesPerSession) {
        throw new Error('Maximum messages per session exceeded');
      }

      // Validate message
      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (message.length > this.config.maxMessageLength) {
        throw new Error('Message too long');
      }

      // Update session activity
      session.lastActivity = new Date();
      session.messageCount++;

      // Save user message
      await this.database.saveMessage({
        conversationId: session.id,
        messageType: 'user',
        messageText: message.trim()
      });

      this.logger.logChat(sessionId, 'user', message, {
        messageCount: session.messageCount
      });

      // Check if this is a special suggestion click
      const specialResponse = await this.handleSpecialSuggestions(message.trim(), session);
      if (specialResponse) {
        const responseTime = Date.now() - startTime;
        
        // Save bot response
        await this.database.saveMessage({
          conversationId: session.id,
          messageType: 'bot',
          messageText: specialResponse.message,
          responseTimeMs: responseTime
        });

        this.logger.logChat(sessionId, 'bot', specialResponse.message, {
          responseTime: `${responseTime}ms`,
          specialSuggestion: true
        });

        return {
          success: true,
          message: specialResponse.message,
          suggestions: specialResponse.suggestions || [],
          responseTime: responseTime,
          canEscalate: specialResponse.canEscalate || false
        };
      }

      // Search for FAQ answers
      const response = await this.searchFaqResponse(message, session);
      const responseTime = Date.now() - startTime;

      // Save bot response
      await this.database.saveMessage({
        conversationId: session.id,
        messageType: 'bot',
        messageText: response.message,
        faqId: response.faqId,
        responseTimeMs: responseTime
      });

      this.logger.logChat(sessionId, 'bot', response.message, {
        responseTime: `${responseTime}ms`,
        faqId: response.faqId,
        foundAnswer: !!response.faqId,
        rag: response.metadata?.rag || false,
        candidateCount: response.metadata?.totalCandidates || 0
      });

      return {
        success: true,
        message: response.message,
        faqId: response.faqId,
        suggestions: response.suggestions || [],
        responseTime: responseTime,
        canEscalate: typeof response.canEscalate === 'boolean' ? response.canEscalate : !response.faqId,
        sources: response.sources || [],
        metadata: response.metadata || null
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.logError(error, {
        action: 'process_message',
        sessionId,
        message: message?.substring(0, 50),
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        error: error.message,
        responseTime: responseTime
      };
    }
  }

  /**
   * Search FAQ for relevant responses
   * @param {string} query 
   * @param {Object} session 
   * @returns {Object}
   */
  async searchFaqResponse(query, session) {
    if (this.ragSearch) {
      const ragResponse = await this.getRagEnhancedResponse(query, session);
      if (ragResponse) {
        return ragResponse;
      }
    }

    return this.searchFaqResponseLegacy(query, session);
  }

  async searchFaqResponseLegacy(query, session) {
    try {
      // Normalize query for better caching and matching
      const normalizedQuery = this.normalizeQuery(query);
      
      // Check cache first
      const cacheKey = this.cache.getFaqSearchKey(normalizedQuery, {
        languageCode: session.languageCode,
        rubrique: session.rubrique,
        productCode: session.productCode
      });

      let faqResults = this.cache.get(cacheKey);

      if (!faqResults) {
        // Search database with enhanced search
        const filters = {
          languageCode: session.languageCode,
          rubrique: session.rubrique,
          limit: this.config.maxSearchResults
        };

        if (session.productCode) {
          filters.productRef = session.productCode;
        }

        // Use the enhanced search method
        faqResults = await this.database.searchFaqs(query, filters);
        
        // If still no results, try a broader search without rubrique filter
        if (faqResults.length === 0 && filters.rubrique !== 'general') {
          this.logger.info('No results found with rubrique filter, trying broader search', {
            originalRubrique: filters.rubrique,
            query: query.substring(0, 50)
          });
          
          const broaderFilters = { ...filters };
          delete broaderFilters.rubrique; // Remove rubrique filter
          faqResults = await this.database.searchFaqs(query, broaderFilters);
        }
        
        // Cache results
        this.cache.set(cacheKey, faqResults, 300000); // 5 minutes
      }

      this.logger.logFaqSearch(query, faqResults, {
        sessionId: session.sessionId,
        languageCode: session.languageCode,
        rubrique: session.rubrique,
        resultsCount: faqResults.length
      });

      if (faqResults.length === 0) {
        return {
          message: this.language.get('messages.noResults', session.languageCode),
          faqId: null,
          suggestions: this.getNoResultsSuggestions(session.languageCode)
        };
      }

      // Find best matching Q&A within FAQ results using enhanced matching
      const bestMatch = this.findBestQAMatchEnhanced(query, faqResults, session.languageCode);

      if (bestMatch) {
        this.logger.info('Found FAQ match', {
          sessionId: session.sessionId,
          faqId: bestMatch.faqId,
          score: bestMatch.score,
          matchType: bestMatch.matchType
        });

        return {
          message: bestMatch.answer,
          faqId: bestMatch.faqId,
          suggestions: this.getFollowUpSuggestions(session.languageCode)
        };
      }

      // No specific Q&A match found, but we have FAQ results
      // Return a generic response with suggestions to be more specific
      return {
        message: 'J\'ai trouvé quelques informations qui pourraient vous aider. Pouvez-vous être plus spécifique dans votre question ?',
        faqId: null,
        suggestions: this.getNoResultsSuggestions(session.languageCode)
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'search_faq',
        query: query.substring(0, 50),
        sessionId: session.sessionId
      });

      return {
        message: this.language.get('messages.error', session.languageCode),
        faqId: null,
        suggestions: []
      };
    }
  }

  async getRagEnhancedResponse(query, session) {
    try {
      const ragResult = await this.ragSearch.retrieve(query, session);
      if (!ragResult || !ragResult.topCandidates || ragResult.topCandidates.length === 0) {
        return null;
      }

      const candidateRows = ragResult.topCandidates.map(candidate => candidate.row);
      const primaryMatch = this.findBestQAMatchEnhanced(query, candidateRows, session.languageCode);

      if (!primaryMatch) {
        return null;
      }

      const supportingMatches = [];
      for (const candidate of ragResult.topCandidates) {
        if (candidate.faqId === primaryMatch.faqId) continue;
        const supportMatch = this.findBestQAMatchEnhanced(query, [candidate.row], session.languageCode);
        if (supportMatch && supportMatch.faqId !== primaryMatch.faqId) {
          supportingMatches.push(supportMatch);
        }
      }

      const responseMessage = this.composeRagMessage(primaryMatch, supportingMatches);

      return {
        message: responseMessage,
        faqId: primaryMatch.faqId,
        suggestions: this.getFollowUpSuggestions(session.languageCode),
        sources: ragResult.topCandidates.map(candidate => ({
          faqId: candidate.faqId,
          title: candidate.row.title,
          rubrique: candidate.row.rubrique,
          reasons: candidate.sources
        })),
        metadata: {
          rag: true,
          variantCount: ragResult.variants.length,
          totalCandidates: ragResult.rankedCandidates.length
        }
      };
    } catch (error) {
      this.logger.logError(error, {
        action: 'rag_response',
        sessionId: session.sessionId
      });
      return null;
    }
  }

  composeRagMessage(primaryMatch, supportingMatches = []) {
    let message = primaryMatch.answer;

    if (supportingMatches.length > 0) {
      const helpfulPoints = supportingMatches
        .slice(0, 2)
        .map(match => `• ${match.answer}`)
        .join('\n');

      message += `\n\nAutres informations utiles :\n${helpfulPoints}`;
    }

    return message;
  }

  /**
   * Normalize query for better processing
   * @param {string} query 
   * @returns {string}
   */
  normalizeQuery(query) {
    return query
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[?!.]+$/, ''); // Remove trailing punctuation
  }

  /**
   * Enhanced Q&A matching with better case-insensitive and semantic matching
   * @param {string} query 
   * @param {Array} faqResults 
   * @param {string} language 
   * @returns {Object|null}
   */
  findBestQAMatchEnhanced(query, faqResults, language) {
    const queryLower = query.toLowerCase().trim();
    const queryWords = this.extractQueryWords(queryLower);
    
    let bestMatch = null;
    let bestScore = 0;

    for (const faq of faqResults) {
      try {
        const qaData = typeof faq.qa_data === 'string' ? 
          JSON.parse(faq.qa_data) : faq.qa_data;

        // Handle both array and single object formats
        const qaEntries = Array.isArray(qaData) ? qaData : [qaData];

        for (const qaEntry of qaEntries) {
          if (qaEntry && qaEntry.code === 'app.faq_entry' && qaEntry.data) {
            const question = (qaEntry.data.question || '').toLowerCase();
            const answer = qaEntry.data.answer || '';

            // Calculate multiple similarity scores
            const exactScore = this.calculateExactMatchScore(queryLower, question);
            const semanticScore = this.calculateSemanticScore(queryWords, question);
            const partialScore = this.calculatePartialMatchScore(queryLower, question);
            const wordOrderScore = this.calculateWordOrderScore(queryWords, question);

            // Combined weighted score
            const totalScore = (
              exactScore * 0.4 +
              semanticScore * 0.3 +
              partialScore * 0.2 +
              wordOrderScore * 0.1
            );

            // Use enhanced relevance from database if available
            const dbRelevance = faq.enhanced_relevance || faq.relevance || 0;
            const finalScore = totalScore + (dbRelevance * 0.1);

            // Lower threshold for better matching
            const threshold = this.config.searchThreshold || 0.3;
            if (finalScore > bestScore && finalScore >= threshold) {
              bestScore = finalScore;
              bestMatch = {
                faqId: faq.id,
                question: qaEntry.data.question,
                answer: answer,
                score: finalScore,
                matchType: this.getMatchType(exactScore, semanticScore, partialScore)
              };
            }
          }
        }
      } catch (error) {
        this.logger.error('Error parsing FAQ qa_data:', {
          faqId: faq.id,
          error: error.message
        });
      }
    }

    return bestMatch;
  }

  /**
   * Extract meaningful words from query
   */
  extractQueryWords(query) {
    const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'au', 'aux', 'ce', 'cette', 'ces', 'comment', 'que', 'qui', 'quoi', 'où', 'quand', 'pourquoi', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'puis', 'peux', 'peut', 'pouvez', 'peuvent']);
    
    return query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => this.stemWord(word));
  }

  /**
   * Calculate exact match score
   */
  calculateExactMatchScore(query, question) {
    if (question.includes(query)) return 1.0;
    if (query.includes(question)) return 0.9;
    
    // Check for key phrase matches
    const keyPhrases = [
      'contacter le support',
      'contact support', 
      'joindre le support',
      'appeler le support',
      'comment contacter',
      'contacter',
      'puis-je contacter'
    ];
    
    for (const phrase of keyPhrases) {
      if ((query.includes(phrase) || phrase.includes(query)) && 
          (question.includes('contacter') || question.includes('contact'))) {
        return 0.9;
      }
    }
    
    return 0;
  }

  /**
   * Calculate semantic similarity score
   */
  calculateSemanticScore(queryWords, question) {
    if (queryWords.length === 0) return 0;
    
    const questionWords = this.extractQueryWords(question);
    let matches = 0;
    
    for (const queryWord of queryWords) {
      if (questionWords.includes(queryWord)) {
        matches++;
      } else {
        // Check for semantic matches
        const synonyms = this.getSynonyms(queryWord);
        if (synonyms.some(syn => questionWords.includes(syn))) {
          matches += 0.8; // Partial credit for synonyms
        }
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Calculate partial match score for substrings
   */
  calculatePartialMatchScore(query, question) {
    const queryWords = query.split(/\s+/);
    let partialMatches = 0;
    
    for (const word of queryWords) {
      if (word.length > 3 && question.includes(word)) {
        partialMatches++;
      }
    }
    
    return queryWords.length > 0 ? partialMatches / queryWords.length : 0;
  }

  /**
   * Calculate word order score (bonus for words appearing in similar order)
   */
  calculateWordOrderScore(queryWords, question) {
    if (queryWords.length < 2) return 0;
    
    let orderMatches = 0;
    const questionWords = this.extractQueryWords(question);
    
    for (let i = 0; i < queryWords.length - 1; i++) {
      const word1Index = questionWords.indexOf(queryWords[i]);
      const word2Index = questionWords.indexOf(queryWords[i + 1]);
      
      if (word1Index !== -1 && word2Index !== -1 && word1Index < word2Index) {
        orderMatches++;
      }
    }
    
    return queryWords.length > 1 ? orderMatches / (queryWords.length - 1) : 0;
  }

  /**
   * Get match type for logging
   */
  getMatchType(exactScore, semanticScore, partialScore) {
    if (exactScore > 0.8) return 'exact';
    if (semanticScore > 0.7) return 'semantic';
    if (partialScore > 0.6) return 'partial';
    return 'weak';
  }

  /**
   * Get synonyms for better semantic matching
   */
  getSynonyms(word) {
    const synonymMap = {
      'contacter': ['contact', 'joindre', 'appeler', 'telephoner', 'ecrire', 'communication'],
      'contact': ['contacter', 'joindre', 'appeler', 'telephoner', 'ecrire', 'communication'],
      'support': ['aide', 'assistance', 'service', 'client', 'soutien'],
      'aide': ['support', 'assistance', 'service', 'soutien'],
      'horaire': ['heure', 'ouverture', 'fermeture', 'disponible', 'planning'],
      'prix': ['cout', 'tarif', 'montant', 'frais', 'facture'],
      'probleme': ['souci', 'difficulte', 'erreur', 'bug', 'dysfonctionnement'],
      'compte': ['profil', 'utilisateur', 'client', 'espace'],
      'produit': ['service', 'offre', 'solution', 'prestation'],
      'paiement': ['reglement', 'facture', 'transaction', 'versement'],
      'inscription': ['enregistrement', 'creation', 'souscription'],
      'connexion': ['login', 'authentification', 'acces', 'identification'],
      'joindre': ['contacter', 'contact', 'appeler', 'telephoner'],
      'appeler': ['contacter', 'contact', 'joindre', 'telephoner']
    };

    return synonymMap[word] || [];
  }

  /**
   * Find best Q&A match within FAQ results
   * @param {string} query 
   * @param {Array} faqResults 
   * @param {string} language 
   * @returns {Object|null}
   */
  findBestQAMatch(query, faqResults, language) {
    const queryLower = query.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const faq of faqResults) {
      try {
        const qaData = typeof faq.qa_data === 'string' ? 
          JSON.parse(faq.qa_data) : faq.qa_data;

        // Ensure qaData is an array
        if (Array.isArray(qaData)) {
          for (const qaEntry of qaData) {
            if (qaEntry && qaEntry.code === 'app.faq_entry' && qaEntry.data) {
              const question = qaEntry.data.question?.toLowerCase() || '';
              const answer = qaEntry.data.answer || '';

              // Simple text similarity scoring
              const score = this.calculateTextSimilarity(queryLower, question);

              if (score > bestScore && score >= this.config.searchThreshold) {
                bestScore = score;
                bestMatch = {
                  faqId: faq.id,
                  question: qaEntry.data.question,
                  answer: answer,
                  score: score
                };
              }
            }
          }
        } else if (qaData && qaData.code === 'app.faq_entry' && qaData.data) {
          // Handle single object case
          const question = qaData.data.question?.toLowerCase() || '';
          const answer = qaData.data.answer || '';

          const score = this.calculateTextSimilarity(queryLower, question);

          if (score > bestScore && score >= this.config.searchThreshold) {
            bestScore = score;
            bestMatch = {
              faqId: faq.id,
              question: qaData.data.question,
              answer: answer,
              score: score
            };
          }
        }
      } catch (error) {
        this.logger.error('Error parsing FAQ qa_data:', {
          faqId: faq.id,
          error: error.message
        });
      }
    }

    return bestMatch;
  }

  /**
   * Calculate semantic similarity between query and question
   * @param {string} query 
   * @param {string} question 
   * @returns {number} Similarity score between 0 and 1
   */
  calculateTextSimilarity(query, question) {
    if (!query || !question) return 0;

    const queryLower = query.toLowerCase().trim();
    const questionLower = question.toLowerCase().trim();

    // Exact match gets highest score
    if (queryLower === questionLower) return 1.0;

    // Substring match gets high score
    if (questionLower.includes(queryLower) || queryLower.includes(questionLower)) {
      return 0.9;
    }

    // Normalize text for better matching
    const normalizeText = (text) => {
      return text
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .split(' ')
        .filter(w => w.length > 2) // Filter short words
        .map(w => this.stemWord(w)); // Basic stemming
    };

    const queryWords = normalizeText(queryLower);
    const questionWords = normalizeText(questionLower);

    if (queryWords.length === 0 || questionWords.length === 0) return 0;

    // Calculate different similarity metrics
    const exactMatches = this.calculateExactMatches(queryWords, questionWords);
    const partialMatches = this.calculatePartialMatches(queryWords, questionWords);
    const semanticMatches = this.calculateSemanticMatches(queryWords, questionWords);
    const positionBonus = this.calculatePositionBonus(queryWords, questionWords);

    // Weighted combination of different similarity measures
    const similarity = (
      exactMatches * 0.4 +
      partialMatches * 0.25 +
      semanticMatches * 0.25 +
      positionBonus * 0.1
    );

    return Math.min(similarity, 1.0);
  }

  /**
   * Basic French stemming for better word matching
   * @param {string} word 
   * @returns {string}
   */
  stemWord(word) {
    // Basic French stemming rules
    const frenchSuffixes = [
      'tion', 'sion', 'ment', 'ique', 'able', 'ible', 'eur', 'euse',
      'ant', 'ent', 'ais', 'ait', 'ons', 'ez', 'ont', 'er', 'ir', 'oir'
    ];

    let stemmed = word;
    for (const suffix of frenchSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        stemmed = word.slice(0, -suffix.length);
        break;
      }
    }

    return stemmed;
  }

  /**
   * Calculate exact word matches
   */
  calculateExactMatches(queryWords, questionWords) {
    let matches = 0;
    for (const queryWord of queryWords) {
      if (questionWords.includes(queryWord)) {
        matches++;
      }
    }
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Calculate partial word matches (substring matching)
   */
  calculatePartialMatches(queryWords, questionWords) {
    let matches = 0;
    for (const queryWord of queryWords) {
      if (questionWords.some(qw => qw.includes(queryWord) || queryWord.includes(qw))) {
        matches += 0.7; // Partial match gets lower weight
      }
    }
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Calculate semantic matches using synonyms and related terms
   */
  calculateSemanticMatches(queryWords, questionWords) {
    const synonyms = {
      'contact': ['contacter', 'joindre', 'appeler', 'telephoner', 'ecrire'],
      'support': ['aide', 'assistance', 'service', 'client'],
      'horaire': ['heure', 'ouverture', 'fermeture', 'disponible'],
      'prix': ['cout', 'tarif', 'montant', 'frais'],
      'probleme': ['souci', 'difficulte', 'erreur', 'bug'],
      'compte': ['profil', 'utilisateur', 'client'],
      'produit': ['service', 'offre', 'solution'],
      'paiement': ['reglement', 'facture', 'transaction'],
      'inscription': ['enregistrement', 'creation', 'compte'],
      'connexion': ['login', 'authentification', 'acces']
    };

    let semanticScore = 0;
    for (const queryWord of queryWords) {
      for (const [key, syns] of Object.entries(synonyms)) {
        if (queryWord === key || syns.includes(queryWord)) {
          if (questionWords.includes(key) || questionWords.some(qw => syns.includes(qw))) {
            semanticScore += 0.8; // Semantic match gets good weight
          }
        }
      }
    }

    return queryWords.length > 0 ? Math.min(semanticScore / queryWords.length, 1.0) : 0;
  }

  /**
   * Calculate position bonus for words appearing early in the question
   */
  calculatePositionBonus(queryWords, questionWords) {
    let positionScore = 0;
    const maxPosition = Math.min(questionWords.length, 5); // Only consider first 5 words

    for (let i = 0; i < maxPosition; i++) {
      if (queryWords.includes(questionWords[i])) {
        positionScore += (maxPosition - i) / maxPosition; // Higher score for earlier positions
      }
    }

    return queryWords.length > 0 ? positionScore / queryWords.length : 0;
  }

  /**
   * Get suggestions when no results found
   * @param {string} language 
   * @returns {Array}
   */
  getNoResultsSuggestions(language) {
    return [
      this.language.get('suggestions.contactSupport', language),
      this.language.get('suggestions.searchFaq', language)
    ];
  }

  /**
   * Get follow-up suggestions after providing an answer
   * @param {string} language 
   * @returns {Array}
   */
  getFollowUpSuggestions(language) {
    return [
      this.language.get('suggestions.moreHelp', language),
      this.language.get('suggestions.contactSupport', language)
    ];
  }

  /**
   * Handle special suggestion clicks that shouldn't be treated as normal questions
   * @param {string} message 
   * @param {Object} session 
   * @returns {Object|null}
   */
  async handleSpecialSuggestions(message, session) {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Get translated suggestions to compare against
    const moreHelpText = this.language.get('suggestions.moreHelp', session.languageCode);
    const contactSupportText = this.language.get('suggestions.contactSupport', session.languageCode);
    const searchFaqText = this.language.get('suggestions.searchFaq', session.languageCode);
    
    // Handle "Avez-vous besoin d'aide sur autre chose ?" / "Do you need help with something else?"
    if (normalizedMessage === moreHelpText.toLowerCase()) {
      return {
        message: 'Bien sûr ! Posez-moi votre question et je ferai de mon mieux pour vous aider. Vous pouvez me demander des informations sur MyLeo, nos services, comment participer à une action collective, ou tout autre sujet.',
        suggestions: [
          'Qui êtes-vous ?',
          'Comment participer à une action ?',
          'Quels sont vos horaires ?',
          'Comment vous contacter ?'
        ],
        canEscalate: false
      };
    }
    
    // Handle "Rechercher dans la FAQ"
    if (normalizedMessage === searchFaqText.toLowerCase()) {
      return {
        message: 'Parfait ! Posez-moi votre question et je rechercherai dans notre base de connaissances pour vous fournir la meilleure réponse possible.',
        suggestions: [
          'Comment contacter le support ?',
          'Quels sont vos horaires ?',
          'Comment participer ?',
          'Qui êtes-vous ?'
        ],
        canEscalate: false
      };
    }
    
    // Handle "Oui, créer un ticket"
    if (normalizedMessage.includes('oui') && normalizedMessage.includes('ticket')) {
      return {
        message: 'Parfait ! Je vais créer un ticket support pour vous. Veuillez remplir le formulaire ci-dessous avec vos informations.',
        suggestions: [],
        canEscalate: true
      };
    }
    
    // Handle "Créer un ticket support"
    if (normalizedMessage.includes('créer') && normalizedMessage.includes('ticket')) {
      return {
        message: 'Je vais créer un ticket support pour vous. Veuillez remplir le formulaire ci-dessous avec vos informations.',
        suggestions: [],
        canEscalate: true
      };
    }
    
    // Handle "Contacter le support" - search FAQ first, then escalate if needed
    if (normalizedMessage === contactSupportText.toLowerCase() || 
        normalizedMessage.includes('contacter') && normalizedMessage.includes('support')) {
      
      // Search directly in database for contact support FAQ with broader filters
      const filters = {
        languageCode: session.languageCode,
        limit: 10
      };
      
      // Try multiple search terms to find contact support info
      let faqResults = await this.database.searchFaqs('comment contacter support', filters);
      
      if (faqResults.length === 0) {
        faqResults = await this.database.searchFaqs('contacter', filters);
      }
      
      if (faqResults.length === 0) {
        faqResults = await this.database.searchFaqs('support', filters);
      }
      
      // If we found FAQ results, find the best match
      if (faqResults.length > 0) {
        const bestMatch = this.findBestQAMatchEnhanced('comment contacter support', faqResults, session.languageCode);
        
        if (bestMatch && bestMatch.score >= 0.2) { // Lower threshold for contact support
          return {
            message: bestMatch.answer,
            faqId: bestMatch.faqId,
            suggestions: [
              'Créer un ticket support',
              'Autres questions ?'
            ],
            canEscalate: true // Allow escalation after showing contact info
          };
        }
      }
      
      // Fallback response with direct contact information if no FAQ found
      return {
        message: 'Vous pouvez nous contacter via ce chat, par email à contact@myleo.legal ou par téléphone au 05 67 700 484. Nos horaires : du lundi au vendredi de 9h à 18h.',
        suggestions: [
          'Créer un ticket support',
          'Autres questions ?'
        ],
        canEscalate: true
      };
    }
    
    // Not a special suggestion
    return null;
  }

  /**
   * End conversation
   * @param {string} sessionId 
   * @param {Object} feedback 
   * @returns {Object}
   */
  async endConversation(sessionId, feedback = {}) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }

      // Update conversation status
      const additionalData = {};
      if (feedback.rating) {
        additionalData.satisfactionRating = feedback.rating;
      }

      await this.database.updateConversationStatus(
        session.id, 
        'resolved', 
        additionalData
      );

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      this.logger.info('Conversation ended', {
        sessionId,
        duration: Date.now() - session.createdAt.getTime(),
        messageCount: session.messageCount,
        rating: feedback.rating
      });

      return {
        success: true,
        message: this.language.get('rating.thanks', session.languageCode)
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'end_conversation',
        sessionId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Escalate conversation to Zendesk
   * @param {string} sessionId 
   * @param {Object} contactData 
   * @returns {Object}
   */
  async escalateToZendesk(sessionId, contactData) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }

      // Get conversation messages
      const messages = await this.database.getConversationMessages(session.id);
      
      const conversationData = {
        sessionId,
        languageCode: session.languageCode,
        rubrique: session.rubrique,
        productCode: session.productCode,
        messages
      };

      // Create Zendesk ticket
      const ticketResult = await this.zendesk.escalateConversation(
        conversationData, 
        contactData
      );

      if (ticketResult.success) {
        // Update conversation status
        await this.database.updateConversationStatus(
          session.id,
          'escalated',
          { zendeskTicketId: ticketResult.ticketId }
        );

        // Remove from active sessions
        this.activeSessions.delete(sessionId);

        this.logger.info('Conversation escalated to Zendesk', {
          sessionId,
          ticketId: ticketResult.ticketId,
          ticketUrl: ticketResult.ticketUrl
        });

        return {
          success: true,
          ticketId: ticketResult.ticketId,
          ticketUrl: ticketResult.ticketUrl,
          message: this.language.get('escalation.success', session.languageCode)
        };
      } else {
        return {
          success: false,
          error: ticketResult.error,
          validationErrors: ticketResult.validationErrors,
          message: this.language.get('escalation.error', session.languageCode)
        };
      }

    } catch (error) {
      this.logger.logError(error, {
        action: 'escalate_conversation',
        sessionId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get conversation history
   * @param {string} sessionId 
   * @returns {Object}
   */
  async getConversationHistory(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        const dbConversation = await this.database.getConversation(sessionId);
        if (!dbConversation) {
          throw new Error('Invalid session');
        }
      }

      const conversationData = await this.database.getConversation(sessionId);
      const messages = await this.database.getConversationMessages(conversationData.id);

      return {
        success: true,
        conversation: conversationData,
        messages: messages
      };

    } catch (error) {
      this.logger.logError(error, {
        action: 'get_conversation_history',
        sessionId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find product FAQ for context
   * @param {string} productCode 
   * @param {string} language 
   * @returns {Object|null}
   */
  async findProductFaq(productCode, language) {
    try {
      const faqs = await this.database.getFaqs({
        languageCode: language,
        productRef: productCode,
        limit: 1
      });

      return faqs.length > 0 ? faqs[0] : null;
    } catch (error) {
      this.logger.error('Failed to find product FAQ:', {
        productCode,
        language,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Restore session from database
   * @param {Object} dbConversation 
   */
  restoreSession(dbConversation) {
    const session = {
      id: dbConversation.id,
      sessionId: dbConversation.session_id,
      languageCode: dbConversation.language_code,
      rubrique: dbConversation.rubrique,
      productCode: dbConversation.product_code,
      messageCount: 0, // Will be updated if needed
      createdAt: new Date(dbConversation.created_at),
      lastActivity: new Date(),
      status: dbConversation.status
    };

    this.activeSessions.set(dbConversation.session_id, session);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.activeSessions) {
      const timeSinceActivity = now - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.config.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.activeSessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    return {
      activeSessions: this.activeSessions.size,
      config: {
        maxMessagesPerSession: this.config.maxMessagesPerSession,
        sessionTimeout: this.config.sessionTimeout,
        maxMessageLength: this.config.maxMessageLength,
        searchThreshold: this.config.searchThreshold,
        maxSearchResults: this.config.maxSearchResults
      },
      cache: this.cache.getStats()
    };
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy() {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    this.activeSessions.clear();
  }
}

module.exports = ChatService;