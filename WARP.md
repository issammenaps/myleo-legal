# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Core Architecture

This is a complete chatbot system for MyLeo.legal with integrated components working together:

### Frontend Widget (`/public/widget.js`)
- Embeddable JavaScript widget with intelligent URL-based context detection
- Automatically detects rubrique (produit/compte_client/tunnel_vente/general) and product codes from page URLs
- Professional MyLeo branding with responsive design

### Backend Service (`/service/`)
- **Unified Express.js application** with integrated FAQ scheduler using worker threads
- Core services: ChatService, CacheService, ZendeskService, LanguageService
- Memory cache with FIFO eviction for FAQ performance
- Rate limiting and comprehensive security middleware
- **Built-in scheduler worker** runs FAQ sync daily at midnight

### Data Layer
- MySQL database with FAQ search optimization
- Full-text search indexes and semantic matching
- Session and conversation management with automatic cleanup
- External API/database synchronization for FAQ updates

### Automation (`/scripts/`)
- FAQ synchronization integrated via worker threads
- Manual sync capabilities via API endpoints
- Build system for production deployments

## Development Commands

### Core Development
```bash
# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Run tests
npm test
```

### FAQ Management
```bash
# Manual FAQ sync from external API
npm run sync

# Preview sync changes (dry run)
npm run sync -- --dry-run --verbose

# Start automated scheduler (runs daily at midnight)
npm run scheduler

# Test scheduler immediately
node scripts/scheduler.js --test
```

### Build & Deployment
```bash
# Create production build
npm run build

# Clean build (removes previous)
npm run build:clean

# Build widget only
npm run build-widget
```

### Docker Operations
```bash
# Start full stack (MySQL, Unified Chatbot+Scheduler, Nginx)
docker-compose up -d

# View logs for unified service
docker-compose logs -f chatbot

# Stop services
docker-compose down --remove-orphans

# Rebuild after code changes
docker-compose build --no-cache

# Check service status
docker-compose ps
```

### Production Management (PM2)
```bash
# Start unified service (includes integrated scheduler)
pm2 start ecosystem.config.js

# Monitor service
pm2 status
pm2 logs myleo-chatbot-unified
pm2 monit

# Restart service
pm2 restart myleo-chatbot-unified
```

## Environment Configuration

Required `.env` variables:
- **Database**: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **MySQL Docker**: `MYSQL_ROOT_PASSWORD` (for Docker only)
- **External API**: `EXTERNAL_API_BASE_URL`, `EXTERNAL_API_TOKEN`
- **Zendesk**: `ZENDESK_DOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_TOKEN`
- **Server**: `PORT`, `NODE_ENV`

**Important**: For Docker, use `.env.docker.example` as template. For local development, use `.env.example`.

## Key Service Architecture

### ChatService Flow
1. **Session management** with UUID-based tracking
2. **FAQ search** using text similarity scoring and full-text MySQL search
3. **Context-aware responses** based on rubrique and product codes
4. **Automatic Zendesk escalation** when needed
5. **Integrated scheduler** runs in worker thread for FAQ synchronization

### Widget Integration Pattern
```html
<script>
window.MyleoWidgetConfig = {
    apiUrl: 'http://localhost:3000/api',
    language: 'fr', // or 'en'
    rubrique: 'general', // 'produit', 'compte_client', 'tunnel_vente'
    productCode: 'PRODUCT_CODE', // optional
    autoDetectRubrique: true // enables URL-based detection
};
</script>
<script src="http://localhost:3000/widget.js"></script>
```

### Database Schema Key Points
- `faqs`: JSON qa_data storage with full-text search indexes
- `conversations`: Session tracking with rubrique/product context
- `chat_messages`: Individual messages with response time tracking

## Testing & Debugging

### Health Checks
```bash
# Basic health
curl http://localhost:3000/health

# Detailed service status (includes all services + scheduler)
curl http://localhost:3000/health/detailed

# Chat statistics
curl http://localhost:3000/api/chat/stats

# Manual FAQ sync
curl -X POST http://localhost:3000/admin/sync -H "Content-Type: application/json" -d '{"dryRun": true}'
```

### Test Pages
- `http://localhost:3000/test-detection.html` - URL detection testing
- `http://localhost:3000/demo.html` - Widget demo
- Various product/rubrique test pages available

### Logging
- Application logs: `logs/chatbot.log`
- PM2 unified logs: `logs/unified-*.log`
- Docker logs: `docker-compose logs -f chatbot`
- Enable debug: `LOG_LEVEL=debug npm run dev`
- Scheduler logs integrated in main application logs

## FAQ Sync System

The system maintains FAQ data through:
1. **External API sync** (preferred): Fetches from `EXTERNAL_API_BASE_URL`
2. **Database fallback**: Direct MySQL connection to external database
3. **Incremental updates**: Only syncs changed records based on timestamps
4. **Integrated scheduling**: Daily sync at midnight via worker thread
5. **Manual trigger**: Available via `/admin/sync` endpoint

## Security Considerations

- Rate limiting: 100 requests per 15 minutes per IP
- Input validation on all endpoints
- SQL injection prevention
- XSS protection in widget
- Helmet security headers
- CORS configuration for widget embedding

## Performance Features

- Memory cache with configurable TTL and max entries
- Database connection pooling
- Full-text search optimization
- Response time tracking
- Session cleanup automation

## Common Patterns

### Adding New FAQ Sources
1. Update external API configuration in `.env`
2. Modify sync script validation in `scripts/sync-faq-data.js`
3. Test with `npm run sync -- --dry-run --verbose`

### Widget Customization
- Themes configured in `THEME_COLORS` object
- URL detection patterns in `rubriqueMappings`
- Language files in `/languages/` directory

### Service Extension
- Services follow constructor injection pattern
- Database operations in `/service/database/`
- New routes in `/service/routes/`
- Utilities in `/service/utils/`

## Deployment Modes

1. **Development**: `npm run dev` with auto-reload (includes integrated scheduler)
2. **Docker**: Unified containerized service with `docker-compose up -d`
3. **PM2 Production**: Single process with integrated worker thread scheduler
4. **Build Distribution**: `npm run build` creates `dist/` for server deployment

## Key Architectural Changes

- **Single Container**: Eliminated separate scheduler container
- **Worker Threads**: Scheduler runs as worker thread within main process
- **Unified Logging**: All logs go through main application logger
- **Simplified Deployment**: One service to manage instead of two
- **Better Resource Usage**: Shared memory and connections between components
