# MyLeo Chatbot System

A complete, production-ready chatbot system designed for MyLeo.legal with modern UI/UX, multi-language support, FAQ search capabilities, and Zendesk integration for escalation.

## 🏗️ Architecture Overview

The system consists of four main components:

### 1. **Frontend Widget** (`/public/widget.js`)
- Embeddable JavaScript widget with MyLeo.legal inspired design
- Professional blue color scheme matching MyLeo branding
- Multi-language support (French/English)
- Contextual chat based on page section (produit, compte_client, tunnel_vente, general)
- Mobile-responsive design
- Real-time conversation with typing indicators

### 2. **Backend Service** (`/service/`)
- Express.js REST API server
- MySQL database integration with connection pooling
- Memory cache with FIFO eviction for performance
- FAQ search with text similarity scoring
- Session management with automatic cleanup
- Zendesk integration for ticket escalation
- Comprehensive logging and monitoring

### 3. **Data Synchronization** (`/scripts/sync-faq-data.js`)
- CRON-compatible script for FAQ import from external database
- Incremental sync with change tracking
- Data validation and error handling
- Dry-run mode for testing
- Progress reporting and statistics

### 4. **Configuration System** (`/config/`)
- Environment-based configuration
- Database connection management
- Zendesk API settings
- Cache and performance tuning
- Multi-language file support

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22.21.0 or higher
- **MySQL** 8.4.6 or higher
- **npm** package manager

### 1. Installation

```bash
# Clone or extract the project
cd myleao

# Install dependencies
npm install

# Create environment file
copy .env.example .env
# Edit .env with your configuration (see Configuration section below)
```

### 2. Database Setup

#### Create Chatbot Database
```sql
-- Connect to MySQL as root or admin user
CREATE DATABASE myleo_chatbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chatbot_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON myleo_chatbot.* TO 'chatbot_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Run Database Schema
```bash
# Import the schema
mysql -u chatbot_user -p myleo_chatbot < database/schema.sql
```

#### Set Up External Database Access (for FAQ sync)
```sql
-- Create readonly user for external database
CREATE USER 'readonly_user'@'localhost' IDENTIFIED BY 'your_readonly_password';
GRANT SELECT ON your_main_database.* TO 'readonly_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configuration

Edit the `.env` file with your settings:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=chatbot_user
DB_PASSWORD=your_secure_password
DB_NAME=myleo_chatbot

# External Database (for FAQ sync)
EXT_DB_HOST=localhost
EXT_DB_USER=readonly_user
EXT_DB_PASSWORD=your_readonly_password
EXT_DB_NAME=your_main_database

# Zendesk Configuration
ZENDESK_DOMAIN=myleo.zendesk.com
ZENDESK_EMAIL=support@myleo.com
ZENDESK_TOKEN=your_zendesk_token

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 4. Start the Service

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Run FAQ sync (manual)
npm run sync
```

## 🔧 MySQL Connection Guide

### Windows Installation

1. **Download MySQL 8.4.6** from the official website
2. **Install MySQL Server**:
   - Choose "Server only" installation
   - Set root password
   - Configure as Windows service

3. **Install MySQL Workbench** (optional, for GUI management)

4. **Test Connection**:
```bash
# Using MySQL command line
mysql -u root -p

# Test from Node.js project directory
node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'your_password'
    });
    console.log('✅ MySQL connection successful');
    await connection.end();
  } catch (error) {
    console.log('❌ MySQL connection failed:', error.message);
  }
})();
"
```

### Database Schema Overview

The system uses three main tables:

- **`faqs`**: Stores FAQ data with internationalization
- **`conversations`**: Tracks chat sessions and metadata
- **`chat_messages`**: Stores individual messages within conversations

Key features:
- Full-text search indexes for FAQ content
- JSON storage for Q&A data
- Foreign key relationships for data integrity
- Optimized indexes for performance

## 🎨 Widget Integration

### Basic Integration

Add this code to any webpage where you want the chatbot:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Page</title>
</head>
<body>
    <!-- Your page content -->

    <!-- MyLeo Chatbot Configuration -->
    <script>
        window.MyleoWidgetConfig = {
            apiUrl: 'http://localhost:3000/api',
            language: 'fr',                    // 'fr' or 'en'
            rubrique: 'general',               // 'produit', 'compte_client', 'tunnel_vente', 'general'
            productCode: null,                 // Optional: product code for context
            theme: 'myleo',                    // Widget theme
            position: 'bottom-right'           // Widget position
        };
    </script>

    <!-- Load MyLeo Chatbot Widget -->
    <script src="http://localhost:3000/widget.js"></script>
</body>
</html>
```

### Advanced Integration Examples

#### Product Page Integration
```html
<script>
    window.MyleoWidgetConfig = {
        apiUrl: 'https://your-chatbot-domain.com/api',
        language: 'fr',
        rubrique: 'produit',
        productCode: 'PRODUCT_123',           // Specific product context
        theme: 'myleo',
        position: 'bottom-right'
### Chat Endpoints

#### Start Conversation
```http
POST /api/chat/start
Content-Type: application/json

{
  "language": "fr",
  "rubrique": "produit",
  "productCode": "PRODUCT_123",
  "userAgent": "Mozilla/5.0..."
}
```

Response:
```json
{
  "success": true,
  "sessionId": "uuid-here",
  "welcomeMessage": "Bonjour! Comment puis-je vous aider?",
  "language": "fr",
  "rubrique": "produit"
}
```

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "sessionId": "uuid-here",
  "message": "Comment contacter le support?"
}
```

