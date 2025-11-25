class CacheService {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.accessOrder = new Map(); // Track access order for FIFO
    this.maxEntries = config.maxEntries || 1000;
    this.ttl = config.ttl || 300000; // 5 minutes default
    this.checkPeriod = config.checkPeriod || 60000; // 1 minute default
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.checkPeriod);
    
    // Track statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * Get value from cache
   * @param {string} key 
   * @returns {*} Value or null if not found
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access order for FIFO
    this.accessOrder.set(key, Date.now());
    this.stats.hits++;
    
    return this.config.useClone ? this.deepClone(entry.value) : entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key 
   * @param {*} value 
   * @param {number} customTtl Optional custom TTL in milliseconds
   */
  set(key, value, customTtl = null) {
    const ttl = customTtl || this.ttl;
    const expires = Date.now() + ttl;
    
    // If cache is at max capacity and key doesn't exist, evict oldest
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    const entry = {
      value: this.config.useClone ? this.deepClone(value) : value,
      expires,
      created: Date.now()
    };
    
    this.cache.set(key, entry);
    this.accessOrder.set(key, Date.now());
    this.stats.sets++;
  }

  /**
   * Delete value from cache
   * @param {string} key 
   */
  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.deletes++;
      return true;
    }
    return false;
  }

  /**
   * Check if key exists in cache
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const count = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    return count;
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxEntries: this.maxEntries,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get approximate memory usage
   * @returns {Object}
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache) {
      totalSize += this.getObjectSize(key) + this.getObjectSize(entry);
    }
    
    return {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Get all keys in cache
   * @returns {Array}
   */
  keys() {
    // Filter out expired keys
    const validKeys = [];
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (now <= entry.expires) {
        validKeys.push(key);
      }
    }
    
    return validKeys;
  }

  /**
   * Evict oldest entry (FIFO)
   */
  evictOldest() {
    if (this.accessOrder.size === 0) return;
    
    // Find the oldest accessed key
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Deep clone object (if useClone is enabled)
   * @param {*} obj 
   * @returns {*}
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  /**
   * Get approximate size of object in bytes
   * @param {*} obj 
   * @returns {number}
   */
  getObjectSize(obj) {
    const seen = new WeakSet();
    
    const calculateSize = (obj) => {
      if (obj === null || obj === undefined) return 0;
      if (typeof obj === 'boolean') return 1;
      if (typeof obj === 'number') return 8;
      if (typeof obj === 'string') return obj.length * 2;
      
      if (typeof obj === 'object') {
        if (seen.has(obj)) return 0;
        seen.add(obj);
        
        let size = 0;
        if (Array.isArray(obj)) {
          size += obj.length * 8; // Array overhead
          obj.forEach(item => {
            size += calculateSize(item);
          });
        } else {
          Object.keys(obj).forEach(key => {
            size += key.length * 2; // Key size
            size += calculateSize(obj[key]);
          });
        }
        return size;
      }
      
      return 0;
    };
    
    return calculateSize(obj);
  }

  /**
   * FAQ-specific cache methods
   */
  
  /**
   * Cache FAQ search results
   * @param {string} query 
   * @param {Object} filters 
   * @param {Array} results 
   */
  cacheFaqSearch(query, filters, results) {
    const cacheKey = this.getFaqSearchKey(query, filters);
    this.set(cacheKey, results, 300000); // Cache for 5 minutes
  }

  /**
   * Get cached FAQ search results
   * @param {string} query 
   * @param {Object} filters 
   * @returns {Array|null}
   */
  getCachedFaqSearch(query, filters) {
    const cacheKey = this.getFaqSearchKey(query, filters);
    return this.get(cacheKey);
  }

  /**
   * Generate cache key for FAQ search
   * @param {string} query 
   * @param {Object} filters 
   * @returns {string}
   */
  getFaqSearchKey(query, filters) {
    const normalizedQuery = query.toLowerCase().trim();
    const filterString = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('|');
    
    return `faq_search:${normalizedQuery}:${filterString}`;
  }

  /**
   * Cache FAQ by ID
   * @param {number} faqId 
   * @param {Object} faq 
   */
  cacheFaq(faqId, faq) {
    const cacheKey = `faq:${faqId}`;
    this.set(cacheKey, faq, 600000); // Cache for 10 minutes
  }

  /**
   * Get cached FAQ by ID
   * @param {number} faqId 
   * @returns {Object|null}
   */
  getCachedFaq(faqId) {
    const cacheKey = `faq:${faqId}`;
    return this.get(cacheKey);
  }

  /**
   * Invalidate FAQ-related caches
   * @param {number} faqId Optional specific FAQ ID
   */
  invalidateFaqCache(faqId = null) {
    if (faqId) {
      this.delete(`faq:${faqId}`);
    }
    
    // Clear all FAQ search caches
    const keysToDelete = [];
    for (const key of this.keys()) {
      if (key.startsWith('faq_search:')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Destroy cache service
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

module.exports = CacheService;