# 🏗️ MyLeo Chatbot - Build & Deployment Guide

## Overview

This guide explains how to create a production build and deploy the MyLeo Chatbot System.

## 📦 Building for Production

### Quick Build

```bash
# Create a production build
npm run build

# Or clean build (removes previous build)
npm run build:clean
```

### What the Build Does

The build script (`scripts/build.js`) creates a `dist/` directory with:

✅ **All source files** (service, scripts, config)
✅ **Public assets** (widget files)
✅ **Database schema**
✅ **Production package.json** (without devDependencies)
✅ **PM2 configuration** (ecosystem.config.js)
✅ **Startup scripts** (start.sh, start.bat)
✅ **Deployment README**
✅ **Environment template** (.env.example)

### Build Output Structure

```
dist/
├── service/              # Backend service
│   ├── server.js
│   ├── routes/
│   ├── services/
│   ├── database/
│   └── utils/
├── scripts/              # Sync and scheduler scripts
│   ├── sync-faq-data.js
│   └── scheduler.js
├── config/               # Configuration files
├── public/               # Widget and static files
├── database/             # Database schema
│   └── schema.sql
├── logs/                 # Log directory
├── package.json          # Production dependencies only
├── .env.example          # Environment template
├── ecosystem.config.js   # PM2 configuration
├── start.sh              # Linux/Mac startup script
├── start.bat             # Windows startup script
└── README.md             # Deployment instructions
```

## 🚀 Deployment Steps

### 1. Build the Application

```bash
# Clean build
npm run build:clean
```

### 2. Copy to Server

```bash
# Example: Copy dist/ to server
scp -r dist/ user@server:/var/www/myleo-chatbot/

# Or zip and upload
cd dist
zip -r ../myleo-chatbot-build.zip .
# Upload myleo-chatbot-build.zip to server
```

### 3. On the Server

```bash
# Navigate to deployment directory
cd /var/www/myleo-chatbot

# If uploaded as zip
unzip myleo-chatbot-build.zip

# Configure environment
cp .env.example .env
nano .env  # Edit with your configuration

# Install production dependencies
npm install --production

# Import database schema
mysql -u your_user -p your_database < database/schema.sql

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions for auto-start
```

## 🔧 Configuration

### Environment Variables (.env)

Create a `.env` file in the dist/ directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=chatbot_user
DB_PASSWORD=your_secure_password
DB_NAME=myleo_chatbot

# External API Configuration
EXTERNAL_API_BASE_URL=https://api.myleo.legal
EXTERNAL_API_TOKEN=your_api_token_here
EXTERNAL_API_FAQ_ENDPOINT=/api/faqs
EXTERNAL_API_MAX_RECORDS=1000

# Zendesk Configuration
ZENDESK_DOMAIN=myleo.zendesk.com
ZENDESK_EMAIL=support@myleo.com
ZENDESK_TOKEN=your_zendesk_token_here

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Cache Configuration
CACHE_MAX_ENTRIES=1000
CACHE_TTL=300000
```

## 🖥️ Running the Application

### Option 1: Using PM2 (Recommended)

```bash
# Start all services
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all
```

### Option 2: Using Startup Scripts

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

### Option 3: Manual Start

```bash
# Terminal 1: Start chatbot service
node service/server.js

# Terminal 2: Start FAQ scheduler
node scripts/scheduler.js
```

## 📊 Services Overview

### 1. Chatbot Service
- **Port:** 3000 (configurable)
- **Endpoint:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/health

### 2. FAQ Sync Scheduler
- **Schedule:** Every day at midnight (00:00)
- **Timezone:** Europe/Paris
- **Manual sync:** `npm run sync`

## 🔍 Verification

### Check Services are Running

```bash
# PM2 status
pm2 status

# Should show:
# ✅ myleo-chatbot-service - online
# ✅ faq-sync-scheduler - online
```

### Test the API

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Test the Widget

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Chatbot</title>
</head>
<body>
    <h1>Test Page</h1>
    
    <script>
        window.MyleoWidgetConfig = {
            apiUrl: 'http://your-server:3000/api',
            language: 'fr',
            rubrique: 'general'
        };
    </script>
    <script src="http://your-server:3000/widget.js"></script>
</body>
</html>
```

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Use strong database passwords
- [ ] Secure API tokens
- [ ] Configure firewall rules
- [ ] Enable HTTPS (use Nginx/Apache reverse proxy)
- [ ] Set appropriate file permissions
- [ ] Regular security updates

## 🌐 Production Setup with Nginx

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/myleo-chatbot`:

```nginx
server {
    listen 80;
    server_name chatbot.myleo.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chatbot.myleo.com;
    
    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/chatbot.myleo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chatbot.myleo.com/privkey.pem;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/myleo-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d chatbot.myleo.com
```

## 📈 Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs

# View specific service logs
pm2 logs myleo-chatbot-service
pm2 logs faq-sync-scheduler

# Flush logs
pm2 flush
```

### Log Files

Logs are stored in `logs/` directory:
- `service-error.log` - Service errors
- `service-out.log` - Service output
- `scheduler-error.log` - Scheduler errors
- `scheduler-out.log` - Scheduler output

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# On development machine
npm run build:clean

# Copy to server
scp -r dist/* user@server:/var/www/myleo-chatbot/

# On server
cd /var/www/myleo-chatbot
npm install --production
pm2 restart all
```

### Database Backup

```bash
# Backup database
mysqldump -u chatbot_user -p myleo_chatbot > backup_$(date +%Y%m%d).sql

# Restore database
mysql -u chatbot_user -p myleo_chatbot < backup_20231125.sql
```

### Log Rotation

Create `/etc/logrotate.d/myleo-chatbot`:

```
/var/www/myleo-chatbot/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check PM2 logs
pm2 logs --err

# Check environment variables
cat .env

# Verify database connection
mysql -u chatbot_user -p -h localhost myleo_chatbot
```

### High Memory Usage

```bash
# Check memory usage
pm2 status

# Restart services
pm2 restart all

# Adjust max_memory_restart in ecosystem.config.js
```

### Scheduler Not Running

```bash
# Check scheduler logs
pm2 logs faq-sync-scheduler

# Manually test sync
npm run sync -- --verbose

# Restart scheduler
pm2 restart faq-sync-scheduler
```

## 📞 Support

For issues:
1. Check logs: `pm2 logs`
2. Verify configuration: `.env` file
3. Test database connection
4. Check firewall rules
5. Review Nginx logs: `/var/log/nginx/error.log`

## ✅ Deployment Checklist

- [ ] Build created successfully
- [ ] Files copied to server
- [ ] `.env` configured
- [ ] Dependencies installed
- [ ] Database schema imported
- [ ] Services started with PM2
- [ ] Health check passes
- [ ] Widget loads correctly
- [ ] Nginx configured (if applicable)
- [ ] SSL certificate installed
- [ ] PM2 startup configured
- [ ] Monitoring set up
- [ ] Backups configured

## 🎯 Quick Reference

```bash
# Build
npm run build:clean

# Deploy
scp -r dist/* user@server:/var/www/myleo-chatbot/

# On Server
npm install --production
pm2 start ecosystem.config.js
pm2 save

# Monitor
pm2 status
pm2 logs
pm2 monit

# Restart
pm2 restart all
```

---

**Happy Deploying! 🚀**
