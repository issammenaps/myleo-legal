# Nginx Configuration

This directory contains Nginx configuration files for the MyLeo Chatbot system.

## Directory Structure

```
nginx/
├── nginx.conf              # Main Nginx configuration
├── conf.d/
│   ├── default.conf        # HTTP server configuration
│   └── ssl.conf.example    # HTTPS configuration template
└── ssl/                    # SSL certificates directory
    ├── fullchain.pem       # SSL certificate (add your own)
    └── privkey.pem         # SSL private key (add your own)
```

## Files

### nginx.conf
Main Nginx configuration with:
- Worker processes
- Gzip compression
- MIME types
- Logging configuration

### conf.d/default.conf
HTTP server configuration with:
- Reverse proxy to chatbot service
- CORS headers for widget
- API routing
- Static file serving
- Security headers
- Health check endpoint

### conf.d/ssl.conf.example
HTTPS configuration template with:
- SSL/TLS settings
- Security headers
- HSTS configuration
- Same proxy settings as HTTP

## SSL Setup

### Option 1: Let's Encrypt (Production)

1. Get certificate using certbot
2. Copy certificates to `ssl/` directory
3. Enable SSL configuration:
   ```bash
   copy ssl.conf.example ssl.conf
   ```
4. Restart Nginx:
   ```bash
   docker-compose restart nginx
   ```

### Option 2: Self-Signed (Development)

```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=localhost"

# Enable SSL
copy conf.d\ssl.conf.example conf.d\ssl.conf

# Restart
docker-compose restart nginx
```

## Testing Configuration

```bash
# Test Nginx configuration
docker-compose exec nginx nginx -t

# Reload Nginx
docker-compose exec nginx nginx -s reload
```

## Customization

### Add Custom Headers

Edit `conf.d/default.conf`:

```nginx
add_header X-Custom-Header "value" always;
```

### Change CORS Settings

Edit `conf.d/default.conf`:

```nginx
add_header Access-Control-Allow-Origin "https://yourdomain.com" always;
```

### Add Rate Limiting

Add to `nginx.conf`:

```nginx
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    # In server block:
    location /api/ {
        limit_req zone=api burst=20;
        # ... rest of config
    }
}
```

## Logs

Nginx logs are available via Docker:

```bash
# Access logs
docker-compose logs nginx

# Follow logs
docker-compose logs -f nginx
```

## Troubleshooting

### Configuration Errors

```bash
# Test configuration
docker-compose exec nginx nginx -t

# Check error log
docker-compose logs nginx | grep error
```

### 502 Bad Gateway

- Check chatbot service is running: `docker-compose ps chatbot`
- Check chatbot health: `curl http://chatbot:3000/health`
- Check Nginx can reach chatbot: `docker-compose exec nginx ping chatbot`

### SSL Issues

- Verify certificates exist in `ssl/` directory
- Check certificate permissions
- Verify SSL configuration is uncommented
- Test with: `openssl s_client -connect localhost:443`

## Security Recommendations

1. **Enable HSTS** (after testing SSL)
2. **Use strong SSL ciphers**
3. **Keep Nginx updated**
4. **Limit request sizes**
5. **Enable rate limiting**
6. **Use security headers**

All of these are already configured in the provided files!
