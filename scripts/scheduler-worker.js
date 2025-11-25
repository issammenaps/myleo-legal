const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const cron = require('node-cron');
const path = require('path');

// Load configuration
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import the sync class
const FaqDataSync = require('./sync-faq-data');

class SchedulerWorker {
    constructor() {
        this.isRunning = false;
        this.lastRunTime = null;
        this.task = null;
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

        const logMessage = `${timestamp} ${levelMap[level] || 'ℹ️'} ${message}`;
        
        // Send log to main thread
        if (parentPort) {
            parentPort.postMessage({
                type: 'log',
                message: logMessage
            });
        } else {
            console.log(`[SCHEDULER] ${logMessage}`);
        }
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
            
            // Send error to main thread
            if (parentPort) {
                parentPort.postMessage({
                    type: 'error',
                    message: `Sync failed: ${error.message}`,
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            }
        } finally {
            this.isRunning = false;
        }
    }

    start() {
        this.log('FAQ Data Synchronization Scheduler starting in worker thread...', 'info');
        this.log('Schedule: Every day at midnight (00:00)', 'info');

        // Schedule the task to run every day at midnight (00:00)
        // Cron format: minute hour day month weekday
        // '0 0 * * *' means: at 00:00 every day
        this.task = cron.schedule('0 0 * * *', async () => {
            this.log('Cron job triggered', 'info');
            await this.runSync();
        }, {
            scheduled: true,
            timezone: "Europe/Paris" // Adjust timezone as needed
        });

        this.log('Scheduler started successfully', 'success');

        // Calculate and display next run time
        this.displayNextRunTime();

        // Display status every hour
        setInterval(() => {
            this.displayStatus();
        }, 3600000); // 1 hour in milliseconds

        // Handle messages from main thread
        if (parentPort) {
            parentPort.on('message', (message) => {
                if (message.type === 'shutdown') {
                    this.log('Received shutdown signal from main thread', 'warn');
                    this.stop();
                } else if (message.type === 'sync_now') {
                    this.log('Manual sync requested from main thread', 'info');
                    this.runSync();
                }
            });
        }

        // Keep the worker running
        this.keepAlive();
    }

    stop() {
        if (this.task) {
            this.task.stop();
            this.log('Scheduler stopped', 'info');
        }
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

    keepAlive() {
        // Keep the worker thread alive
        setInterval(() => {
            // Do nothing, just keep alive
        }, 10000);
    }
}

// Worker thread execution
if (!isMainThread && parentPort) {
    const scheduler = new SchedulerWorker();
    scheduler.start();

    // Handle worker termination
    process.on('SIGTERM', () => {
        scheduler.log('Received SIGTERM signal, stopping scheduler worker...', 'warn');
        scheduler.stop();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        scheduler.log('Received SIGINT signal, stopping scheduler worker...', 'warn');
        scheduler.stop();
        process.exit(0);
    });
} else {
    // Export for testing or standalone usage
    module.exports = SchedulerWorker;
}