#### Escalate to Zendesk
```http
POST /api/chat/escalate
Content-Type: application/json

{
  "sessionId": "uuid-here",
  "contactData": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "0123456789",
    "subject": "Besoin d'aide",
    "availability": "Lundi-Vendredi 9h-17h"
  }
}
```

### Health Check Endpoints

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed service status
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

## 🎯 Monitoring & Logging

### Log Files

Logs are stored in `logs/` directory:
- `chatbot.log` - Main application logs
- `exceptions.log` - Unhandled exceptions
- `rejections.log` - Unhandled promise rejections

### Monitoring Endpoints

```bash
# Check service health
curl http://localhost:3000/health

# Get detailed service status
curl http://localhost:3000/health/detailed

# Get chat service statistics
curl http://localhost:3000/api/chat/stats
```

### Log Analysis

```bash
# View recent logs
tail -f logs/chatbot.log

# Search for errors
grep "ERROR" logs/chatbot.log

# View FAQ search activity
grep "FAQ Search" logs/chatbot.log | tail -20
```

## 🔐 Security Considerations

### Environment Variables

Never commit sensitive data. Use strong passwords:

```env
# Use strong database passwords
DB_PASSWORD=YourVeryStrongPassword123!

# Secure JWT secret
JWT_SECRET=YourSuperSecretJWTKey456!

# Zendesk token security
ZENDESK_TOKEN=your_actual_zendesk_api_token
```

### Rate Limiting

The system includes built-in rate limiting:
- Default: 100 requests per 15 minutes per IP
- Configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`

### Input Validation

All API endpoints include validation:
- Message length limits
- Email format validation
- SQL injection prevention
- XSS protection in widget

## 🚀 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start service/server.js --name "myleo-chatbot"

# Setup auto-restart on system boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs myleo-chatbot

# Restart application
pm2 restart myleo-chatbot
```

### Environment Setup

```bash
# Production environment
NODE_ENV=production

# Enable HTTPS (recommended)
# Use a reverse proxy like Nginx
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-chatbot-domain.com;
    
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

## 🧪 Testing

### Manual Testing

1. **Start the service**: `npm run dev`
2. **Open browser**: Go to `http://localhost:3000/health`
3. **Test widget**: Create a test HTML file with widget integration

### API Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test chat start
curl -X POST http://localhost:3000/api/chat/start \
  -H "Content-Type: application/json" \
  -d '{"language": "fr", "rubrique": "general"}'

# Test FAQ sync (dry run)
npm run sync -- --dry-run --verbose
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solution**: 
- Verify MySQL is running: `net start mysql` (Windows)
- Check connection settings in `.env`
- Ensure user has correct permissions

#### 2. Widget Not Loading
**Solution**:
- Check browser console for errors
- Verify API URL in widget configuration
- Ensure CORS is properly configured

#### 3. FAQ Sync Fails
```
Error: Unknown column 'qa_data' in 'field list'
```
**Solution**:
- Verify external database column mappings in `.env`
- Check external database structure
- Run sync with `--verbose` for detailed logging

#### 4. Zendesk Integration Issues
**Solution**:
- Verify Zendesk credentials in `.env`
- Test connection: `curl -u email/token:token https://domain.zendesk.com/api/v2/tickets.json`
- Check API token permissions

### Debug Mode

Enable debug logging:

```bash
# Set log level to debug
LOG_LEVEL=debug npm run dev

# Run with verbose sync
npm run sync -- --verbose
```

### Performance Issues

Monitor performance:

```bash
# Check cache statistics
curl http://localhost:3000/api/chat/stats

# Monitor memory usage
curl http://localhost:3000/health/detailed
```

## 📈 Performance Optimization

### Cache Configuration

Optimize cache settings in `.env`:

```env
# Increase cache size for high-traffic sites
CACHE_MAX_ENTRIES=5000

# Adjust TTL based on FAQ update frequency
CACHE_TTL=600000  # 10 minutes

# Database connection pool
DB_CONNECTION_LIMIT=20
```

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_faqs_product_lang ON faqs(product_ref, language_code, is_active);

-- Optimize full-text search
ALTER TABLE faqs ADD FULLTEXT(title, meta_keywords, meta_description);
```

## 🔄 Maintenance

### Regular Tasks

1. **Log Rotation**: Set up log rotation to prevent disk space issues
2. **Database Cleanup**: Archive old conversations periodically
3. **Cache Monitoring**: Monitor cache hit rates and adjust settings
4. **Security Updates**: Keep dependencies updated

### Backup Strategy

```bash
# Database backup
mysqldump -u chatbot_user -p myleo_chatbot > backup_$(date +%Y%m%d_%H%M%S).sql

# Configuration backup
cp .env .env.backup.$(date +%Y%m%d)
```

## 📞 Support

For technical support or questions:

1. Check this README and troubleshooting section
2. Review application logs in `logs/` directory
3. Use health check endpoints for system status
4. Contact the development team with specific error messages and logs

## 📄 License

Copyright (c) 2024 MyLeo. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

---

**Built with ❤️ for MyLeo.legal**

*Professional legal technology solutions that empower access to justice.*