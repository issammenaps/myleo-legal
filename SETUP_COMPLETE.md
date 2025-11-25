# ✅ FAQ Sync Scheduler - Setup Complete!

## 🎉 Success!

Your FAQ synchronization scheduler is now **running in production** with PM2!

### Current Status

```
✅ myleo-chatbot-service - ONLINE
✅ faq-sync-scheduler    - ONLINE
```

Both processes are:
- Running in the background
- Managed by PM2
- Saved to PM2 configuration
- Will auto-restart if they crash

### What's Happening Now

The **faq-sync-scheduler** is:
- ✅ Running continuously in the background
- ⏰ Scheduled to sync FAQs every day at **midnight (00:00)**
- 📊 Next sync: **Tonight at midnight** (~15 hours from now)
- 📝 Logging all activities to PM2 logs
- 🔒 Preventing concurrent executions
- 💪 Will auto-restart if it crashes

## 📋 Quick Reference Commands

### View Status
```powershell
pm2 status                    # Show all processes
pm2 info faq-sync-scheduler   # Detailed scheduler info
```

### View Logs
```powershell
pm2 logs                           # All logs (live)
pm2 logs faq-sync-scheduler        # Scheduler logs only (live)
pm2 logs --lines 100               # Last 100 lines
pm2 logs faq-sync-scheduler --lines 50  # Last 50 lines of scheduler
```

### Control Processes
```powershell
pm2 restart faq-sync-scheduler     # Restart scheduler
pm2 stop faq-sync-scheduler        # Stop scheduler
pm2 start faq-sync-scheduler       # Start scheduler
pm2 restart all                    # Restart all processes
```

### Monitor
```powershell
pm2 monit                          # Real-time monitoring dashboard
```

## 🪟 Windows Auto-Start (Optional but Recommended)

To make PM2 start automatically when Windows boots:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
```

**Alternative:** See `WINDOWS_AUTOSTART.md` for other methods (Task Scheduler, Startup folder)

## 📅 Sync Schedule

The scheduler runs using this cron expression: `0 0 * * *`

This means:
- **Every day at midnight (00:00)**
- Timezone: **Europe/Paris**

### To Change the Schedule

Edit `scripts/scheduler.js` line 72:

```javascript
// Current: Every day at midnight
const task = cron.schedule('0 0 * * *', async () => {

// Examples:
// Every 6 hours:        '0 */6 * * *'
// Every day at 2 AM:    '0 2 * * *'
// Twice daily (6am/6pm): '0 6,18 * * *'
// Every Sunday:         '0 0 * * 0'
```

After changing, restart the scheduler:
```powershell
pm2 restart faq-sync-scheduler
```

## 🔍 Verify It's Working

### Check Scheduler Status
```powershell
pm2 logs faq-sync-scheduler --lines 20
```

You should see:
```
✅ FAQ Data Synchronization Scheduler starting...
ℹ️  Schedule: Every day at midnight (00:00)
ℹ️  Next sync scheduled for: [date/time]
ℹ️  Time until next sync: Xh Ym
```

### Wait for Midnight

The first automatic sync will happen tonight at midnight. Check the logs tomorrow morning:

```powershell
pm2 logs faq-sync-scheduler --lines 100
```

You should see:
```
ℹ️  Cron job triggered
ℹ️  Starting scheduled FAQ synchronization...
✅ Scheduled synchronization completed successfully
```

## 🧪 Test Manually (Optional)

If you want to test the sync right now without waiting for midnight:

```powershell
# Run a manual sync
npm run sync

# Or run a test sync through the scheduler
node scripts/scheduler.js --test
```

## 📊 What Gets Synced

The scheduler automatically runs `scripts/sync-faq-data.js` which:
- Fetches FAQ data from your external API
- Compares with existing data in the chatbot database
- Inserts new FAQs
- Updates modified FAQs
- Skips unchanged FAQs
- Logs detailed statistics

## 🐛 Troubleshooting

### Scheduler Not Running
```powershell
pm2 restart faq-sync-scheduler
pm2 logs faq-sync-scheduler --err
```

### Check for Errors
```powershell
pm2 logs --err --lines 50
```

### Reset Everything
```powershell
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

### Database Connection Issues
Check your `.env` file has correct database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=chatbot_user
DB_PASSWORD=your_password
DB_NAME=myleo_chatbot

EXTERNAL_API_BASE_URL=https://api.myleo.legal
EXTERNAL_API_TOKEN=your_token
```

## 📚 Documentation

- **Quick Start:** `SCHEDULER_SETUP.md`
- **Detailed Docs:** `scripts/README.md`
- **Windows Auto-Start:** `WINDOWS_AUTOSTART.md`
- **Original Sync Script:** `scripts/sync-faq-data.js`
- **Scheduler Script:** `scripts/scheduler.js`

## 🎯 Next Steps

1. ✅ **Done:** Scheduler is running
2. ✅ **Done:** Processes saved with PM2
3. ⏳ **Optional:** Install pm2-windows-startup for auto-start on boot
4. ⏳ **Wait:** First sync will happen tonight at midnight
5. ⏳ **Verify:** Check logs tomorrow morning to confirm it worked

## 💡 Tips

- **Monitor the first few syncs** to ensure everything works correctly
- **Check logs regularly** especially after the first midnight sync
- **Set up Windows auto-start** so the scheduler survives reboots
- **Keep PM2 updated:** `npm install -g pm2@latest`

## 🆘 Need Help?

Run these commands and check the output:
```powershell
pm2 status
pm2 logs faq-sync-scheduler --lines 50
pm2 info faq-sync-scheduler
```

## ✨ Summary

🎊 **Congratulations!** Your FAQ synchronization is now fully automated!

- ✅ Scheduler running in production with PM2
- ✅ Will sync FAQs every midnight automatically
- ✅ Logs all activities for monitoring
- ✅ Auto-restarts if it crashes
- ✅ Saved configuration (persists on PM2 restart)

**Your chatbot will now always have up-to-date FAQ data!** 🚀

---

**Setup completed:** November 25, 2025 at 08:53 AM
**Next sync:** Tonight at midnight (00:00 Europe/Paris)
