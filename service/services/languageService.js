const fs = require('fs').promises;
const path = require('path');

class LanguageService {
  constructor() {
    this.languages = {};
    this.defaultLanguage = 'fr';
    this.languagesPath = path.join(__dirname, '../../languages');
  }

  /**
   * Load all language files
   */
  async loadLanguages() {
    try {
      const files = await fs.readdir(this.languagesPath);
      const languageFiles = files.filter(file => file.endsWith('.json'));

      for (const file of languageFiles) {
        const languageCode = path.basename(file, '.json');
        const filePath = path.join(this.languagesPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        try {
          this.languages[languageCode] = JSON.parse(content);
          console.log(`Loaded language: ${languageCode}`);
        } catch (parseError) {
          console.error(`Failed to parse language file ${file}:`, parseError);
        }
      }

      if (Object.keys(this.languages).length === 0) {
        throw new Error('No language files loaded');
      }

      console.log(`Loaded ${Object.keys(this.languages).length} languages: ${Object.keys(this.languages).join(', ')}`);
    } catch (error) {
      console.error('Failed to load languages:', error);
      throw error;
    }
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key (dot notation)
   * @param {string} language - Language code
   * @param {Object} replacements - Variables to replace in the translation
   * @returns {string}
   */
  get(key, language = this.defaultLanguage, replacements = {}) {
    // Use default language if specified language is not available
    const lang = this.languages[language] || this.languages[this.defaultLanguage];
    
    if (!lang) {
      console.warn(`Language ${language} not found, using key as fallback`);
      return key;
    }

    // Navigate through the nested object using dot notation
    const keys = key.split('.');
    let value = lang;

    for (const k of keys) {
      if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
        value = value[k];
      } else {
        console.warn(`Translation key '${key}' not found for language '${language}'`);
        return key; // Return the key itself as fallback
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value for '${key}' is not a string`);
      return key;
    }

    // Replace variables in the translation
    return this.replaceVariables(value, replacements);
  }

  /**
   * Replace variables in translation string
   * @param {string} text - Text with variables
   * @param {Object} replacements - Variables to replace
   * @returns {string}
   */
  replaceVariables(text, replacements) {
    if (!replacements || typeof replacements !== 'object') {
      return text;
    }

    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Get all available languages
   * @returns {Array}
   */
  getAvailableLanguages() {
    return Object.keys(this.languages);
  }

  /**
   * Check if a language is supported
   * @param {string} language 
   * @returns {boolean}
   */
  isLanguageSupported(language) {
    return this.languages.hasOwnProperty(language);
  }

  /**
   * Get default language
   * @returns {string}
   */
  getDefaultLanguage() {
    return this.defaultLanguage;
  }

  /**
   * Set default language
   * @param {string} language 
   */
  setDefaultLanguage(language) {
    if (this.isLanguageSupported(language)) {
      this.defaultLanguage = language;
    } else {
      throw new Error(`Language ${language} is not supported`);
    }
  }

  /**
   * Get all translations for a language
   * @param {string} language 
   * @returns {Object}
   */
  getLanguageData(language) {
    return this.languages[language] || {};
  }

  /**
   * Get widget-specific translations
   * @param {string} language 
   * @returns {Object}
   */
  getWidgetTranslations(language = this.defaultLanguage) {
    const lang = this.languages[language] || this.languages[this.defaultLanguage];
    return lang || {};
  }

  /**
   * Format time in human readable format
   * @param {Date|number} timestamp 
   * @param {string} language 
   * @returns {string}
   */
  formatTime(timestamp, language = this.defaultLanguage) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) {
      return this.get('time.justNow', language);
    } else if (diffInSeconds < 120) {
      return this.get('time.minuteAgo', language);
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return this.get('time.minutesAgo', language, { minutes });
    } else if (diffInSeconds < 7200) {
      return this.get('time.hourAgo', language);
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return this.get('time.hoursAgo', language, { hours });
    } else if (diffInSeconds < 172800) {
      return this.get('time.dayAgo', language);
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return this.get('time.daysAgo', language, { days });
    }
  }

  /**
   * Get welcome message based on context
   * @param {string} language 
   * @param {Object} context 
   * @returns {string}
   */
  getWelcomeMessage(language = this.defaultLanguage, context = {}) {
    if (context.productName) {
      return this.get('messages.welcomeProduct', language, { 
        productName: context.productName 
      });
    }
    
    return this.get('messages.welcome', language);
  }

  /**
   * Get error message
   * @param {string} errorType 
   * @param {string} language 
   * @returns {string}
   */
  getErrorMessage(errorType, language = this.defaultLanguage) {
    const errorKey = `errors.${errorType}`;
    return this.get(errorKey, language);
  }

  /**
   * Reload language files
   */
  async reload() {
    this.languages = {};
    await this.loadLanguages();
  }

  /**
   * Add or update a language dynamically
   * @param {string} language 
   * @param {Object} translations 
   */
  addLanguage(language, translations) {
    if (typeof translations !== 'object') {
      throw new Error('Translations must be an object');
    }
    
    this.languages[language] = translations;
  }

  /**
   * Merge translations into existing language
   * @param {string} language 
   * @param {Object} translations 
   */
  mergeTranslations(language, translations) {
    if (!this.languages[language]) {
      this.languages[language] = {};
    }
    
    this.languages[language] = {
      ...this.languages[language],
      ...translations
    };
  }

  /**
   * Validate that all required keys exist in a language
   * @param {string} language 
   * @param {Array} requiredKeys 
   * @returns {Array} Missing keys
   */
  validateLanguage(language, requiredKeys = []) {
    const lang = this.languages[language];
    if (!lang) {
      return requiredKeys; // All keys are missing
    }

    const missingKeys = [];
    for (const key of requiredKeys) {
      const keys = key.split('.');
      let value = lang;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
          value = value[k];
        } else {
          missingKeys.push(key);
          break;
        }
      }
    }

    return missingKeys;
  }

  /**
   * Get language statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalLanguages: Object.keys(this.languages).length,
      languages: {},
      defaultLanguage: this.defaultLanguage
    };

    for (const [lang, data] of Object.entries(this.languages)) {
      stats.languages[lang] = {
        keyCount: this.countKeys(data),
        hasWidgetTranslations: !!(data.widget),
        hasMessageTranslations: !!(data.messages),
        hasEscalationTranslations: !!(data.escalation)
      };
    }

    return stats;
  }

  /**
   * Count the number of keys in a nested object
   * @param {Object} obj 
   * @returns {number}
   */
  countKeys(obj, count = 0) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          count = this.countKeys(obj[key], count);
        } else {
          count++;
        }
      }
    }
    return count;
  }
}

module.exports = LanguageService;