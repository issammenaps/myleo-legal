# 🐳 Docker Setup Complete!

## ✅ What Was Created

Your complete Docker deployment system is ready!

### Docker Files Created

1. **Dockerfile** - Main chatbot service image
2. **Dockerfile.scheduler** - FAQ sync scheduler image
3. **docker-compose.yml** - Complete orchestration with 4 services
4. **.dockerignore** - Optimized build context
5. **.env.docker.example** - Environment template

### Nginx Configuration

1. **nginx/nginx.conf** - Main Nginx configuration
2. **nginx/conf.d/default.conf** - HTTP server configuration
3. **nginx/conf.d/ssl.conf.example** - HTTPS template
4. **nginx/ssl/** - Directory for SSL certificates

### Scripts

1. **docker-start.bat** - Windows quick start
2. **docker-start.sh** - Linux/Mac quick start

### Documentation

1. **DOCKER_GUIDE.md** - Complete deployment guide

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              Nginx (Port 80/443)            │
│         Reverse Proxy + SSL + CORS          │
└─────────────┬───────────────────────────────┘
              │
              ├──────────────┬─────────────────┐
              │              │                 │
    ┌─────────▼────────┐    │    ┌───────────▼──────────┐
    │  Chatbot Service │    │    │   FAQ Scheduler      │
    │   (Port 3000)    │    │    │  (Runs at midnight)  │
    │   - API          │    │    │  - Sync FAQs         │
    │   - Widget       │    │    │  - node-cron         │
    │   - Health       │    │    └──────────┬───────────┘
    └─────────┬────────┘    │               │
              │             │               │
              └─────────────┴───────────────┘
                            │
                   ┌────────▼────────┐
                   │  MySQL Database │
                   │   (Port 3306)   │
                   │  - Persistent   │
                   └─────────────────┘
```

## 🚀 Quick Start

### Option 1: Using Quick Start Script

**Windows:**
```cmd
docker-start.bat
```

**Linux/Mac:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

### Option 2: Manual Setup

```bash
# 1. Configure environment
copy .env.docker.example .env
notepad .env  # Edit with your settings

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps

# 4. View logs
docker-compose logs -f
```

## 📦 Services Included

### 1. MySQL Database
- **Image:** mysql:8.4
- **Port:** 3306
- **Volume:** Persistent storage
- **Auto-init:** Runs schema.sql on first start

### 2. Chatbot Service
- **Build:** From Dockerfile
- **Port:** 3000 (internal), 80/443 (via Nginx)
- **Features:**
  - Express.js API
  - Widget serving
  - Health checks
  - Auto-restart

### 3. FAQ Scheduler
- **Build:** From Dockerfile.scheduler
- **Schedule:** Every midnight (00:00)
- **Features:**
  - Automatic FAQ sync
  - node-cron based
  - Logging

### 4. Nginx Reverse Proxy
- **Image:** nginx:alpine
- **Ports:** 80 (HTTP), 443 (HTTPS)
- **Features:**
  - Reverse proxy
  - CORS headers
  - SSL/TLS support
  - Gzip compression
  - Security headers
  - Static file serving

## 🔧 Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Database
MYSQL_ROOT_PASSWORD=your_secure_password
DB_NAME=myleo_chatbot
DB_USER=chatbot_user
DB_PASSWORD=your_password

# External API
EXTERNAL_API_BASE_URL=https://api.myleo.legal
EXTERNAL_API_TOKEN=your_token

# Zendesk
ZENDESK_DOMAIN=myleo.zendesk.com
ZENDESK_EMAIL=support@myleo.com
ZENDESK_TOKEN=your_token
```

## 🎯 Access Points

After starting with `docker-compose up -d`:

- **Application:** http://localhost
- **API:** http://localhost/api
- **Health Check:** http://localhost/health
- **Widget:** http://localhost/widget.js
- **Demo:** http://localhost/demo

## 📊 Management Commands

### Start/Stop

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Restart services
docker-compose restart
```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f chatbot
docker-compose logs -f scheduler
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100
```

### Status

```bash
# Check running containers
docker-compose ps

# Resource usage
docker stats

# Health checks
curl http://localhost/health
```

### Rebuild

```bash
# Rebuild all images
docker-compose build

# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose build chatbot
```

## 🔒 SSL/HTTPS Setup

### For Production

1. **Get SSL certificate** (Let's Encrypt recommended)
2. **Place certificates** in `nginx/ssl/`
   - `fullchain.pem`
   - `privkey.pem`
3. **Enable SSL config:**
   ```bash
   copy nginx\conf.d\ssl.conf.example nginx\conf.d\ssl.conf
   ```
4. **Edit SSL config** with your domain
5. **Restart Nginx:**
   ```bash
   docker-compose restart nginx
   ```

### For Development (Self-Signed)

```bash
# Generate self-signed certificate
docker-compose exec nginx sh -c "
  mkdir -p /etc/nginx/ssl &&
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj '/CN=localhost'
"

# Enable SSL
copy nginx\conf.d\ssl.conf.example nginx\conf.d\ssl.conf

# Restart
docker-compose restart nginx
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Verify configuration
docker-compose config

# Check port conflicts
netstat -ano | findstr :80
```

### Database Issues

```bash
# Check MySQL logs
docker-compose logs mysql

# Access MySQL
docker-compose exec mysql mysql -u root -p

# Reset database (⚠️ deletes data)
docker-compose down -v
docker-compose up -d
```

### Rebuild Everything

```bash
# Stop and remove everything
docker-compose down -v --rmi all

# Rebuild and start
docker-compose up -d --build
```

## 📈 Production Checklist

- [ ] Configure strong passwords in `.env`
- [ ] Set up SSL certificates
- [ ] Configure domain name in Nginx
- [ ] Set up firewall rules
- [ ] Configure backup strategy
- [ ] Set up monitoring
- [ ] Test all endpoints
- [ ] Review security headers
- [ ] Set up log rotation
- [ ] Configure auto-restart policies

## 🔄 Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## 💾 Backup

### Database Backup

```bash
# Backup
docker-compose exec mysql mysqldump -u root -p myleo_chatbot > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T mysql mysql -u root -p myleo_chatbot < backup.sql
```

### Volume Backup

```bash
# Backup MySQL volume
docker run --rm -v myleao_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data
```

## 📚 Documentation

- **DOCKER_GUIDE.md** - Complete Docker deployment guide
- **BUILD_GUIDE.md** - Build and deployment guide
- **README.md** - Project overview

## ✨ Features

✅ **Complete Docker Setup**
- Multi-container orchestration
- Service dependencies
- Health checks
- Auto-restart policies

✅ **Production Ready**
- Nginx reverse proxy
- SSL/HTTPS support
- Security headers
- CORS configuration

✅ **Easy Management**
- Quick start scripts
- Simple commands
- Comprehensive logging
- Health monitoring

✅ **Scalable**
- Can scale chatbot service
- Load balancing ready
- Docker Swarm compatible

## 🎉 Summary

Your Docker deployment is ready!

**To start:**
```bash
# Windows
docker-start.bat

# Linux/Mac
./docker-start.sh
```

**To access:**
- Open browser: http://localhost
- Check health: http://localhost/health

**To monitor:**
```bash
docker-compose logs -f
```

**To stop:**
```bash
docker-compose down
```

---

**See DOCKER_GUIDE.md for complete documentation!**

**Happy Deploying! 🐳🚀**
