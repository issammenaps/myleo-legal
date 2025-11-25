class RagSearchService {
  constructor({ database, cache, config = {}, logger }) {
    this.database = database;
    this.cache = cache;
    this.logger = logger;
    this.config = {
      maxQueryVariants: config.maxQueryVariants || 4,
      maxCandidatesPerVariant: config.maxCandidatesPerVariant || 12,
      topKResults: config.topKResults || 3,
      minScore: typeof config.minScore === 'number' ? config.minScore : 0.35,
      cacheTtl: config.cacheTtl || 240000,
      recencyBoostDays: config.recencyBoostDays || 30,
      rubriqueBoost: config.rubriqueBoost || 0.15,
      productBoost: config.productBoost || 0.2,
      variantDecay: config.variantDecay || 0.15,
      fallbackLimit: config.fallbackLimit || 5
    };

    this.synonymMap = {
      horaire: ['heures', 'ouverture', 'fermeture', 'disponibilite'],
      prix: ['tarif', 'cout', 'montant', 'facture'],
      support: ['assistance', 'aide', 'contact', 'service client'],
      produit: ['offre', 'solution', 'service'],
      compte: ['profil', 'espace client', 'identifiant'],
      paiement: ['reglement', 'transaction', 'facturation'],
      inscription: ['adhesion', 'enregistrement', 'creation compte']
    };
  }

  /**
   * Main entry point used by ChatService to retrieve ranked FAQ candidates.
   * @param {string} query 
   * @param {Object} session 
   * @returns {Promise<Object|null>}
   */
  async retrieve(query, session = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    const variants = this.buildQueryVariants(normalizedQuery, session);

    let candidates = [];
    for (const variant of variants) {
      const filters = this.buildFilters(session, variant);
      let results = await this.getCachedResults(variant.cacheKey, variant.query, filters);

      if ((!results || results.length === 0) && variant.allowFallback) {
        results = await this.searchFallback(variant.query, filters);
      }

      if (results && results.length > 0) {
        const scored = this.scoreResults(results, variant, session);
        candidates = candidates.concat(scored);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const aggregated = this.aggregateCandidates(candidates);
    const ranked = aggregated
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));

    const topK = ranked.slice(0, this.config.topKResults);
    const aboveThreshold = topK.filter(candidate => candidate.score >= this.config.minScore);

    return {
      normalizedQuery,
      variants,
      rankedCandidates: ranked,
      topCandidates: aboveThreshold.length > 0 ? aboveThreshold : topK
    };
  }

  /**
   * Build multiple query variants (context-aware) similar to a RAG retriever.
   */
  buildQueryVariants(query, session) {
    const variants = [];
    const baseFilters = {
      languageCode: session.languageCode,
      rubrique: session.rubrique,
      productCode: session.productCode
    };

    const pushVariant = (variant) => {
      if (variants.length >= this.config.maxQueryVariants) return;
      variants.push({
        ...variant,
        cacheKey: this.buildCacheKey(variant.query, variant.filters || baseFilters)
      });
    };

    pushVariant({
      query,
      weight: 1.0,
      reason: 'base',
      filters: baseFilters,
      allowFallback: true
    });

    if (session.productCode) {
      pushVariant({
        query: `${session.productCode} ${query}`.trim(),
        weight: 1.0 - this.config.variantDecay,
        reason: 'product',
        filters: { ...baseFilters, productCode: session.productCode },
        allowFallback: true
      });
    }

    if (session.rubrique && session.rubrique !== 'general') {
      pushVariant({
        query: `${session.rubrique.replace('_', ' ')} ${query}`.trim(),
        weight: 1.0 - this.config.variantDecay,
        reason: 'rubrique',
        filters: { ...baseFilters, rubrique: session.rubrique },
        allowFallback: false
      });
    }

    const keywordVariants = this.expandSynonyms(query);
    keywordVariants.forEach((variantQuery, index) => {
      pushVariant({
        query: variantQuery,
        weight: Math.max(0.3, 1 - ((index + 1) * this.config.variantDecay)),
        reason: 'synonym',
        filters: baseFilters,
        allowFallback: index === 0
      });
    });

    return variants;
  }

  buildFilters(session, variant) {
    const filters = {
      languageCode: session.languageCode,
      limit: this.config.maxCandidatesPerVariant
    };

    if (variant.filters?.rubrique) {
      filters.rubrique = variant.filters.rubrique;
    } else if (session.rubrique && session.rubrique !== 'general') {
      filters.rubrique = session.rubrique;
    }

    if (variant.filters?.productCode) {
      filters.productRef = variant.filters.productCode;
    } else if (session.productCode) {
      filters.productRef = session.productCode;
    }

    return filters;
  }

  async getCachedResults(cacheKey, query, filters) {
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const results = await this.database.searchFaqs(query, filters);
      if (this.cache && results) {
        this.cache.set(cacheKey, results, this.config.cacheTtl);
      }
      return results;
    } catch (error) {
      this.logger?.logError?.(error, {
        action: 'rag_search_faq',
        query,
        filters
      }) || this.logger?.error?.('RAG search failed', error);
      return null;
    }
  }

  async searchFallback(query, filters) {
    const fallbackFilters = this.buildFallbackFilterVariants(filters);
    const limitOverride = Math.min(filters.limit || this.config.maxCandidatesPerVariant, this.config.fallbackLimit);

    for (const variant of fallbackFilters) {
      try {
        const variantFilters = {
          ...variant,
          limit: limitOverride
        };
        const results = await this.database.searchFaqContent(query, variantFilters);
        if (results && results.length > 0) {
          return results;
        }
      } catch (error) {
        this.logger?.logError?.(error, {
          action: 'rag_search_fallback',
          query,
          filters: variant
        });
      }
    }

    return null;
  }

  buildFallbackFilterVariants(filters) {
    const normalized = this.normalizeFilters(filters);
    const variants = [];

    const pushVariant = (variant) => {
      const key = JSON.stringify(variant);
      if (!variants.some(entry => entry.__key === key)) {
        variants.push({ ...variant, __key: key });
      }
    };

    pushVariant(normalized);

    if (normalized.productRef) {
      const { productRef, ...rest } = normalized;
      pushVariant(rest);
    }

    if (normalized.rubrique) {
      const variant = { ...normalized };
      delete variant.rubrique;
      pushVariant(variant);
    }

    const noProductNoRubrique = { ...normalized };
    delete noProductNoRubrique.productRef;
    delete noProductNoRubrique.rubrique;
    pushVariant(noProductNoRubrique);

    pushVariant({
      languageCode: normalized.languageCode,
      limit: normalized.limit
    });

    pushVariant({
      limit: normalized.limit
    });

    return variants.map(({ __key, ...variant }) => variant);
  }

  normalizeFilters(filters = {}) {
    const normalized = {};
    if (filters.languageCode) {
      normalized.languageCode = filters.languageCode;
    }
    if (filters.rubrique) {
      normalized.rubrique = filters.rubrique;
    }
    if (filters.productRef) {
      normalized.productRef = filters.productRef;
    }
    if (filters.limit) {
      normalized.limit = filters.limit;
    }
    return normalized;
  }

  scoreResults(results, variant, session) {
    const now = Date.now();
    const recentCutoff = now - (this.config.recencyBoostDays * 24 * 60 * 60 * 1000);

    return results.map(result => {
      const baseScore = result.enhanced_relevance || result.relevance || 0.2;
      let score = baseScore * variant.weight;

      if (session.productCode && result.product_ref === session.productCode) {
        score += this.config.productBoost;
      }

      if (session.rubrique && result.rubrique === session.rubrique) {
        score += this.config.rubriqueBoost;
      }

      if (result.last_updated) {
        const updatedAt = new Date(result.last_updated).getTime();
        if (!isNaN(updatedAt) && updatedAt >= recentCutoff) {
          const recencyBoost = 0.1 + ((updatedAt - recentCutoff) / (now - recentCutoff + 1)) * 0.1;
          score += recencyBoost;
        }
      }

      return {
        faqId: result.id,
        row: result,
        variantReason: variant.reason,
        variantWeight: variant.weight,
        score
      };
    });
  }

  aggregateCandidates(candidates) {
    const aggregated = new Map();

    candidates.forEach(candidate => {
      const existing = aggregated.get(candidate.faqId);
      if (existing) {
        existing.score = Math.max(existing.score, candidate.score);
        existing.sources.push(candidate.variantReason);
      } else {
        aggregated.set(candidate.faqId, {
          faqId: candidate.faqId,
          row: candidate.row,
          score: candidate.score,
          sources: [candidate.variantReason]
        });
      }
    });

    return Array.from(aggregated.values());
  }

  normalizeQuery(query) {
    return (query || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  expandSynonyms(query) {
    const words = query.split(' ');
    const variants = new Set();

    words.forEach(word => {
      if (this.synonymMap[word]) {
        this.synonymMap[word].forEach(syn => {
          variants.add(query.replace(word, syn));
        });
      }
    });

    return Array.from(variants);
  }

  buildCacheKey(query, filters) {
    const filterString = Object.entries(filters || {})
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join('|');

    return `rag:${query}:${filterString}`;
  }
}

module.exports = RagSearchService;

