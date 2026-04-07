# Security Policy

---

## CORS Policy

### Current Production Whitelist

Defined in `server/src/lib/corsOrigins.ts`:

```
https://www.tarmeer.com
https://tarmeer.com
https://designer.tarmeer.com
https://admin.tarmeer.com
http://47.91.108.104
https://47.91.108.104
```

Development origins (localhost ports 5173, 5174, 5179, 5180, 5181, 4175) are always included.

### How to Add a New Domain

1. Open `server/src/lib/corsOrigins.ts`.
2. Add the new origin URL to the `production` array in `CORS_CONFIG` (include the scheme, e.g. `https://new.tarmeer.com`).
3. Create an Nginx server block for the new subdomain on the ECS host.
4. If the subdomain serves a frontend app, configure Nginx to proxy `/api` requests to the backend.
5. Deploy the backend (`deploy-backend-ecs.sh`) so the updated CORS config takes effect.
6. Test from the new domain: open browser DevTools and confirm no CORS errors on API calls.
7. Update this document and `RELIABILITY.md` with the new domain.

### CORS Behavior

- Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- Allowed headers: `Content-Type`, `Authorization`
- Credentials: enabled
- Preflight cache (`Access-Control-Max-Age`): 86400 seconds (24 hours)
- CORS violations are logged via `logCorsViolation()` with the blocked origin and path.

---

## Anti-Scraping

Implemented in `server/src/middleware/antiScraping.ts`.

### Blocked User-Agent Patterns

Requests matching any of these patterns receive HTTP 403:

| Pattern | Target |
|---|---|
| `python-requests` | Python requests library |
| `scrapy` | Scrapy framework |
| `httpclient` | Generic HTTP clients |
| `java/` | Java HTTP clients |
| `wget` | wget |
| `curl` | curl |
| `libwww` | libwww-perl |
| `lwp-trivial` | Perl LWP |
| `php/` | PHP HTTP clients |
| `go-http-client` | Go stdlib |
| `node-fetch` | Node.js fetch |
| `axios` | Axios |
| `undici` | Undici |

Requests with **no User-Agent** are also blocked (HTTP 403).

### Allowed Bots

The following bots bypass anti-scraping checks (SEO crawlers):

`googlebot`, `bingbot`, `slurp`, `duckduckbot`, `baiduspider`, `yandexbot`, `facebot`, `twitterbot`, `linkedinbot`, `whatsapp`, `telegrambot`, `applebot`, `discordbot`

---

## Rate Limiting

### Public API

- **Limit**: 60 requests per minute per IP
- **Window**: 60 seconds (sliding)
- **Penalty**: IP blocked for 5 minutes after exceeding the limit
- **Response**: HTTP 429 `Too many requests. Please try again later.`
- **Cleanup**: Stale IP entries purged every 10 minutes

### Admin Login

- **Limit**: 5 attempts per 15 minutes per IP
- **Response**: HTTP 429 `Too many login attempts. Please try again in 15 minutes.`
- Applied via `adminLoginRateLimit` middleware on admin auth routes.

---

## Image Security

### Upload Limits

- **Request body limit**: 20 MB (`UPLOAD_REQUEST_BODY_LIMIT` in `server/src/lib/requestLimits.ts`)
- **Admin file upload**: 10 MB per file (multer config in `server/src/routes/admin.ts`)
- **Base64 prohibition**: No base64 data URLs stored in DB; enforced by `validateNoBase64Images()` in `server/src/lib/projectPersistence.ts`

### Storage Paths

- Avatars: `/uploads/avatars/{id}-{uuid}.{ext}`
- Project images: `/uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}`
- Only relative URL paths are stored in the database.

---

## Authentication

### JWT Configuration

- **Library**: `jsonwebtoken`
- **Secret**: `JWT_SECRET` environment variable (falls back to dev-only default in development)
- **Rotation**: Optional; controlled by `JWT_ROTATION_ENABLED` and `JWT_ROTATION_INTERVAL` env vars
- **Validation**: `validateJWTConfig()` runs at server startup to verify the JWT secret meets minimum requirements

### OAuth Providers

- **Google**: `passport-google-oauth20` strategy; client ID/secret via `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars
- **Facebook**: Passport Facebook strategy; app ID/secret via `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` env vars
- Callback URLs are auto-derived from `FRONTEND_URL` in production, or from `BACKEND_URL` / localhost in development

### Session Management

- Express sessions used only for the OAuth flow (not for general API auth)
- Session secret: reuses `jwt.secret`
- Session `maxAge`: 10 minutes (only needs to survive the OAuth redirect round-trip)
- `resave: false`, `saveUninitialized: false`

---

## Admin Access

- Admin panel served at `https://admin.tarmeer.com`
- Admin login is rate-limited (5 attempts / 15 min per IP)
- Admin JWT tokens are verified via `server/src/middleware/adminAuth.ts`
- Admin tokens must include `adminId` or `type: 'admin'` in the JWT payload
