# SEO/GEO Phase 1 — Full Optimization Design

**Date**: 2026-05-28
**Scope**: Schema completion + Programmatic SEO + Guide pages + IndexNow
**Estimated effort**: 3-4 days

---

## Background

Based on GEO research report (2026-05-19) and codebase audit:
- CompanyDetailPage has 4 schema errors
- No city×service landing pages exist
- No guide content pages targeting high-value queries
- No IndexNow integration (slow crawl latency)

---

## Part 1 — Schema Completion (CompanyDetailPage)

### Problems
| Field | Current | Fixed |
|-------|---------|-------|
| `@id` | missing | `https://www.tarmeer.com/@{slug}` |
| canonical/og:url | `company.id` (number) | `/@{slug}` |
| `areaServed` | hardcoded all 7 emirates | company's actual city only |
| `hasOfferCatalog` | missing | company `services` array |
| `sameAs` | missing | company website if available |

### Also fix: SupplierDetailPage
Same pattern — check if `areaServed` and `hasOfferCatalog` are correct.

---

## Part 2 — Programmatic SEO Landing Pages

### URL Pattern
```
/interior-design/:city         → e.g. /interior-design/dubai
/renovation/:city              → e.g. /renovation/abu-dhabi
/:service/:city                → general pattern
```

### Cities (from DB)
Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah

### Services (top 8 by company count)
Interior Design, Renovation, Kitchen Renovation, Bathroom Renovation,
Villa Renovation, Apartment Design, Office Design, Fit-Out

### Pages generated = 8 services × 6 cities = 48 landing pages

### Each page contains
- `<Helmet>`: dynamic title, description, canonical, og:*, JSON-LD
- H1: "{Service} Companies in {City}, UAE"
- Intro paragraph (150 words, keyword-rich, static per service type)
- Company grid: filtered list from existing `/api/companies` with city+service params
- FAQ block (5 Q&As per service type, static)
- Internal links to related pages

### JSON-LD: ItemList + BreadcrumbList
```json
{
  "@type": "ItemList",
  "name": "Interior Design Companies in Dubai",
  "description": "...",
  "numberOfItems": 24,
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "https://www.tarmeer.com/@company-slug" }
  ]
}
```

### Route
`/interior-design/dubai` etc — new React pages, server renders (prerender handles crawlers)

### Backend
New endpoint: `GET /api/companies/by-service-city?service=interior-design&city=dubai`
- Returns companies matching service category + city
- Ordered by weight_score DESC
- Max 30 results

---

## Part 3 — Guide Content Pages

### 5 pages to create

| URL | Target Query | Word count |
|-----|-------------|------------|
| `/guide/renovation-cost-dubai` | "renovation cost dubai 2026" | 900w |
| `/guide/best-interior-designers-dubai` | "best interior designers dubai" | 800w |
| `/guide/apartment-renovation-uae` | "apartment renovation uae checklist" | 850w |
| `/guide/villa-renovation-dubai` | "villa renovation dubai" | 850w |
| `/guide/how-to-choose-interior-designer-uae` | "how to choose interior designer uae" | 750w |

### Each guide page structure
1. H1 + intro
2. 3-5 H2 sections with substantive content
3. Data table or checklist (AI loves structured data)
4. FAQ block (5-8 Q&As) with FAQPage JSON-LD
5. CTA → link to relevant landing page or company list
6. Full Helmet (title, description, canonical, og:*, Article JSON-LD)

### Article JSON-LD
```json
{
  "@type": "Article",
  "@id": "https://www.tarmeer.com/guide/renovation-cost-dubai",
  "headline": "Renovation Cost in Dubai 2026: Complete Guide",
  "author": { "@type": "Organization", "name": "Tarmeer" },
  "publisher": { "@type": "Organization", "name": "Tarmeer", "url": "https://www.tarmeer.com" },
  "datePublished": "2026-05-28",
  "dateModified": "2026-05-28"
}
```

---

## Part 4 — IndexNow Integration

### What
When a new company is published or a new project is approved, immediately ping
Google + Bing via IndexNow API so they crawl within hours instead of weeks.

### Implementation
- IndexNow key file: `public/{key}.txt`
- Backend utility: `server/src/lib/indexNow.ts`
- Call sites: company approval, project approval

### API call
```
POST https://api.indexnow.org/indexnow
{
  "host": "www.tarmeer.com",
  "key": "{INDEXNOW_KEY}",
  "urlList": ["https://www.tarmeer.com/@company-slug"]
}
```

### Env var
`INDEXNOW_KEY` in `.env`

---

## Files to create/modify

### New files
- `src/pages/ServiceCityPage.tsx` — programmatic landing page component
- `src/pages/guides/RenovationCostDubaiPage.tsx`
- `src/pages/guides/BestInteriorDesignersDubaiPage.tsx`
- `src/pages/guides/ApartmentRenovationUaePage.tsx`
- `src/pages/guides/VillaRenovationDubaiPage.tsx`
- `src/pages/guides/HowToChooseInteriorDesignerPage.tsx`
- `server/src/lib/indexNow.ts`

### Modified files
- `src/pages/CompanyDetailPage.tsx` — schema fixes
- `src/App.tsx` — new routes
- `server/src/controllers/companyController.ts` — new by-service-city endpoint
- `server/src/routes/api.ts` or equivalent — register new route
- `server/src/controllers/companyAdminController.ts` — call indexNow on approval
- `scripts/harness/lint-seo.mjs` — add new pages to PUBLIC_PAGES

---

## Success criteria
- Google Rich Results Test passes for CompanyDetailPage
- 48 landing pages indexed within 2 weeks
- 5 guide pages with FAQPage schema passing validator
- IndexNow fires on every company/project approval
