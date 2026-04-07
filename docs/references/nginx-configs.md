# Nginx Configs

Source files: `nginx-tarmeer.conf`, `nginx-admin.conf`

## www.tarmeer.com

File: `nginx-tarmeer.conf`

### HTTP to HTTPS redirect (port 80)

```
server_name: www.tarmeer.com, tarmeer.com
Action: 301 redirect to https://www.tarmeer.com$request_uri
```

Both the bare domain and www variant on port 80 redirect to HTTPS www.

### Bare domain HTTPS redirect (port 443)

```
server_name: tarmeer.com
Action: 301 redirect to https://www.tarmeer.com$request_uri
```

Ensures `https://tarmeer.com/anything` always becomes `https://www.tarmeer.com/anything`.

### Main site (port 443)

```
server_name: www.tarmeer.com
root: /tarmeer/tarmeer_web_portal
index: index.html
```

Key location blocks:

| Path | Behavior |
|------|----------|
| `/uploads/` | Proxied to `http://localhost:3002/uploads/` (backend serves uploaded files) |
| `/api/` | Proxied to `http://localhost:3002/api/` with WebSocket upgrade headers |
| `/` | SPA fallback: `try_files $uri $uri/ /index.html` |

Additional settings:
- `client_max_body_size 25m` -- max upload size.
- SSL certificate at `/cicd/tarmeer.com_nginx/tarmeer.com_bundle.pem`.
- Security headers: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`.

## admin.tarmeer.com

File: `nginx-admin.conf`

### HTTP to HTTPS redirect (port 80)

```
server_name: admin.tarmeer.com
Action: 301 redirect to https://admin.tarmeer.com$request_uri
```

### Main admin site (port 443)

```
server_name: admin.tarmeer.com
root: /tarmeer/tarmeer_web_portal  (same build as main site)
index: index.html
```

Key location blocks:

| Path | Behavior |
|------|----------|
| `= /` | 302 redirect to `/admin/login` (forces admin login page as landing) |
| `/uploads/` | Proxied to `http://localhost:3002/uploads/` |
| `/api/` | Proxied to `http://localhost:3002/api/` with WebSocket upgrade headers |
| `~* \.(js\|css\|png\|...)$` | Static assets with 1-year cache (`Cache-Control: public, max-age=31536000`) |
| `/` | SPA fallback: `try_files $uri $uri/ /index.html` |

Same SSL certificate, upload size limit, and security headers as the main site.

## Key Principles

1. **Every domain needs an explicit server block.** Nginx will reject requests to unconfigured server names or route them to the default server (which may not be what you want).

2. **Both sites serve the same SPA build** from `/tarmeer/tarmeer_web_portal`. The React app's router handles showing admin pages vs. public pages based on the URL path.

3. **API proxy is identical** on both domains -- both forward `/api/` to `localhost:3002`. The backend does not distinguish which domain the request came from (CORS handles access control).

4. **Image URL rewriting**: The frontend detects when running on `admin.tarmeer.com` and rewrites root-relative image paths (like `/images/...`) to `https://www.tarmeer.com/images/...` so that static assets served by nginx under the www root load correctly. See `src/lib/imageUrl.ts` and `src/lib/imageCleanup.ts`.
