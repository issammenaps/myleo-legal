# 🐳 MyLeo Chatbot - Docker Deployment Guide

Complete guide for deploying the MyLeo Chatbot system using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services Overview](#services-overview)
- [Running the Application](#running-the-application)
- [SSL/HTTPS Setup](#sslhttps-setup)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## 🔧 Prerequisites

- **Docker** 20.10+ installed
- **Docker Compose** 2.0+ installed
- **Ports available:** 80, 443, 3000, 3306

### Install Docker

**Windows:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Verify installation:**
```bash
docker --version
docker-compose --version
```

## 🚀 Quick Start

### 1. Configure Environment

```bash
# Copy the example environment file
copy .env.docker.example .env

# Edit with your configuration
notepad .env  # Windows
nano .env     # Linux/Mac
```

**Required configurations:**
- `MYSQL_ROOT_PASSWORD` - MySQL root password
- `DB_PASSWORD` - Database user password
- `EXTERNAL_API_TOKEN` - Your API token
- `ZENDESK_TOKEN` - Zendesk API token

### 2. Build and Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Verify

```bash
# Check health
curl http://localhost/health

# Should return: {"status":"ok","timestamp":"..."}

# Access the application
# Open browser: http://localhost
```

## ⚙️ Configuration

### Environment Variables (.env)

Create a `.env` file from `.env.docker.example`:

```env
# Database
MYSQL_ROOT_PASSWORD=your_secure_root_password
DB_NAME=myleo_chatbot
DB_USER=chatbot_user
DB_PASSWORD=your_secure_password

# External API
EXTERNAL_API_BASE_URL=https://api.myleo.legal
EXTERNAL_API_TOKEN=your_api_token

# Zendesk
ZENDESK_DOMAIN=myleo.zendesk.com
ZENDESK_EMAIL=support@myleo.com
ZENDESK_TOKEN=your_zendesk_token

# Application
LOG_LEVEL=info
CACHE_MAX_ENTRIES=1000
```

## 🏗️ Services Overview

The Docker Compose setup includes 4 services:

### 1. MySQL Database (`mysql`)
- **Image:** mysql:8.4
- **Port:** 3306
- **Volume:** Persistent data storage
- **Auto-init:** Runs schema.sql on first start

### 2. Chatbot Service (`chatbot`)
- **Port:** 3000 (internal), 80/443 (via Nginx)
- **Health Check:** Every 30s
- **Restart:** Unless stopped
- **Logs:** ./logs directory

### 3. FAQ Scheduler (`scheduler`)
- **Schedule:** Every midnight (00:00)
- **Depends on:** MySQL
- **Logs:** ./logs directory

### 4. Nginx Reverse Proxy (`nginx`)
- **Ports:** 80 (HTTP), 443 (HTTPS)
- **Features:**
  - Reverse proxy to chatbot service
  - CORS headers for widget
  - Static file serving
  - SSL/TLS termination (when configured)
  - Gzip compression
  - Security headers

## 🎯 Running the Application

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d chatbot

# Start with build
docker-compose up -d --build
```

### Stop Services

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop chatbot

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (⚠️ deletes database)
docker-compose down -v
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart chatbot
```

### Rebuild Services

```bash
# Rebuild all images
docker-compose build

# Rebuild specific service
docker-compose build chatbot

# Rebuild and restart
docker-compose up -d --build
```

## 🔒 SSL/HTTPS Setup

### Option 1: Using Let's Encrypt (Recommended)

1. **Update docker-compose.yml** to use certbot:

```yaml
services:
  certbot:
    image: certbot/certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - ./nginx/certbot-webroot:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d chatbot.myleo.com
```

2. **Get certificate:**

```bash
# First time
docker-compose run --rm certbot

# Renew (add to cron)
docker-compose run --rm certbot renew
```

3. **Enable SSL in Nginx:**

```bash
# Copy SSL configuration
copy nginx\conf.d\ssl.conf.example nginx\conf.d\ssl.conf

# Edit and uncomment the SSL server block
notepad nginx\conf.d\ssl.conf

# Restart Nginx
docker-compose restart nginx
```

### Option 2: Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate
docker-compose exec nginx sh -c "
  mkdir -p /etc/nginx/ssl &&
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/privkey.pem \
    -out /etc/nginx/ssl/fullchain.pem \
    -subj '/CN=localhost'
"

# Enable SSL configuration
copy nginx\conf.d\ssl.conf.example nginx\conf.d\ssl.conf

# Restart Nginx
docker-compose restart nginx
```

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f chatbot
docker-compose logs -f scheduler
docker-compose logs -f nginx
docker-compose logs -f mysql

# Last 100 lines
docker-compose logs --tail=100 chatbot

# Since specific time
docker-compose logs --since 2024-01-01T00:00:00 chatbot
```

### Check Service Status

```bash
# List containers
docker-compose ps

# Detailed info
docker-compose ps -a

# Resource usage
docker stats
```

### Health Checks

```bash
# Check chatbot health
curl http://localhost/health

# Check Nginx
curl -I http://localhost

# Check MySQL
docker-compose exec mysql mysqladmin ping -h localhost -u root -p
```

### Access Container Shell

```bash
# Chatbot service
docker-compose exec chatbot sh

# MySQL
docker-compose exec mysql mysql -u root -p

# Nginx
docker-compose exec nginx sh
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs chatbot

# Verify configuration
docker-compose config

# Check port conflicts
netstat -ano | findstr :80
netstat -ano | findstr :3000
```

### Database Connection Issues

```bash
# Check MySQL is running
docker-compose ps mysql

# Test connection
docker-compose exec mysql mysql -u chatbot_user -p myleo_chatbot

# Check environment variables
docker-compose exec chatbot env | grep DB_

# Restart MySQL
docker-compose restart mysql
```

### Nginx Issues

```bash
# Test Nginx configuration
docker-compose exec nginx nginx -t

# Reload Nginx
docker-compose exec nginx nginx -s reload

# Check Nginx logs
docker-compose logs nginx
```

### Rebuild from Scratch

```bash
# Stop everything
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild and start
docker-compose up -d --build
```

### Reset Database

```bash
# ⚠️ This will delete all data!

# Stop services
docker-compose stop

# Remove database volume
docker volume rm myleao_mysql_data

# Restart (will re-initialize)
docker-compose up -d
```

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Configure strong passwords in `.env`
- [ ] Set up SSL certificates
- [ ] Configure domain name
- [ ] Set up firewall rules
- [ ] Configure backup strategy
- [ ] Set up monitoring
- [ ] Test all endpoints

### Security Best Practices

1. **Use Strong Passwords**
   ```bash
   # Generate secure password
   openssl rand -base64 32
   ```

2. **Limit Port Exposure**
   ```yaml
   # In docker-compose.yml, only expose Nginx
   ports:
     - "80:80"
     - "443:443"
   # Remove other port mappings
   ```

3. **Use Docker Secrets** (Docker Swarm)
   ```yaml
   secrets:
     db_password:
       external: true
   ```

4. **Regular Updates**
   ```bash
   # Update images
   docker-compose pull
   docker-compose up -d
   ```

### Backup Strategy

#### Database Backup

```bash
# Backup database
docker-compose exec mysql mysqldump -u root -p myleo_chatbot > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T mysql mysql -u root -p myleo_chatbot < backup_20231125.sql
```

#### Volume Backup

```bash
# Backup MySQL volume
docker run --rm -v myleao_mysql_data:/data -v $(pwd):/backup alpine tar czf /backup/mysql_backup.tar.gz /data

# Restore MySQL volume
docker run --rm -v myleao_mysql_data:/data -v $(pwd):/backup alpine tar xzf /backup/mysql_backup.tar.gz -C /
```

### Automated Backups

Create a backup script `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker-compose exec -T mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} myleo_chatbot > ${BACKUP_DIR}/db_${DATE}.sql

# Compress
gzip ${BACKUP_DIR}/db_${DATE}.sql

# Keep only last 7 days
find ${BACKUP_DIR} -name "db_*.sql.gz" -mtime +7 -delete
```

Add to cron:
```bash
0 2 * * * /path/to/backup.sh
```

### Scaling

#### Scale Chatbot Service

```bash
# Run multiple instances
docker-compose up -d --scale chatbot=3

# Nginx will load balance automatically
```

#### Use Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml myleo

# Scale service
docker service scale myleo_chatbot=3
```

## 📈 Monitoring with Prometheus & Grafana (Optional)

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          ssh user@server 'cd /app && git pull && docker-compose up -d --build'
```

## 📞 Support

### Useful Commands

```bash
# View all containers
docker ps -a

# View all images
docker images

# View all volumes
docker volume ls

# Clean up unused resources
docker system prune -a

# View Docker disk usage
docker system df
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in docker-compose.yml or stop conflicting service |
| Permission denied | Run with sudo or add user to docker group |
| Out of disk space | Run `docker system prune -a` |
| Container keeps restarting | Check logs with `docker-compose logs` |

## ✅ Quick Reference

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build

# Status
docker-compose ps

# Shell access
docker-compose exec chatbot sh

# Database backup
docker-compose exec mysql mysqldump -u root -p myleo_chatbot > backup.sql
```

---

**Happy Deploying with Docker! 🐳**
