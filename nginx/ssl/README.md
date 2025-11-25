# SSL Certificates Directory

Place your SSL certificates in this directory:

- `fullchain.pem` - Full certificate chain
- `privkey.pem` - Private key

## For Let's Encrypt:

Certificates are typically located at:
```
/etc/letsencrypt/live/your-domain/fullchain.pem
/etc/letsencrypt/live/your-domain/privkey.pem
```

Copy them here:
```bash
cp /etc/letsencrypt/live/your-domain/fullchain.pem ./fullchain.pem
cp /etc/letsencrypt/live/your-domain/privkey.pem ./privkey.pem
```

## For Self-Signed (Development):

Generate with:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=localhost"
```

## Security

⚠️ **Never commit real SSL certificates to version control!**

Add to .gitignore:
```
nginx/ssl/*.pem
nginx/ssl/*.key
nginx/ssl/*.crt
```
