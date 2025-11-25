# FAQ Data Synchronization Scripts

This directory contains scripts for synchronizing FAQ data from the external Myleo database to the chatbot database.

## Scripts

### 1. `sync-faq-data.js`
The main synchronization script that fetches FAQ data from the external API and updates the chatbot database.

**Usage:**
```bash
# Normal sync (only updates changed records)
npm run sync

# Or directly with node
node scripts/sync-faq-data.js

# Preview changes without making updates
node scripts/sync-faq-data.js --dry-run

# Force update all records
node scripts/sync-faq-data.js --force

# Enable verbose logging
node scripts/sync-faq-data.js --verbose

# Combine options
node scripts/sync-faq-data.js --force --verbose
```

**Options:**
- `--dry-run`: Show what would be done without making changes
- `--force`: Force update all records regardless of timestamps
- `--verbose` or `-v`: Enable verbose logging
- `--help` or `-h`: Show help message

### 2. `scheduler.js`
A cron scheduler that automatically runs the FAQ synchronization every day at midnight (00:00).

**Usage:**
```bash
# Start the scheduler
npm run scheduler

# Or directly with node
node scripts/scheduler.js

# Run a test sync immediately
node scripts/scheduler.js --test

# Show help
node scripts/scheduler.js --help
```

**Features:**
- Runs automatically every day at midnight (00:00)
- Timezone-aware (default: Europe/Paris)
- Graceful shutdown handling (Ctrl+C)
- Status monitoring (displays status every hour)
- Prevents concurrent executions
- Logs all activities with timestamps

**Configuration:**
To change the timezone, edit `scripts/scheduler.js` and modify the timezone in the cron.schedule options:
```javascript
const task = cron.schedule('0 0 * * *', async () => {
  // ...
}, {
  scheduled: true,
  timezone: "America/New_York" // Change this to your timezone
});
```

## Running in Production

### Option 1: Using the Node.js Scheduler (Recommended)
The scheduler script keeps running and executes the sync task at midnight:

```bash
# Start the scheduler
npm run scheduler
```

To keep it running in the background:

**On Linux/Mac:**
```bash
# Using nohup
nohup npm run scheduler > logs/scheduler.log 2>&1 &

# Or using PM2 (recommended)
npm install -g pm2
pm2 start scripts/scheduler.js --name "faq-scheduler"
pm2 save
pm2 startup
```

**On Windows:**
```powershell
# Using PM2
npm install -g pm2
pm2 start scripts/scheduler.js --name "faq-scheduler"
pm2 save
pm2 startup
```

### Option 2: Using System Cron (Linux/Mac)
Alternatively, you can use the system's cron to run the sync script:

```bash
# Edit crontab
crontab -e

# Add this line to run at midnight every day
0 0 * * * cd /path/to/myleao && /usr/bin/node scripts/sync-faq-data.js >> logs/sync.log 2>&1
```

### Option 3: Using Windows Task Scheduler
On Windows, you can use Task Scheduler:

1. Open Task Scheduler
2. Create a new task
3. Set trigger to daily at midnight
4. Set action to run: `node.exe` with arguments: `C:\path\to\myleao\scripts\sync-faq-data.js`
5. Set start in: `C:\path\to\myleao`

## Monitoring

### Logs
The scheduler and sync scripts output detailed logs with timestamps and status indicators:
- ✅ Success
- ❌ Error
- ⚠️ Warning
- ℹ️ Info
- 🐛 Debug (only with --verbose)

### Statistics
After each sync, the script displays:
- Total records processed
- Records inserted
- Records updated
- Records skipped
- Errors encountered
- Duration

## Troubleshooting

### Common Issues

**1. Connection Errors**
```
Failed to connect: connect ECONNREFUSED
```
- Check that the database is running
- Verify database credentials in `.env`
- Ensure network connectivity

**2. API Errors**
```
Failed to fetch external FAQs from API
```
- Verify the API endpoint is accessible
- Check API token in `.env`
- Review API rate limits

**3. Validation Errors**
```
FAQ validation failed: Invalid rubrique
```
- Check that FAQ data matches expected format
- Review validation rules in `validateFaqData()`

**4. Scheduler Not Running**
- Ensure the scheduler process is running: `ps aux | grep scheduler`
- Check for error messages in logs
- Verify node-cron is installed: `npm list node-cron`

## Environment Variables

Required environment variables (in `.env`):

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=chatbot_db

# External API Configuration
EXTERNAL_API_BASE_URL=https://api.example.com
EXTERNAL_API_TOKEN=your_api_token
EXTERNAL_API_FAQ_ENDPOINT=/api/faqs
EXTERNAL_API_MAX_RECORDS=1000
```

## Development

### Testing
```bash
# Run a dry-run to preview changes
npm run sync -- --dry-run

# Test the scheduler
node scripts/scheduler.js --test

# Run with verbose logging
npm run sync -- --verbose
```

### Debugging
Enable verbose logging to see detailed information about the sync process:
```bash
node scripts/sync-faq-data.js --verbose
```

## Cron Schedule Format

The scheduler uses the standard cron format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

Examples:
- `0 0 * * *` - Every day at midnight
- `0 */6 * * *` - Every 6 hours
- `0 2 * * *` - Every day at 2 AM
- `0 0 * * 0` - Every Sunday at midnight
- `0 0 1 * *` - First day of every month at midnight

To change the schedule, edit the cron expression in `scripts/scheduler.js`.
