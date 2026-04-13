# GEO + SEO Engine — Design Doc

**Date**: 2026-04-13
**Goal**: Maximize search engine discovery by auto-optimizing all public pages — zero company effort required.

---

## Changes

### 1. Sitemap: add project pages (CRITICAL)
- Add all published projects with slugs to sitemap
- Use project.updated_at for lastmod

### 2. BreadcrumbList JSON-LD
- CompanyDetailPage: Home > Companies > {Company}
- ProjectDetailPage (default mode): Home > Companies > {Company} > {Project}

### 3. CompanyDetailPage enhanced JSON-LD
- FAQPage schema with 3-5 auto-generated Q&As based on company data
- Expand areaServed to UAE cities array
- Add hasOfferCatalog with service types

### 4. Auto-generated FAQ content
Template-based from company name, city, services, project count.

### 5. ProjectDetailPage (default mode) enhancement
- Add BreadcrumbList JSON-LD (missing)
- Align meta description quality with portfolio mode

### 6. robots.txt: AI crawler rules
- Allow GPTBot, PerplexityBot, ClaudeBot on /companies/ and /portfolio
