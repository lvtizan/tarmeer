# GEO (Generative Engine Optimization) Design

**Date**: 2026-04-10
**Status**: Approved
**Goal**: Optimize tarmeer.com for AI search engines (Google AI Overviews, Perplexity, ChatGPT Search, ClaudeBot) while strengthening traditional SEO.

---

## Problem

Tarmeer is a pure CSR (Vite + React) app. AI crawlers (Perplexity, ChatGPT, Claude) mostly do NOT execute JavaScript — they see an empty HTML shell. This means:

- Zero content visibility in AI-generated answers
- No chance of being cited in AI search results
- Missing structured data on list pages limits knowledge graph inclusion

## Solution: 7 Workstreams

### 1. Prerender Service (Runtime Puppeteer)

**Why runtime over build-time**: New companies/projects appear without rebuilds. AI crawlers always get fresh data.

**Architecture**:
```
Request → nginx (User-Agent check)
  ├─ AI/search bot → proxy_pass localhost:3003 → Puppeteer renders → cached HTML
  └─ Regular user → normal SPA (index.html)
```

**Components**:
- `server/prerender/` — Node.js + Puppeteer HTTP service on port 3003
- pm2 process with `max_memory_restart: 512M`
- Disk cache at `/tarmeer/prerender-cache/` with 24h TTL
- Timeout: 15s per render, fallback to SPA on failure

**Bot User-Agents to detect**:
- Google: `Googlebot`, `Google-InspectionTool`, `Storebot-Google`
- Bing: `Bingbot`, `msnbot`
- AI engines: `PerplexityBot`, `ChatGPT-User`, `ClaudeBot`, `Applebot`, `GPTBot`, `anthropic-ai`, `cohere-ai`
- Social: `Twitterbot`, `facebookexternalhit`, `LinkedInBot`, `WhatsApp`
- SEO tools: `Screaming Frog`, `Semrush`, `AhrefsBot`

**nginx config snippet** (for reference, NOT auto-applied — manual deploy):
```nginx
set $prerender 0;
if ($http_user_agent ~* "Googlebot|Bingbot|PerplexityBot|ChatGPT-User|ClaudeBot|GPTBot|Applebot|anthropic-ai|cohere-ai|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Screaming Frog|Semrush|AhrefsBot") {
    set $prerender 1;
}
if ($prerender = 1) {
    rewrite (.*) /prerenderproxy$1 break;
    proxy_pass http://127.0.0.1:3003;
}
```

### 2. Python Auto-Maintenance Script

**Location**: `server/prerender/ops/geo_watchdog.py`

**Features**:
- **Health check**: Every 5 min, hit prerender service with test URL, verify HTTP 200 + valid HTML
- **Process restart**: If health check fails 3x consecutively, restart pm2 process
- **Cache cleanup**: Daily at 3 AM, delete cache files older than 24h
- **Chromium auto-update**: Weekly check for new Puppeteer/Chromium version, auto-update + restart
- **Crawler UA sync**: Monthly fetch latest bot UA list from public sources, update nginx config reference file
- **Email alerts**: Send to `lvyiming@kp99.cn` on: service down, restart triggered, Chromium updated, disk > 80%

**Deployment**: cron + systemd timer on ECS server.

**Email**: Use SMTP (configurable — Aliyun DirectMail or any SMTP relay).

### 3. Global Structured Data Enhancement

**New schemas to add**:

| Page | Schema | Purpose |
|------|--------|---------|
| HomePage | `WebSite` + `SearchAction` | AI engines understand site search capability |
| HomePage | `Organization` | Company info, logo, contact — feeds knowledge panels |
| Service pages (×3) | `Service` | Service type, area served, provider |
| CompaniesPage | `ItemList` | List of companies with positions and URLs |
| ShowroomsPage | `ItemList` | List of showrooms |
| ContactPage | `ContactPage` + `Organization` | Contact info structured for AI extraction |

