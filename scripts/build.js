#!/usr/bin/env node

/**
 * MyLeo Chatbot Build Script
 * 
 * This script creates a production-ready build of the chatbot system.
 * It prepares all necessary files for deployment.
 * 
 * Usage:
 *   node scripts/build.js [--clean] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildSystem {
    constructor(options = {}) {
        this.options = {
            clean: options.clean || false,
            verbose: options.verbose || false,
            ...options
        };

        this.rootDir = path.join(__dirname, '..');
        this.buildDir = path.join(this.rootDir, 'dist');
        this.startTime = new Date();
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

        if (level === 'debug' && !this.options.verbose) {
            return;
        }

        console.log(`${timestamp} ${levelMap[level] || 'ℹ️'} ${message}`);
    }

    async build() {
        try {
            this.log('='.repeat(60));
            this.log('MYLEO CHATBOT BUILD SYSTEM', 'info');
            this.log('='.repeat(60));

            // Step 1: Clean build directory
            if (this.options.clean) {
                await this.cleanBuildDir();
            }

            // Step 2: Create build directory structure
            await this.createBuildStructure();

            // Step 3: Copy source files
            await this.copySourceFiles();

            // Step 4: Copy configuration files
            await this.copyConfigFiles();

            // Step 5: Copy public assets
            await this.copyPublicAssets();

            // Step 6: Install production dependencies
            await this.installProductionDependencies();

            // Step 7: Create deployment scripts
            await this.createDeploymentScripts();

            // Step 8: Create README
            await this.createBuildReadme();

            // Final statistics
            this.logBuildStats();

            this.log('='.repeat(60));
            this.log('BUILD COMPLETED SUCCESSFULLY!', 'success');
            this.log('='.repeat(60));
            this.log(`Build output: ${this.buildDir}`, 'success');

        } catch (error) {
            this.log(`Build failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async cleanBuildDir() {
        this.log('Cleaning build directory...', 'info');

        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true, force: true });
            this.log('Build directory cleaned', 'success');
        }
    }

    async createBuildStructure() {
        this.log('Creating build directory structure...', 'info');

        const dirs = [
            this.buildDir,
            path.join(this.buildDir, 'service'),
            path.join(this.buildDir, 'service', 'routes'),
            path.join(this.buildDir, 'service', 'services'),
            path.join(this.buildDir, 'service', 'database'),
            path.join(this.buildDir, 'service', 'utils'),
            path.join(this.buildDir, 'config'),
            path.join(this.buildDir, 'public'),
            path.join(this.buildDir, 'scripts'),
            path.join(this.buildDir, 'logs'),
            path.join(this.buildDir, 'database')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                this.log(`Created: ${path.relative(this.rootDir, dir)}`, 'debug');
            }
        });

        this.log('Directory structure created', 'success');
    }

    async copySourceFiles() {
        this.log('Copying source files...', 'info');

        const filesToCopy = [
            // Service files
            { src: 'service/server.js', dest: 'service/server.js' },
            { src: 'service/routes/chat.js', dest: 'service/routes/chat.js' },
            { src: 'service/routes/health.js', dest: 'service/routes/health.js' },
            { src: 'service/services/chatService.js', dest: 'service/services/chatService.js' },
            { src: 'service/services/faqService.js', dest: 'service/services/faqService.js' },
            { src: 'service/services/zendeskService.js', dest: 'service/services/zendeskService.js' },
            { src: 'service/database/database.js', dest: 'service/database/database.js' },
            { src: 'service/utils/cache.js', dest: 'service/utils/cache.js' },
            { src: 'service/utils/logger.js', dest: 'service/utils/logger.js' },

            // Scripts
            { src: 'scripts/sync-faq-data.js', dest: 'scripts/sync-faq-data.js' },
            { src: 'scripts/scheduler.js', dest: 'scripts/scheduler.js' },

            // Database
            { src: 'database/schema.sql', dest: 'database/schema.sql' }
        ];

        let copiedCount = 0;
        filesToCopy.forEach(({ src, dest }) => {
            const srcPath = path.join(this.rootDir, src);
            const destPath = path.join(this.buildDir, dest);

            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                this.log(`Copied: ${src}`, 'debug');
                copiedCount++;
            } else {
                this.log(`Warning: ${src} not found`, 'warn');
            }
        });

        this.log(`Copied ${copiedCount} source files`, 'success');
    }

    async copyConfigFiles() {
        this.log('Copying configuration files...', 'info');

        // Copy config directory
        const configSrc = path.join(this.rootDir, 'config');
        const configDest = path.join(this.buildDir, 'config');

        if (fs.existsSync(configSrc)) {
            this.copyDirectory(configSrc, configDest);
        }

        // Create .env.example
        const envExample = path.join(this.rootDir, '.env.example');
        if (fs.existsSync(envExample)) {
            fs.copyFileSync(envExample, path.join(this.buildDir, '.env.example'));
        } else {
            // Create a template .env.example
            const envTemplate = `# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=chatbot_user
DB_PASSWORD=your_secure_password
DB_NAME=myleo_chatbot

# External API Configuration
EXTERNAL_API_BASE_URL=https://api.myleo.legal
EXTERNAL_API_TOKEN=your_api_token
EXTERNAL_API_FAQ_ENDPOINT=/api/faqs
EXTERNAL_API_MAX_RECORDS=1000

# Zendesk Configuration
ZENDESK_DOMAIN=myleo.zendesk.com
ZENDESK_EMAIL=support@myleo.com
ZENDESK_TOKEN=your_zendesk_token

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Cache Configuration
CACHE_MAX_ENTRIES=1000
CACHE_TTL=300000
`;
            fs.writeFileSync(path.join(this.buildDir, '.env.example'), envTemplate);
        }

        this.log('Configuration files copied', 'success');
    }

    async copyPublicAssets() {
        this.log('Copying public assets...', 'info');

        const publicSrc = path.join(this.rootDir, 'public');
        const publicDest = path.join(this.buildDir, 'public');

        if (fs.existsSync(publicSrc)) {
            this.copyDirectory(publicSrc, publicDest);
            this.log('Public assets copied', 'success');
        } else {
            this.log('No public directory found', 'warn');
        }
    }

    async installProductionDependencies() {
        this.log('Installing production dependencies...', 'info');

        // Copy package.json
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8')
        );

        // Remove devDependencies for production
        delete packageJson.devDependencies;

        // Update scripts for production
        packageJson.scripts = {
            start: 'node service/server.js',
            sync: 'node scripts/sync-faq-data.js',
            scheduler: 'node scripts/scheduler.js'
        };

        fs.writeFileSync(
            path.join(this.buildDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // Copy package-lock.json if exists
        const packageLock = path.join(this.rootDir, 'package-lock.json');
        if (fs.existsSync(packageLock)) {
            fs.copyFileSync(packageLock, path.join(this.buildDir, 'package-lock.json'));
        }

        this.log('Package files prepared', 'success');
        this.log('Run "npm install --production" in dist/ to install dependencies', 'info');
    }

    async createDeploymentScripts() {
        this.log('Creating deployment scripts...', 'info');

        // Create ecosystem.config.js for PM2
        const ecosystemConfig = `module.exports = {
  apps: [
    {
      name: 'myleo-chatbot-service',
      script: './service/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/service-error.log',
      out_file: './logs/service-out.log',
      log_file: './logs/service-combined.log',
      time: true
    },
    {
      name: 'faq-sync-scheduler',
      script: './scripts/scheduler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log',
      log_file: './logs/scheduler-combined.log',
      time: true
    }
  ]
};
`;
        fs.writeFileSync(path.join(this.buildDir, 'ecosystem.config.js'), ecosystemConfig);

        // Create start.sh for Linux/Mac
        const startSh = `#!/bin/bash
# MyLeo Chatbot Startup Script

echo "Starting MyLeo Chatbot System..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Start with PM2
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    echo "Services started successfully!"
    echo "View status: pm2 status"
    echo "View logs: pm2 logs"
else
    echo "PM2 not found. Starting in foreground..."
    node service/server.js
fi
`;
        fs.writeFileSync(path.join(this.buildDir, 'start.sh'), startSh);

        // Create start.bat for Windows
        const startBat = `@echo off
REM MyLeo Chatbot Startup Script

echo Starting MyLeo Chatbot System...

REM Check if .env exists
if not exist .env (
    echo Error: .env file not found!
    echo Please copy .env.example to .env and configure it.
    exit /b 1
)

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install --production
)

REM Start with PM2
where pm2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting with PM2...
    call pm2 start ecosystem.config.js
    call pm2 save
    echo Services started successfully!
    echo View status: pm2 status
    echo View logs: pm2 logs
) else (
    echo PM2 not found. Starting in foreground...
    node service/server.js
)
`;
        fs.writeFileSync(path.join(this.buildDir, 'start.bat'), startBat);

        this.log('Deployment scripts created', 'success');
    }

    async createBuildReadme() {
        this.log('Creating deployment README...', 'info');

        const readme = `# MyLeo Chatbot - Production Build

This is a production-ready build of the MyLeo Chatbot System.

## Quick Start

### 1. Configure Environment

\`\`\`bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual configuration
nano .env  # or use any text editor
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install --production
\`\`\`

### 3. Setup Database

\`\`\`bash
# Import the database schema
mysql -u your_user -p your_database < database/schema.sql
\`\`\`

### 4. Start the Application

**Using PM2 (Recommended for Production):**

\`\`\`bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-start on boot (Linux/Mac)
pm2 startup

# View status
pm2 status

# View logs
pm2 logs
\`\`\`

**Using Start Scripts:**

\`\`\`bash
# Linux/Mac
chmod +x start.sh
./start.sh

# Windows
start.bat
\`\`\`

**Manual Start:**

\`\`\`bash
# Start chatbot service
node service/server.js

# In another terminal, start scheduler
node scripts/scheduler.js
\`\`\`

## What's Included

- ✅ Chatbot service (Express.js API)
- ✅ FAQ synchronization scheduler (runs every midnight)
- ✅ Widget files (public/)
- ✅ Database schema
- ✅ PM2 configuration
- ✅ Startup scripts

## Services

### 1. Chatbot Service
- **Port:** 3000 (configurable via .env)
- **Endpoint:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/health

### 2. FAQ Sync Scheduler
- **Schedule:** Every day at midnight (00:00)
- **Timezone:** Europe/Paris (configurable)
- **Manual sync:** \`npm run sync\`

## Environment Variables

See \`.env.example\` for all required configuration options.

Key variables:
- \`DB_HOST\`, \`DB_USER\`, \`DB_PASSWORD\`, \`DB_NAME\` - Database connection
- \`EXTERNAL_API_BASE_URL\`, \`EXTERNAL_API_TOKEN\` - External FAQ API
- \`ZENDESK_DOMAIN\`, \`ZENDESK_EMAIL\`, \`ZENDESK_TOKEN\` - Zendesk integration
- \`PORT\` - Server port (default: 3000)
- \`NODE_ENV\` - Environment (production/development)

## Monitoring

\`\`\`bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs

# Check status
pm2 status

# Restart services
pm2 restart all
\`\`\`

## Troubleshooting

### Service won't start
- Check \`.env\` configuration
- Verify database connection
- Check logs: \`pm2 logs\` or \`logs/\` directory

### Database connection failed
- Verify MySQL is running
- Check database credentials in \`.env\`
- Ensure database exists and schema is imported

### Widget not loading
- Check CORS configuration
- Verify API URL in widget configuration
- Check browser console for errors

## Support

For issues or questions, check the logs:
- Service logs: \`logs/service-*.log\`
- Scheduler logs: \`logs/scheduler-*.log\`

---

**Build Date:** ${new Date().toISOString()}
**Version:** ${JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8')).version}
`;

        fs.writeFileSync(path.join(this.buildDir, 'README.md'), readme);
        this.log('Deployment README created', 'success');
    }

    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                this.log(`Copied: ${path.relative(this.rootDir, srcPath)}`, 'debug');
            }
        }
    }

    logBuildStats() {
        const duration = new Date() - this.startTime;
        const seconds = (duration / 1000).toFixed(2);

        // Calculate build size
        const buildSize = this.getDirectorySize(this.buildDir);
        const buildSizeMB = (buildSize / 1024 / 1024).toFixed(2);

        this.log('='.repeat(60));
        this.log('BUILD STATISTICS', 'info');
        this.log('='.repeat(60));
        this.log(`Build directory: ${this.buildDir}`);
        this.log(`Build size: ${buildSizeMB} MB`);
        this.log(`Build time: ${seconds} seconds`);
        this.log('='.repeat(60));
    }

    getDirectorySize(dirPath) {
        let size = 0;

        if (!fs.existsSync(dirPath)) {
            return size;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                size += this.getDirectorySize(fullPath);
            } else {
                size += fs.statSync(fullPath).size;
            }
        }

        return size;
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        clean: args.includes('--clean'),
        verbose: args.includes('--verbose') || args.includes('-v')
    };

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
MyLeo Chatbot Build System

Usage: node scripts/build.js [options]

Options:
  --clean       Clean build directory before building
  --verbose     Enable verbose logging
  --help, -h    Show this help message

Examples:
  node scripts/build.js                # Build
  node scripts/build.js --clean        # Clean build
  node scripts/build.js --verbose      # Verbose output
    `);
        process.exit(0);
    }

    const builder = new BuildSystem(options);

    try {
        await builder.build();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Build failed: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = BuildSystem;
