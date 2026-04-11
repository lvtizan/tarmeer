# GEO Optimization Test Cases

## TC-G.1: FAQ page loads
- GET /faq → 200, shows "Frequently Asked Questions"
- Has 3 category sections
- Language toggle (EN/AR) works
- Accordion expand/collapse works

## TC-G.2: FAQ page SEO
- /faq has `<title>` containing "FAQ" and "Tarmeer"
- Has `<meta name="description">`
- Has `<meta property="og:title">`
- Has `<link rel="canonical">` = https://www.tarmeer.com/faq
- Has `<script type="application/ld+json">` with FAQPage schema

## TC-G.3: Homepage JSON-LD
- / has 2 JSON-LD blocks: WebSite + Organization
- WebSite has SearchAction
- Organization has contactPoint, address, sameAs

## TC-G.4: CompaniesPage JSON-LD
- /companies has JSON-LD with ItemList schema
- Contains company items with LocalBusiness type

## TC-G.5: ContactPage JSON-LD
- /contact has JSON-LD with ContactPage schema

## TC-G.6: ShowroomsPage JSON-LD
- /materials has JSON-LD with ItemList schema

## TC-G.7: Service pages Helmet + JSON-LD
- /services/new-home-design has `<title>` with "Tarmeer", Service JSON-LD
- /services/soft-decoration has `<title>` with "Tarmeer", Service JSON-LD
- /services/house-exterior has `<title>` with "Tarmeer", Service JSON-LD

## TC-G.8: robots.txt AI crawlers
- GET /robots.txt → contains GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, Applebot
- Contains `Allow: /api/sitemap.xml`

## TC-G.9: Sitemap index
- GET /sitemap.xml → sitemapindex pointing to /api/sitemap.xml

## TC-G.10: Dynamic sitemap
- GET /api/sitemap.xml → contains /faq, /portfolio, /services/*, company URLs

## TC-G.11: SEO linter passes
- `node scripts/harness/lint-seo.mjs` → all checks passed (10 pages)

## TC-G.12: Footer has FAQ link
- Footer nav includes "FAQ" link pointing to /faq

## TC-G.13: /join page loads
- GET /join → 200, hero without form, form at bottom
- CTA button scrolls to bottom form
- Form submits to /api/inquiries

## TC-G.14: /for-companies page loads
- GET /for-companies → 200, hero with form
- Form submits to /api/inquiries

## TC-G.15: Homepage "Join as Company" links to /join
- Homepage bottom section has "Join as Company" → href="/join"

## TC-G.16: No "free" text on public pages
- No visible "free" (meaning complimentary/no-cost) on any public page
- "free zone" (legal term) and "clutter-free" (design term) are acceptable

## TC-G.17: Prerender service files exist
- server/prerender/index.js exists
- server/prerender/ecosystem.config.js exists
- server/prerender/package.json exists
- server/prerender/ops/geo_watchdog.py exists
- server/prerender/ops/config.ini exists

## TC-G.18: TypeScript compiles
- `npx tsc --noEmit` → no errors