**Existing schemas** (keep as-is):
- CompanyDetailPage → `LocalBusiness`
- ProjectDetailPage → `ImageGallery` + `BreadcrumbList`
- PortfolioPage → `CollectionPage` + `ItemList`
- BrandPage → `Brand`

### 4. FAQ Page

**Route**: `/faq`
**File**: `src/pages/FaqPage.tsx`

**Features**:
- English/Arabic dual language with toggle button (top-right, styled like existing UI)
- 3 categories, 5-8 questions each:
  - **Finding Design Companies** — How to choose, what to look for, cost range in UAE
  - **Design Inspiration** — Styles, trends, villa/apartment differences
  - **Renovation Services** — Process, timeline, permits, costs
- `FAQPage` JSON-LD with all Q&As
- Full Helmet meta tags + canonical
- Footer link added

**Language toggle**: Simple state toggle, no i18n library. Content stored as JS objects with `en`/`ar` keys. RTL support for Arabic via `dir="rtl"`.

### 5. Dynamic Sitemap

**Current state**: Static `/public/sitemap.xml` with 8 URLs.

**Enhancement**: Backend API endpoint `/api/sitemap.xml` (already referenced in robots.txt) to generate complete sitemap including:
- All static pages (home, companies, portfolio, showrooms, contact, faq, services, materials)
- All company detail pages (`/companies/:id`)
- All project detail pages (`/companies/:slug/:projectSlug`)
- All brand pages (`/materials/brands/:slug`)
- `lastmod` from database updated_at timestamps
- `changefreq` and `priority` per page type

**Static sitemap** (`/public/sitemap.xml`): Convert to sitemap index pointing to `/api/sitemap.xml`.

### 6. robots.txt Update

**Changes**:
- Add explicit `Allow` for AI crawlers: `PerplexityBot`, `ChatGPT-User`, `ClaudeBot`, `GPTBot`, `Applebot`
- Keep existing `Disallow: /api/` (except `/api/sitemap.xml`)
- Add `Allow: /api/sitemap.xml`

### 7. Content Optimization

**Citable content patterns** (AI engines prefer quoting specific facts):
- Add concrete statistics where available (e.g., "serving 50+ design companies across UAE")
- Ensure all img tags have descriptive alt text (audit + fix)
- Service pages: add specific deliverables, timelines, price ranges

---

## Files to Create/Modify

### New Files
- `server/prerender/index.js` — Prerender HTTP service
- `server/prerender/package.json` — Dependencies (puppeteer, express)
- `server/prerender/ecosystem.config.js` — pm2 config
- `server/prerender/ops/geo_watchdog.py` — Auto-maintenance script
- `server/prerender/ops/requirements.txt` — Python deps
- `server/prerender/ops/config.ini` — SMTP + path config
- `src/pages/FaqPage.tsx` — FAQ page

### Modified Files
- `src/App.tsx` — Add `/faq` route
- `src/components/Footer.tsx` — Add FAQ link
- `src/pages/HomePage.tsx` — Add WebSite + Organization JSON-LD
- `src/pages/CompaniesPage.tsx` — Add ItemList JSON-LD
- `src/pages/ShowroomsPage.tsx` — Add ItemList JSON-LD
- `src/pages/ContactPage.tsx` — Add ContactPage JSON-LD
- Service pages (×3) — Add Service JSON-LD
- `server/src/routes/` — Add/enhance sitemap endpoint
- `public/robots.txt` — AI crawler rules
- `public/sitemap.xml` — Convert to sitemap index
- `scripts/harness/lint-seo.mjs` — Register FaqPage
- `docs/SEO.md` — Document GEO additions

---

## Non-Goals

- SSR migration (too large, prerender achieves same crawlability)
- i18n framework (overkill for one bilingual page)
- Paid prerender SaaS (self-hosted is free + real-time)

## Risks

- **Puppeteer memory**: Mitigated by pm2 `max_memory_restart` + watchdog
- **nginx config**: Manual deploy only — never auto-modified per project rules
- **Cache staleness**: 24h TTL balances freshness vs performance
