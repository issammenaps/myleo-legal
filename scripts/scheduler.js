#!/usr/bin/env node

/**
 * FAQ Data Synchronization Scheduler
 * 
 * This script uses node-cron to schedule the FAQ synchronization
 * to run automatically every midnight (00:00).
 * 
 * Usage:
 *   node scripts/scheduler.js
 * 
 * The scheduler will keep running and execute the sync task daily at midnight.
 */

const cron = require('node-cron');
const FaqDataSync = require('./sync-faq-data');
const path = require('path');

// Load configuration
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class SyncScheduler {
    constructor() {
        this.isRunning = false;
        this.lastRunTime = null;
        this.nextRunTime = null;
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

        console.log(`${timestamp} ${levelMap[level] || 'ℹ️'} [SCHEDULER] ${message}`);
    }

    async runSync() {
        if (this.isRunning) {
            this.log('Sync is already running, skipping this execution', 'warn');
            return;
        }

        try {
            this.isRunning = true;
            this.lastRunTime = new Date();

            this.log('Starting scheduled FAQ synchronization...', 'info');

            const sync = new FaqDataSync({
                dryRun: false,
                force: false,
                verbose: false
            });

            await sync.sync();

            this.log('Scheduled synchronization completed successfully', 'success');

        } catch (error) {
            this.log(`Scheduled synchronization failed: ${error.message}`, 'error');
            console.error(error);
        } finally {
            this.isRunning = false;
        }
    }

    start() {
        this.log('FAQ Data Synchronization Scheduler starting...', 'info');
        this.log('Schedule: Every day at midnight (00:00)', 'info');

        // Schedule the task to run every day at midnight (00:00)
        // Cron format: second minute hour day month weekday
        // '0 0 * * *' means: at 00:00 every day
        const task = cron.schedule('0 0 * * *', async () => {
            this.log('Cron job triggered', 'info');
            await this.runSync();
        }, {
            scheduled: true,
            timezone: "Europe/Paris" // Adjust timezone as needed
        });

        this.log('Scheduler started successfully', 'success');
        this.log('Press Ctrl+C to stop the scheduler', 'info');

        // Calculate and display next run time
        this.displayNextRunTime();

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.log('Received SIGINT signal, stopping scheduler...', 'warn');
            task.stop();
            this.log('Scheduler stopped', 'info');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.log('Received SIGTERM signal, stopping scheduler...', 'warn');
            task.stop();
            this.log('Scheduler stopped', 'info');
            process.exit(0);
        });

        // Keep the process running
        setInterval(() => {
            // Display status every hour
            this.displayStatus();
        }, 3600000); // 1 hour in milliseconds
    }

    displayNextRunTime() {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);

        const hoursUntil = Math.floor((nextMidnight - now) / (1000 * 60 * 60));
        const minutesUntil = Math.floor(((nextMidnight - now) % (1000 * 60 * 60)) / (1000 * 60));

        this.log(`Next sync scheduled for: ${nextMidnight.toLocaleString()}`, 'info');
        this.log(`Time until next sync: ${hoursUntil}h ${minutesUntil}m`, 'info');
    }

    displayStatus() {
        this.log('='.repeat(50), 'info');
        this.log('SCHEDULER STATUS', 'info');
        this.log('='.repeat(50), 'info');
        this.log(`Currently running: ${this.isRunning ? 'Yes' : 'No'}`, 'info');
        this.log(`Last run: ${this.lastRunTime ? this.lastRunTime.toLocaleString() : 'Never'}`, 'info');
        this.displayNextRunTime();
        this.log('='.repeat(50), 'info');
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Myleo Chatbot FAQ Data Synchronization Scheduler

Usage: node scripts/scheduler.js [options]

Options:
  --help, -h    Show this help message
  --test        Run a test sync immediately and exit

Description:
  This script runs continuously and executes the FAQ synchronization
  task every day at midnight (00:00).

Examples:
  node scripts/scheduler.js           # Start the scheduler
  node scripts/scheduler.js --test    # Run a test sync immediately
    `);
        process.exit(0);
    }

    if (args.includes('--test')) {
        console.log('Running test synchronization...');
        const sync = new FaqDataSync({
            dryRun: false,
            force: false,
            verbose: true
        });

        try {
            await sync.sync();
            console.log('✅ Test synchronization completed successfully');
            process.exit(0);
        } catch (error) {
            console.error(`❌ Test synchronization failed: ${error.message}`);
            process.exit(1);
        }
    }

    const scheduler = new SyncScheduler();
    scheduler.start();
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SyncScheduler;
