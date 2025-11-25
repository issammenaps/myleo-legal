#!/usr/bin/env node

/**
 * FAQ Data Synchronization Script
 * 
 * This script synchronizes FAQ data from the external Myleo database
 * to the chatbot database. It's designed to be run via CRON.
 * 
 * Usage:
 *   node scripts/sync-faq-data.js [--dry-run] [--force] [--verbose]
 * 
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --force      Force update all records regardless of timestamps
 *   --verbose    Enable verbose logging
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Load configuration
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config/config');

class FaqDataSync {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      force: options.force || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.stats = {
      processed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      startTime: new Date()
    };
    
    this.externalDb = null;
    this.chatbotDb = null;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const levelMap = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      success: '✅',
      debug: '🐛'
    };
    
    if (level === 'debug' && !this.options.verbose) {
      return;
    }
    
    console.log(`${timestamp} ${levelMap[level] || 'ℹ️'} ${message}`);
  }

  async connect() {
    try {
      this.log('Connecting to chatbot database...');
      
      // Connect to chatbot database only
      this.chatbotDb = await mysql.createConnection({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        charset: config.database.charset,
        timezone: config.database.timezone
      });
      
      // Setup API client for external data
      this.apiClient = axios.create({
        baseURL: config.externalApi.baseUrl,
        timeout: config.externalApi.timeout || 30000,
        headers: {
          'Authorization': `Bearer ${config.externalApi.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MyLeo-Chatbot-Sync/1.0'
        }
      });
      
      this.log('Database connection and API client established', 'success');
    } catch (error) {
      this.log(`Failed to connect: ${error.message}`, 'error');
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.chatbotDb) {
        await this.chatbotDb.end();
        this.log('Chatbot database connection closed', 'debug');
      }
    } catch (error) {
      this.log(`Error closing database connection: ${error.message}`, 'warn');
    }
  }

  async getLastSyncTime() {
    try {
      const [rows] = await this.chatbotDb.execute(
        'SELECT MAX(updated_at) as last_sync FROM faqs WHERE external_id IS NOT NULL'
      );
      
      const lastSync = rows[0]?.last_sync;
      this.log(`Last sync time: ${lastSync || 'Never'}`, 'debug');
      
      return lastSync;
    } catch (error) {
      this.log(`Failed to get last sync time: ${error.message}`, 'warn');
      return null;
    }
  }

  async fetchExternalFaqs(lastSyncTime) {
    try {
      this.log('Fetching FAQs from external API...', 'debug');
      
      const params = {
        limit: config.externalApi.maxRecords || 1000,
        format: 'json'
      };
      
      if (!this.options.force && lastSyncTime) {
        params.since = lastSyncTime;
      }
      
      this.log(`API request params: ${JSON.stringify(params)}`, 'debug');
      
      const response = await this.apiClient.get(config.externalApi.faqEndpoint, {
        params
      });
      
      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }
      
      const faqs = response.data.faqs || response.data.data || response.data;
      
      if (!Array.isArray(faqs)) {
        throw new Error('API response does not contain a valid FAQ array');
      }
      
      this.log(`Found ${faqs.length} FAQ records to process`);
      
      // Transform API data to match our expected format
      return faqs.map(faq => ({
        id: faq.id,
        title: faq.title,
        language_code: faq.language_code || faq.lang || 'fr',
        is_active: faq.is_active !== false, // Default to true
        meta_keywords: faq.meta_keywords || faq.keywords || '',
        meta_description: faq.meta_description || faq.description || '',
        product_name: faq.product_name || faq.product?.name || '',
        product_ref: faq.product_ref || faq.product?.ref || faq.product_code || '',
        rubrique: faq.rubrique || faq.category || 'general',
        last_updated: faq.last_updated || faq.updated_at || new Date().toISOString(),
        qa_data: faq.qa_data || faq.questions_answers || faq.content || []
      }));
      
    } catch (error) {
      this.log(`Failed to fetch external FAQs from API: ${error.message}`, 'error');
      
      if (error.response) {
        this.log(`API Error Details: ${error.response.status} - ${JSON.stringify(error.response.data)}`, 'error');
      }
      
      throw error;
    }
  }

  async checkExistingFaq(externalId) {
    try {
      const [rows] = await this.chatbotDb.execute(
        'SELECT id, updated_at FROM faqs WHERE external_id = ?',
        [externalId]
      );
      
      return rows[0] || null;
    } catch (error) {
      this.log(`Failed to check existing FAQ ${externalId}: ${error.message}`, 'error');
      return null;
    }
  }

  validateFaqData(faq) {
    const errors = [];
    
    if (!faq.id) {
      errors.push('Missing ID');
    }
    
    if (!faq.title || faq.title.trim().length === 0) {
      errors.push('Missing or empty title');
    }
    
    if (!faq.language_code) {
      errors.push('Missing language code');
    }
    
    if (!['fr', 'en'].includes(faq.language_code)) {
      errors.push(`Unsupported language: ${faq.language_code}`);
    }
    
    if (!['produit', 'compte_client', 'tunnel_vente', 'general'].includes(faq.rubrique)) {
      errors.push(`Invalid rubrique: ${faq.rubrique}`);
    }
    
    if (!faq.qa_data) {
      errors.push('Missing QA data');
    } else {
      try {
        const qaData = typeof faq.qa_data === 'string' ? JSON.parse(faq.qa_data) : faq.qa_data;
        if (!Array.isArray(qaData) || qaData.length === 0) {
          errors.push('QA data must be a non-empty array');
        }
      } catch (error) {
        errors.push(`Invalid QA data JSON: ${error.message}`);
      }
    }
    
    return errors;
  }

  async insertFaq(faq) {
    try {
      const qaDataString = typeof faq.qa_data === 'string' ? faq.qa_data : JSON.stringify(faq.qa_data);
      
      const query = `
        INSERT INTO faqs (
          title, language_code, is_active, meta_keywords, meta_description,
          product_name, product_ref, rubrique, qa_data, external_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const params = [
        faq.title,
        faq.language_code,
        faq.is_active || true,
        faq.meta_keywords,
        faq.meta_description,
        faq.product_name,
        faq.product_ref,
        faq.rubrique || 'general',
        qaDataString,
        faq.id.toString()
      ];
      
      if (!this.options.dryRun) {
        const [result] = await this.chatbotDb.execute(query, params);
        this.log(`Inserted FAQ ${faq.id} (internal ID: ${result.insertId})`, 'debug');
        return result.insertId;
      } else {
        this.log(`[DRY RUN] Would insert FAQ ${faq.id}`, 'debug');
        return null;
      }
    } catch (error) {
      this.log(`Failed to insert FAQ ${faq.id}: ${error.message}`, 'error');
      throw error;
    }
  }

  async updateFaq(existingFaq, newFaq) {
    try {
      const qaDataString = typeof newFaq.qa_data === 'string' ? newFaq.qa_data : JSON.stringify(newFaq.qa_data);
      
      const query = `
        UPDATE faqs SET
          title = ?, language_code = ?, is_active = ?, meta_keywords = ?,
          meta_description = ?, product_name = ?, product_ref = ?,
          rubrique = ?, qa_data = ?, updated_at = NOW()
        WHERE id = ?
      `;
      
      const params = [
        newFaq.title,
        newFaq.language_code,
        newFaq.is_active || true,
        newFaq.meta_keywords,
        newFaq.meta_description,
        newFaq.product_name,
        newFaq.product_ref,
        newFaq.rubrique || 'general',
        qaDataString,
        existingFaq.id
      ];
      
      if (!this.options.dryRun) {
        await this.chatbotDb.execute(query, params);
        this.log(`Updated FAQ ${newFaq.id}`, 'debug');
      } else {
        this.log(`[DRY RUN] Would update FAQ ${newFaq.id}`, 'debug');
      }
    } catch (error) {
      this.log(`Failed to update FAQ ${newFaq.id}: ${error.message}`, 'error');
      throw error;
    }
  }

  async processFaq(faq) {
    this.stats.processed++;
    
    try {
      // Validate FAQ data
      const validationErrors = this.validateFaqData(faq);
      if (validationErrors.length > 0) {
        this.log(`FAQ ${faq.id} validation failed: ${validationErrors.join(', ')}`, 'warn');
        this.stats.skipped++;
        return;
      }
      
      // Check if FAQ already exists
      const existingFaq = await this.checkExistingFaq(faq.id.toString());
      
      if (existingFaq) {
        // Check if update is needed
        const externalUpdateTime = new Date(faq.last_updated);
        const internalUpdateTime = new Date(existingFaq.updated_at);
        
        if (!this.options.force && externalUpdateTime <= internalUpdateTime) {
          this.log(`FAQ ${faq.id} is up to date, skipping`, 'debug');
          this.stats.skipped++;
          return;
        }
        
        // Update existing FAQ
        await this.updateFaq(existingFaq, faq);
        this.stats.updated++;
      } else {
        // Insert new FAQ
        await this.insertFaq(faq);
        this.stats.inserted++;
      }
      
    } catch (error) {
      this.log(`Error processing FAQ ${faq.id}: ${error.message}`, 'error');
      this.stats.errors++;
    }
  }

  async sync() {
    try {
      await this.connect();
      
      // Get last sync time (unless forcing full sync)
      const lastSyncTime = this.options.force ? null : await this.getLastSyncTime();
      
      // Fetch FAQs from external database
      const externalFaqs = await this.fetchExternalFaqs(lastSyncTime);
      
      if (externalFaqs.length === 0) {
        this.log('No FAQs to synchronize');
        return;
      }
      
      // Process each FAQ
      this.log(`Processing ${externalFaqs.length} FAQs...`);
      
      for (const faq of externalFaqs) {
        await this.processFaq(faq);
        
        // Progress indicator
        if (this.stats.processed % 10 === 0) {
          this.log(`Progress: ${this.stats.processed}/${externalFaqs.length} processed`);
        }
      }
      
      // Log final statistics
      this.logStats();
      
    } catch (error) {
      this.log(`Synchronization failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  logStats() {
    const duration = new Date() - this.stats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    this.log('='.repeat(50));
    this.log('SYNCHRONIZATION COMPLETE', 'success');
    this.log('='.repeat(50));
    this.log(`Total processed: ${this.stats.processed}`);
    this.log(`Inserted: ${this.stats.inserted}`, 'success');
    this.log(`Updated: ${this.stats.updated}`, 'success');
    this.log(`Skipped: ${this.stats.skipped}`);
    this.log(`Errors: ${this.stats.errors}${this.stats.errors > 0 ? ' ❌' : ''}`);
    this.log(`Duration: ${minutes}m ${seconds}s`);
    this.log('='.repeat(50));
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Myleo Chatbot FAQ Data Synchronization Script

Usage: node scripts/sync-faq-data.js [options]

Options:
  --dry-run     Show what would be done without making changes
  --force       Force update all records regardless of timestamps
  --verbose     Enable verbose logging
  --help, -h    Show this help message

Examples:
  node scripts/sync-faq-data.js                    # Normal sync
  node scripts/sync-faq-data.js --dry-run          # Preview changes
  node scripts/sync-faq-data.js --force            # Force full sync
  node scripts/sync-faq-data.js --verbose          # Verbose output
    `);
    process.exit(0);
  }
  
  const sync = new FaqDataSync(options);
  
  try {
    await sync.sync();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Synchronization failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = FaqDataSync;