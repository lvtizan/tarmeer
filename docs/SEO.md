# SEO Rules

Mechanically enforced by `scripts/harness/lint-seo.mjs`. Every public-facing page MUST comply.

Last updated: 2026-04-10

---

## SEO Signal Reference (per-page output)

Every public detail page should emit ALL of these signals:

| Signal | Content | Example |
|--------|---------|---------|
| **title** | `{Project} - {Tag1 Tag2 Tag3} Design in {Location} by {Company} \| Tarmeer` | `Villa Project - Modern Living Room Design in Dubai by Company \| Tarmeer` |
| **description** | Natural sentence: project name, year, style + room type, company, location, budget (if any), tags list, photo count | 50–320 chars |
| **keywords** | Project tags + style + geography (UAE/Dubai/Abu Dhabi) + company name + generic design terms, all deduped lowercase | `modern, living room, villa, dubai, ...` |
| **og:article:tag** | One `<meta property="article:tag">` per project tag (Living Room / Modern / Villa...) — helps Google build topic clusters | Multiple meta tags |
| **og:image** | Follows the currently-viewed photo, with `og:image:width=1200` `og:image:height=630` hints | Full HTTPS URL |
| **robots** | `index, follow, max-image-preview:large` — allows Google Images to show full-size thumbnails | — |
| **JSON-LD ImageGallery** | Up to 20 `ImageObject` entries + company logo/URL + `Place` address + year + keywords | See schema section below |
| **JSON-LD BreadcrumbList** | `Home > Portfolio > Company > Project` — shows as breadcrumb in search results | See schema section below |
| **canonical** | Strips `?from=portfolio&img=N` — all photo variants fold into one clean URL | `https://www.tarmeer.com/companies/slug/project-slug` |

---

## Which pages are "public-facing"?

Any page reachable by anonymous users (no auth). Currently:

| Page | File |
|------|------|
| Home | `src/pages/HomePage.tsx` |
| Companies List | `src/pages/CompaniesPage.tsx` |
| Company Detail | `src/pages/CompanyDetailPage.tsx` |
| Project Detail | `src/pages/ProjectDetailPage.tsx` |
| Portfolio | `src/pages/PortfolioPage.tsx` |
| Showrooms / Materials | `src/pages/ShowroomsPage.tsx` |
| Contact | `src/pages/ContactPage.tsx` |
| Brand Detail | `src/pages/BrandPage.tsx` |
| Material Category | `src/pages/MaterialCategoryPage.tsx` |

Admin, auth, dashboard, and designer pages are NOT checked.

---

## Required Tags (minimum — linter will fail without these)

Every public page MUST have a `<Helmet>` block containing:

1. **`<title>`** — must include `Tarmeer` and be meaningful (not just "Tarmeer")
2. **`<meta name="description">`** — 50–320 characters
3. **`<meta property="og:title">`** — Open Graph title
4. **`<meta property="og:description">`** — Open Graph description
5. **`<meta property="og:image">`** — social share image
6. **`<link rel="canonical">`** — must use `https://www.tarmeer.com`

---

## Recommended Tags (not enforced but strongly encouraged)

- `<meta property="og:type">` — `website` for list pages, `article` for detail pages
- `<meta property="og:url">` — same as canonical
- `<meta property="og:site_name" content="Tarmeer">`
- `<meta property="og:locale" content="en_US">`
- `<meta name="twitter:card" content="summary_large_image">`
- `<meta name="twitter:title">`, `<meta name="twitter:description">`, `<meta name="twitter:image">`
- `<meta name="keywords">` — comma-separated, deduped, lowercase
- `<meta name="robots" content="index, follow, max-image-preview:large">`
- `<meta property="article:tag">` — one per project tag (for topic clusters)

---

## JSON-LD Structured Data (required for detail pages)

Detail pages (Company, Project, Brand) MUST include at least one `<script type="application/ld+json">` block. Recommended schemas:

| Page Type | Primary Schema | Optional |
|-----------|---------------|----------|
| Company Detail | `LocalBusiness` | — |
| Project Detail (default) | `CreativeWork` | — |
| Project Detail (portfolio mode) | `ImageGallery` | `BreadcrumbList` |
| Brand Detail | `Brand` or `Product` | — |
| Portfolio list | `CollectionPage` + `ItemList` | — |

### ImageGallery checklist (project photos)

```json
{
  "@type": "ImageGallery",
  "name": "...",
  "description": "...",
  "url": "canonical URL",
  "author": { "@type": "Organization", "name": "...", "url": "...", "logo": "..." },
  "locationCreated": { "@type": "Place", "name": "...", "address": { ... } },
  "genre": "style",
  "keywords": "tag1, tag2, ...",
  "dateCreated": "year",
  "numberOfItems": N,
  "image": [{ "@type": "ImageObject", "contentUrl": "...", "name": "...", "caption": "..." }]
}
```

### BreadcrumbList (all detail pages)

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.tarmeer.com/" },
    { "@type": "ListItem", "position": 2, "name": "Portfolio", "item": "https://www.tarmeer.com/portfolio" },
    { "@type": "ListItem", "position": 3, "name": "Company", "item": "..." },
    { "@type": "ListItem", "position": 4, "name": "Project", "item": "..." }
  ]
}
```

---

## Title Pattern

**Detail pages:**
```
{Project Name} - {Tag1 Tag2 Tag3} Design in {Location} by {Company} | Tarmeer
```
Example: `Villa Project - Modern Living Room Design in Dubai by Archlon Group | Tarmeer`

**List pages:**
```
{Page Title} - Tarmeer UAE
```
Example: `Interior Design Portfolio & Inspiration - Tarmeer UAE`

---

## Image SEO

- `og:image` should resolve to an HTTPS URL (not relative path)
- Include `og:image:width` and `og:image:height` when known
- Gallery images use `<img alt="...">` with descriptive text (not empty alt)
- Prefer `loading="lazy"` for below-fold images, `loading="eager"` for hero

---

## Canonical URL Rules

1. Always use `https://www.tarmeer.com/...` (not http, not localhost)
2. Strip query params: `?from=portfolio&img=N` → canonical is just the clean path
3. Same content under different URLs MUST share the same canonical

---

## Adding a New Public Page

1. Add `<Helmet>` with all 6 required tags
2. Add at least one JSON-LD block if it's a detail page
3. Run `node scripts/harness/lint-seo.mjs` — it must pass
4. Register the page file in this document's "public-facing" table above
5. Register it in `lint-seo.mjs`'s `PUBLIC_PAGES` array
