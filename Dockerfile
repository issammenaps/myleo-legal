# MyLeo Chatbot - Unified Production Dockerfile
# Combines chatbot service with integrated FAQ scheduler using worker threads
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    mysql-client \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files first for better caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Copy application files
COPY service/ ./service/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY public/ ./public/
COPY database/ ./database/
COPY languages/ ./languages/

# Create necessary directories
RUN mkdir -p logs && \
    chmod -R 755 scripts/ && \
    chmod -R 755 service/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S myleo -u 1001

# Change ownership of app directory
RUN chown -R myleo:nodejs /app

# Switch to non-root user
USER myleo

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose port
EXPOSE 3000

# Enhanced health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the unified application (chatbot + scheduler)
CMD ["node", "service/server.js"]
