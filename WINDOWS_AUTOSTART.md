# Windows Auto-Start Setup for PM2

## ✅ Current Status

Your PM2 processes are running successfully:
- ✅ `myleo-chatbot-service` - Running
- ✅ `faq-sync-scheduler` - Running (will sync FAQs every midnight)

The processes are saved and will persist if you manually restart PM2.

## 🪟 Windows Auto-Start Setup

Since `pm2 startup` doesn't work on Windows, here are the recommended methods to auto-start PM2 on Windows boot:

### Method 1: Using pm2-windows-startup (Recommended)

```powershell
# Install pm2-windows-startup globally
npm install -g pm2-windows-startup

# Configure PM2 to start on Windows boot
pm2-startup install

# Your processes are already saved, so you're done!
```

This will:
- Create a Windows service that starts PM2 on boot
- Automatically resurrect your saved processes (chatbot + scheduler)

### Method 2: Using Windows Task Scheduler

1. **Open Task Scheduler**
   - Press `Win + R`
   - Type `taskschd.msc` and press Enter

2. **Create a New Task**
   - Click "Create Task" (not "Create Basic Task")
   - Name: `PM2 Resurrect`
   - Check "Run with highest privileges"
   - Check "Run whether user is logged on or not"

3. **Triggers Tab**
   - Click "New"
   - Begin the task: "At startup"
   - Click OK

4. **Actions Tab**
   - Click "New"
   - Action: "Start a program"
   - Program/script: `C:\Users\FadiMathlouthi\AppData\Local\nvm\v22.0.0\pm2.cmd`
   - Add arguments: `resurrect`
   - Click OK

5. **Conditions Tab**
   - Uncheck "Start the task only if the computer is on AC power"

6. **Settings Tab**
   - Check "Allow task to be run on demand"
   - Check "If the running task does not end when requested, force it to stop"

7. **Click OK** and enter your Windows password if prompted

### Method 3: Using Windows Startup Folder (Simple but less reliable)

Create a batch file to start PM2:

1. **Create startup script:**
   ```batch
   @echo off
   cd C:\Users\FadiMathlouthi\Desktop\myleao
   pm2 resurrect
   ```
   Save as: `C:\Users\FadiMathlouthi\Desktop\myleao\start-pm2.bat`

2. **Create shortcut in Startup folder:**
   - Press `Win + R`
   - Type `shell:startup` and press Enter
   - Right-click in the folder → New → Shortcut
   - Browse to `start-pm2.bat`
   - Name it "PM2 MyLeo Chatbot"
   - Click Finish

## 🔍 Verify PM2 is Running

```powershell
# Check PM2 status
pm2 status

# View logs
pm2 logs

# View scheduler logs specifically
pm2 logs faq-sync-scheduler

# View chatbot service logs
pm2 logs myleo-chatbot-service

# Monitor in real-time
pm2 monit
```

## 📊 Useful PM2 Commands

```powershell
# List all processes
pm2 list

# View detailed info
pm2 info faq-sync-scheduler

# Restart a process
pm2 restart faq-sync-scheduler

# Stop a process
pm2 stop faq-sync-scheduler

# Delete a process
pm2 delete faq-sync-scheduler

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# View logs (last 100 lines)
pm2 logs --lines 100

# Clear logs
pm2 flush

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

## 🔄 Updating Your Application

When you update your code:

```powershell
# Pull latest changes
git pull

# Install any new dependencies
npm install

# Restart PM2 processes
pm2 restart all

# Or restart individually
pm2 restart myleo-chatbot-service
pm2 restart faq-sync-scheduler
```

## 🐛 Troubleshooting

### Processes not starting after reboot

```powershell
# Check if PM2 daemon is running
pm2 ping

# If not, start PM2 and resurrect processes
pm2 resurrect

# Check Windows Event Viewer for errors
# Press Win + R, type eventvwr.msc
```

### View error logs

```powershell
# View error logs
pm2 logs --err

# View specific process errors
pm2 logs faq-sync-scheduler --err --lines 50
```

### Reset PM2

```powershell
# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Kill PM2 daemon
pm2 kill

# Start fresh
pm2 start ecosystem.config.js
pm2 save
```

## 📅 Scheduler Status

Your FAQ sync scheduler is now running and will:
- ✅ Execute every day at midnight (00:00 Europe/Paris time)
- ✅ Log all activities
- ✅ Prevent concurrent executions
- ✅ Display status every hour

To verify the scheduler is working:

```powershell
# Check scheduler logs
pm2 logs faq-sync-scheduler --lines 50

# The logs should show:
# - "FAQ Data Synchronization Scheduler starting..."
# - "Schedule: Every day at midnight (00:00)"
# - "Next sync scheduled for: [date/time]"
```

## 🎯 Next Steps

1. **Install pm2-windows-startup** (recommended):
   ```powershell
   npm install -g pm2-windows-startup
   pm2-startup install
   ```

2. **Test the auto-start**:
   - Restart your computer
   - After boot, run `pm2 list` to verify processes are running

3. **Monitor for the first few days**:
   ```powershell
   # Check logs daily
   pm2 logs --lines 100
   ```

## ✨ Summary

Your setup is complete! The FAQ synchronization will now run automatically every midnight. PM2 is managing both your chatbot service and the scheduler, and they will restart automatically if they crash.

**Current Status:**
- ✅ PM2 running with 2 processes
- ✅ Processes saved (will persist on PM2 restart)
- ⏳ Auto-start on Windows boot (needs pm2-windows-startup)

**To complete auto-start setup:**
```powershell
npm install -g pm2-windows-startup
pm2-startup install
```
