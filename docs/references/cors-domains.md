# CORS Domains

Source: `server/src/lib/corsOrigins.ts`

## Current CORS Whitelist

### Production

| Domain | Purpose |
|--------|---------|
| `https://www.tarmeer.com` | Main website |
| `https://tarmeer.com` | Bare domain (redirects to www but may send API requests) |
| `https://designer.tarmeer.com` | Designer dashboard subdomain |
| `https://admin.tarmeer.com` | Admin panel |
| `http://47.91.108.104` | Production server IP (HTTP) |
| `https://47.91.108.104` | Production server IP (HTTPS) |

### Development (always included, even in production)

| Domain | Purpose |
|--------|---------|
| `http://localhost:5173` | Vite dev server (default) |
| `http://localhost:5174` | Vite dev server (alt port) |
| `http://localhost:5179` | Vite dev server (alt port) |
| `http://localhost:5180` | Vite dev server (alt port) |
| `http://localhost:5181` | Vite dev server (alt port) |
| `http://127.0.0.1:5173` | Vite dev server (loopback) |
| `http://127.0.0.1:5174` | Vite dev server (loopback alt) |
| `http://127.0.0.1:5179` | Vite dev server (loopback alt) |
| `http://127.0.0.1:5180` | Vite dev server (loopback alt) |
| `http://127.0.0.1:5181` | Vite dev server (loopback alt) |
| `http://localhost:4175` | Vite preview server |
| `http://127.0.0.1:4175` | Vite preview server (loopback) |

Additionally, the `FRONTEND_URL` environment variable (if set) is appended to the whitelist.

### CORS Config Details

- **Allowed methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed headers**: Content-Type, Authorization
- **Credentials**: true
- **Preflight cache**: 86400 seconds (24 hours)
- **Exposed headers**: Content-Length, Content-Type

## How to Add a New Domain

1. Add to the `CORS_CONFIG.production` array in `server/src/lib/corsOrigins.ts`.
2. Create an Nginx server block in `/etc/nginx/conf.d/` for the new subdomain.
3. Deploy backend: `pm2 restart tarmeer-api`.
4. Reload Nginx: `nginx -t && systemctl reload nginx`.
5. Verify:
   ```bash
   curl -sH 'Origin: https://new.tarmeer.com' -I http://localhost:3002/api/health
   ```
   Look for `Access-Control-Allow-Origin: https://new.tarmeer.com` in the response headers.
