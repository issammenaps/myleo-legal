# FAQ Sync Scheduler - Quick Start Guide

## ✅ What Was Done

I've successfully set up an automated FAQ synchronization scheduler using **node-cron** that runs every midnight. Here's what was created:

### 1. New Files Created

#### `scripts/scheduler.js`
- Automated scheduler using node-cron
- Runs FAQ sync every day at midnight (00:00)
- Features:
  - Timezone-aware (default: Europe/Paris)
  - Prevents concurrent executions
  - Graceful shutdown handling (Ctrl+C)
  - Status monitoring every hour
  - Comprehensive logging with timestamps

#### `scripts/README.md`
- Complete documentation for both sync scripts
- Usage instructions
- Production deployment options
- Troubleshooting guide
- Cron schedule examples

#### `ecosystem.config.js`
- PM2 configuration file
- Manages both chatbot service and FAQ scheduler
- Ready for production deployment

### 2. Updated Files

#### `package.json`
- Added `node-cron` dependency (v4.2.1)
- Added new npm script: `npm run scheduler`

## 🚀 How to Use

### Development/Testing

```bash
# Start the scheduler (runs in foreground)
npm run scheduler

# Test with an immediate sync
node scripts/scheduler.js --test

# View help
node scripts/scheduler.js --help
```

### Production Deployment

**Option 1: Using PM2 (Recommended)**
```bash
# Install PM2 globally
npm install -g pm2

# Start both chatbot and scheduler
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

**Option 2: Run scheduler standalone**
```bash
# Using nohup (Linux/Mac)
nohup npm run scheduler > logs/scheduler.log 2>&1 &

# Using PM2 for scheduler only
pm2 start scripts/scheduler.js --name "faq-scheduler"
pm2 save
```

## 📋 Features

### Scheduler Features
- ✅ Runs automatically every midnight (00:00)
- ✅ Timezone configurable (default: Europe/Paris)
- ✅ Prevents overlapping executions
- ✅ Graceful shutdown on SIGINT/SIGTERM
- ✅ Hourly status reports
- ✅ Detailed logging with emoji indicators

### Sync Script Features (unchanged)
- ✅ Incremental sync (only changed records)
- ✅ Dry-run mode for testing
- ✅ Force full sync option
- ✅ Verbose logging option
- ✅ Data validation
- ✅ Progress reporting

## 🔧 Configuration

### Change Schedule Time

Edit `scripts/scheduler.js` line 72:

```javascript
// Current: Every day at midnight
const task = cron.schedule('0 0 * * *', async () => {
  // ...
});

// Examples:
// Every 6 hours: '0 */6 * * *'
// Every day at 2 AM: '0 2 * * *'
// Every Sunday at midnight: '0 0 * * 0'
```

### Change Timezone

Edit `scripts/scheduler.js` line 75:

```javascript
const task = cron.schedule('0 0 * * *', async () => {
  // ...
}, {
  scheduled: true,
  timezone: "America/New_York" // Change this
});
```

## 📊 Monitoring

### View Logs
```bash
# If running with PM2
pm2 logs faq-scheduler

# If running in background with nohup
tail -f logs/scheduler.log
```

### Check Status
```bash
# PM2 status
pm2 status

# PM2 detailed info
pm2 info faq-scheduler
```

## 🎯 Cron Schedule Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday is 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common Examples:**
- `0 0 * * *` - Every day at midnight
- `0 */6 * * *` - Every 6 hours
- `0 2 * * *` - Every day at 2 AM
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month

## 📝 Manual Sync (Still Available)

You can still run manual syncs anytime:

```bash
# Normal sync
npm run sync

# Dry run (preview only)
npm run sync -- --dry-run

# Force full sync
npm run sync -- --force

# Verbose output
npm run sync -- --verbose
```

## 🔍 Troubleshooting

### Scheduler Not Running
```bash
# Check if process is running
pm2 list

# View recent logs
pm2 logs faq-scheduler --lines 50

# Restart scheduler
pm2 restart faq-scheduler
```

### Test the Scheduler
```bash
# Run an immediate test sync
node scripts/scheduler.js --test
```

### Check Cron Expression
Visit [crontab.guru](https://crontab.guru/) to validate cron expressions.

## 📚 Additional Resources

- Full documentation: `scripts/README.md`
- Original sync script: `scripts/sync-faq-data.js`
- PM2 documentation: https://pm2.keymetrics.io/

## ✨ Summary

Your FAQ sync script now runs automatically every midnight! The scheduler:
- Keeps running in the background
- Executes the sync at midnight daily
- Logs all activities
- Can be managed with PM2 for production
- Handles errors gracefully

**Next Steps:**
1. Test the scheduler: `node scripts/scheduler.js --test`
2. Deploy to production with PM2: `pm2 start ecosystem.config.js`
3. Monitor logs to ensure it's working correctly
