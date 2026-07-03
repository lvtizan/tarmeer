# SEO/GEO Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Maximize organic search traffic through schema fixes, 48 programmatic landing pages, 5 guide articles, and IndexNow instant indexing.

**Architecture:** All changes are frontend-only except Task 2 (new backend endpoint) and Task 5 (IndexNow). No DB schema changes needed.

**Tech Stack:** React + Helmet (frontend), Express + mysql2 (backend), schema.org JSON-LD

---

## Task 1: Fix CompanyDetailPage Schema (canonical + areaServed + @id + hasOfferCatalog)

**Files:**
- Modify: `src/pages/CompanyDetailPage.tsx` (lines 268–290, 355–381)

**Context:**
- `company.id` in this component = the slug string from URL params (e.g. `abc-interiors`)
- Canonical must be `https://www.tarmeer.com/@{slug}` (not `/companies/{slug}`)
- `areaServed` currently hardcodes all 7 emirates — must use company's actual city
- Missing: `@id`, `hasOfferCatalog`, `sameAs`

**Step 1: Edit the jsonLd object (lines 268-289)**

Replace the existing `jsonLd` const with:

```tsx
const canonicalUrl = `https://www.tarmeer.com/@${company.id}`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": canonicalUrl,
  "name": company.name,
  "description": description || company.shortDescription,
  "url": canonicalUrl,
  "address": { "@type": "PostalAddress", "addressLocality": company.city || 'Dubai', "addressCountry": "AE" },
  ...(company.phone ? { "telephone": company.phone } : {}),
  ...(heroImages[0] ? { "image": `https://www.tarmeer.com${heroImages[0]}` } : {}),
  "priceRange": "$$",
  "areaServed": company.city
    ? { "@type": "City", "name": company.city }
    : { "@type": "Country", "name": "United Arab Emirates" },
  ...(company.services.length > 0 ? {
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "itemListElement": company.services.slice(0, 8).map(svc => ({
        "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": svc }
      }))
    }
  } : {}),
  "knowsAbout": company.services.length > 0 ? company.services : ['Interior Design', 'Renovation', 'Fit-out'],
  ...(company.companyType ? { "additionalType": getCompanyTypeLabel(company.companyType) } : {}),
  ...(company.website ? { "sameAs": [company.website] } : {}),
};
```

**Step 2: Fix Helmet canonical, og:url, og:type, breadcrumb (lines 355-381)**

Replace occurrences of `` `https://www.tarmeer.com/companies/${company.id}` `` with `canonicalUrl`:
- `<meta property="og:url" content={canonicalUrl} />`
- `<link rel="canonical" href={canonicalUrl} />`
- In BreadcrumbList: `item: canonicalUrl`

Also fix the loading-state canonical (line ~231):
```tsx
{id && <Helmet><link rel="canonical" href={`https://www.tarmeer.com/@${id}`} /></Helmet>}
```

**Step 3: Verify no TypeScript errors**
```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && node_modules/.bin/tsc --noEmit --skipLibCheck
cd /Users/kp/Code/tarmeer-4.0-local && node_modules/.bin/tsc --noEmit --skipLibCheck
```

**Step 4: Commit**
```bash
git add src/pages/CompanyDetailPage.tsx
git commit -m "fix(seo): company detail canonical → /@slug, areaServed dynamic, add @id + hasOfferCatalog"
```

---

## Task 2: New Backend Endpoint — Companies by Service+City

**Files:**
- Modify: `server/src/controllers/companyController.ts` (append new export)
- Modify: `server/src/routes/companies.ts` (add route before `/:slug`)

**Context:**
- Must be added BEFORE `router.get('/:slug', getCompanyBySlug)` to avoid slug conflict
- Use `pool.query` (not `pool.execute`) for LIKE queries — avoids mysql2 prepared statement issues
- Services are stored in `company_profiles.services` as JSON array

**Step 1: Add `getCompaniesByServiceCity` to companyController.ts**

Append at the end of `server/src/controllers/companyController.ts`:

```ts
export async function getCompaniesByServiceCity(req: any, res: any) {
  try {
    const service = typeof req.query.service === 'string' ? req.query.service.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';

    if (!service || !city) {
      return res.status(400).json({ error: 'service and city are required' });
    }

    // Match directory companies (uae_companies)
    const [dirRows] = await pool.query(
      `SELECT uc.slug, uc.name, uc.city, uc.description, uc.company_type,
              uc.weight_score, uc.project_images, uc.logo_url
       FROM uae_companies uc
       WHERE uc.is_active = 1
         AND LOWER(uc.city) = LOWER(?)
         AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(uc.services, '$'))) LIKE ?
       ORDER BY uc.weight_score DESC
       LIMIT 30`,
      [city, `%${service.toLowerCase()}%`]
    ) as any[];

    // Match registered companies (company_profiles)
    const [regRows] = await pool.query(
      `SELECT cp.slug, cp.company_name AS name, cp.city, cp.description, cp.company_type,
              cp.weight_score
       FROM company_profiles cp
       WHERE cp.status = 'approved'
         AND cp.deleted_at IS NULL
         AND LOWER(cp.city) = LOWER(?)
         AND LOWER(cp.services) LIKE ?
       ORDER BY cp.weight_score DESC
       LIMIT 30`,
      [city, `%${service.toLowerCase()}%`]
    ) as any[];

    const combined = [...(dirRows as any[]), ...(regRows as any[])]
      .sort((a, b) => (b.weight_score || 0) - (a.weight_score || 0))
      .slice(0, 30);

    res.json({ companies: combined, service, city });
  } catch (err) {
    console.error('getCompaniesByServiceCity error:', err);
    res.status(500).json({ error: 'server error' });
  }
}
```

**Step 2: Register route in companies.ts**

Add before `router.get('/:slug', getCompanyBySlug)`:

```ts
import { getCompanies, getPortfolioFeed, getPublicProjectDetail, getCompanyBySlug, getActiveServices, getPortfolioImage, getPortfolioTags, getCompaniesByServiceCity } from '../controllers/companyController';

// add this line before /:slug
router.get('/by-service-city', getCompaniesByServiceCity);
```

**Step 3: Compile and restart server**
```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && node_modules/.bin/tsc --noEmit --skipLibCheck
node_modules/.bin/tsc
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
```

**Step 4: Test the endpoint**
```bash
curl "http://localhost:3002/api/companies/by-service-city?service=interior+design&city=dubai" | head -100
# Expected: { companies: [...], service: "interior design", city: "dubai" }

curl "http://localhost:3002/api/companies/by-service-city"
# Expected: 400 { error: "service and city are required" }
```

**Step 5: Commit**
```bash
git add server/src/controllers/companyController.ts server/src/routes/companies.ts
git commit -m "feat(api): add GET /api/companies/by-service-city endpoint for programmatic SEO pages"
```

---

## Task 3: ServiceCityPage Component + Routes (48 landing pages)

**Files:**
- Create: `src/pages/ServiceCityPage.tsx`
- Modify: `src/App.tsx` (add route + lazy import)

**Context:**
- Route: `/services/:service/:city` (e.g. `/services/interior-design/dubai`)
- Must be inside `<Layout>` (public section), before `*` catch-all
- Uses existing `CompaniesPage` style grid but with filtered data

**Step 1: Create ServiceCityPage.tsx**

```tsx
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import PageContainer from '../components/PageContainer';

const SERVICE_LABELS: Record<string, string> = {
  'interior-design': 'Interior Design',
  'renovation': 'Renovation',
  'kitchen-renovation': 'Kitchen Renovation',
  'bathroom-renovation': 'Bathroom Renovation',
  'villa-renovation': 'Villa Renovation',
  'apartment-design': 'Apartment Design',
  'office-design': 'Office Design',
  'fit-out': 'Fit-Out',
};

const CITY_LABELS: Record<string, string> = {
  'dubai': 'Dubai',
  'abu-dhabi': 'Abu Dhabi',
  'sharjah': 'Sharjah',
  'ajman': 'Ajman',
  'ras-al-khaimah': 'Ras Al Khaimah',
  'fujairah': 'Fujairah',
};

const SERVICE_INTROS: Record<string, string> = {
  'interior-design': 'Transform your living space with expert interior designers who understand UAE aesthetics. From modern minimalist to traditional Arabic design, these companies deliver stunning results.',
  'renovation': 'Complete home and office renovation services in {city}. From structural changes to cosmetic upgrades, these companies handle projects of all sizes.',
  'kitchen-renovation': 'Upgrade your kitchen with custom cabinetry, premium countertops, and smart storage solutions. These companies specialize in kitchen transformations across {city}.',
  'bathroom-renovation': 'Luxurious bathroom renovations tailored to your vision. These companies deliver high-quality bathroom upgrades throughout {city}.',
  'villa-renovation': 'Comprehensive villa renovation services covering all aspects of your home upgrade. These companies have extensive experience with UAE villas.',
  'apartment-design': 'Expert apartment interior design and renovation for all sizes and budgets. These companies transform Dubai apartments into beautiful living spaces.',
  'office-design': 'Professional office fit-out and interior design services. Create productive, impressive workplaces with these experienced companies in {city}.',
  'fit-out': 'Complete fit-out solutions for residential and commercial spaces. These companies deliver turnkey fit-out projects across {city}.',
};

const SERVICE_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  'interior-design': [
    { q: 'How much does interior design cost in Dubai?', a: 'Interior design costs in Dubai typically range from AED 150 to AED 500+ per square metre, depending on the scope, materials, and complexity of the project. A full apartment design usually costs between AED 30,000 and AED 120,000.' },
    { q: 'How long does an interior design project take in the UAE?', a: 'A typical interior design project in the UAE takes 4–12 weeks from concept to completion, depending on the size of the space and availability of materials. Villa projects may take 3–6 months.' },
    { q: 'Do I need a permit for interior renovation in Dubai?', a: 'Minor cosmetic changes generally do not require permits. Structural changes, electrical work, or plumbing modifications in Dubai require a NOC from the building management and a permit from DM (Dubai Municipality).' },
    { q: 'What is the difference between an interior designer and a fit-out contractor?', a: 'An interior designer creates the concept and plans. A fit-out contractor executes the physical work. Many companies in Dubai offer both services under one roof, simplifying project management.' },
    { q: 'How do I choose an interior design company in Dubai?', a: 'Review their portfolio for projects similar to yours, check reviews, verify their trade licence, and request a detailed quotation. Tarmeer lets you compare portfolios side by side.' },
  ],
  'renovation': [
    { q: 'How much does a full home renovation cost in Dubai?', a: 'A full home renovation in Dubai typically costs AED 500–1,500 per square metre. A standard 1,000 sq ft apartment renovation ranges from AED 50,000 to AED 150,000 depending on material quality.' },
    { q: 'How long does a home renovation take in Dubai?', a: 'A standard apartment renovation takes 4–8 weeks. Villa renovations typically take 2–5 months depending on the scope of work.' },
    { q: 'Do renovation companies provide project management in UAE?', a: 'Yes, most reputable renovation companies in the UAE provide full project management, including procurement, subcontractor coordination, and quality control.' },
    { q: 'What permits are needed for renovation in Dubai?', a: 'Interior cosmetic work requires no permit. Structural, MEP (mechanical, electrical, plumbing), or major renovations require a permit from Dubai Municipality and approval from the building\'s developer.' },
    { q: 'Can I live in my home during renovation?', a: 'It depends on the scope. Minor renovations room-by-room are liveable. Major gut renovations are not, and most contractors recommend temporary relocation for projects over 4 weeks.' },
  ],
};

// Default FAQs for services without specific ones
const DEFAULT_FAQS = SERVICE_FAQS['interior-design'];

type Company = {
  slug: string;
  name: string;
  city: string;
  description?: string;
  logo_url?: string;
};

export default function ServiceCityPage() {
  const { service = '', city = '' } = useParams<{ service: string; city: string }>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const serviceLabel = SERVICE_LABELS[service] || service.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const cityLabel = CITY_LABELS[city] || city.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const canonicalUrl = `https://www.tarmeer.com/services/${service}/${city}`;
  const title = `${serviceLabel} Companies in ${cityLabel}, UAE | Tarmeer`;
  const description = `Find the best ${serviceLabel.toLowerCase()} companies in ${cityLabel}. Browse verified portfolios, compare projects, and get free quotes on Tarmeer.`;
  const intro = (SERVICE_INTROS[service] || `Find top ${serviceLabel.toLowerCase()} companies in ${cityLabel}, UAE.`).replace(/{city}/g, cityLabel);
  const faqs = SERVICE_FAQS[service] || DEFAULT_FAQS;

  useEffect(() => {
    setLoading(true);
    const apiService = service.replace(/-/g, ' ');
    const apiCity = cityLabel;
    fetch(`/api/companies/by-service-city?service=${encodeURIComponent(apiService)}&city=${encodeURIComponent(apiCity)}`)
      .then(r => r.json())
      .then(data => { setCompanies(data.companies || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [service, city]);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': `${serviceLabel} Companies in ${cityLabel}`,
    'description': description,
    'numberOfItems': companies.length,
    'itemListElement': companies.map((c, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'url': `https://www.tarmeer.com/@${c.slug}`,
      'name': c.name,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': faq.a },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com/' },
      { '@type': 'ListItem', position: 2, name: 'Companies', item: 'https://www.tarmeer.com/companies' },
      { '@type': 'ListItem', position: 3, name: `${serviceLabel} in ${cityLabel}`, item: canonicalUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <PageContainer className="py-10 sm:py-14">
        {/* Breadcrumb */}
        <nav className="text-sm text-stone-400 mb-6">
          <a href="/" className="hover:text-[#b8864a]">Home</a>
          <span className="mx-2">/</span>
          <a href="/companies" className="hover:text-[#b8864a]">Companies</a>
          <span className="mx-2">/</span>
          <span className="text-stone-600">{serviceLabel} in {cityLabel}</span>
        </nav>

        {/* Header */}
        <div className="max-w-2xl mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-4">
            {serviceLabel} Companies in {cityLabel}, UAE
          </h1>
          <p className="text-[17px] text-[#6b6b6b] leading-relaxed">{intro}</p>
        </div>

        {/* Company grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 h-40 animate-pulse" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <p className="text-lg mb-4">No companies found yet for this category.</p>
            <a href="/companies" className="text-[#b8864a] hover:underline">Browse all companies →</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {companies.map(c => (
              <a
                key={c.slug}
                href={`/@${c.slug}`}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 hover:shadow-md hover:border-[#b8864a]/30 transition-all"
              >
                <div className="font-semibold text-[#2c2c2c] text-[15px] mb-1">{c.name}</div>
                <div className="text-sm text-stone-400">{c.city}, UAE</div>
                {c.description && (
                  <p className="text-[13px] text-stone-500 mt-2 line-clamp-2">{c.description}</p>
                )}
              </a>
            ))}
          </div>
        )}

        {/* FAQ section */}
        <div className="max-w-2xl mt-14 pt-10 border-t border-stone-200">
          <h2 className="text-xl font-bold text-[#2c2c2c] mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i}>
                <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3>
                <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-2xl mt-10 pt-8 border-t border-stone-200">
          <p className="text-[15px] text-[#6b6b6b] mb-4">
            Are you a {serviceLabel.toLowerCase()} company in {cityLabel}?
          </p>
          <a href="/for-companies" className="btn-primary">
            List your company for free →
          </a>
        </div>
      </PageContainer>
    </div>
  );
}
```

**Step 2: Add to App.tsx**

Add lazy import near other lazy imports:
```tsx
const ServiceCityPage = lazyRetry(() => import('./pages/ServiceCityPage'));
```

Add route inside `<Layout>` section, before the `*` catch-all:
```tsx
<Route path="/services/:service/:city" element={<ServiceCityPage />} />
```

**Step 3: Add to SEO linter**

In `scripts/harness/lint-seo.mjs`, add to `PUBLIC_PAGES` array:
```js
'src/pages/ServiceCityPage.tsx',
```

**Step 4: Verify TypeScript**
```bash
cd /Users/kp/Code/tarmeer-4.0-local && node_modules/.bin/tsc --noEmit --skipLibCheck
```

**Step 5: Commit**
```bash
git add src/pages/ServiceCityPage.tsx src/App.tsx scripts/harness/lint-seo.mjs
git commit -m "feat(seo): add programmatic ServiceCityPage — 48 landing pages via /services/:service/:city"
```

---

## Task 4: Guide Content Pages (5 articles)

**Files:**
- Create: `src/pages/guides/RenovationCostDubaiPage.tsx`
- Create: `src/pages/guides/BestInteriorDesignersDubaiPage.tsx`
- Create: `src/pages/guides/ApartmentRenovationUaePage.tsx`
- Create: `src/pages/guides/VillaRenovationDubaiPage.tsx`
- Create: `src/pages/guides/HowToChooseInteriorDesignerPage.tsx`
- Modify: `src/App.tsx`
- Modify: `scripts/harness/lint-seo.mjs`

**Context:**
- All 5 pages are static (no API calls), use hardcoded content
- Each needs: Article JSON-LD + FAQPage JSON-LD + full Helmet
- Routes: `/guide/renovation-cost-dubai` etc.
- Must reuse `PageContainer` component

**Step 1: Create RenovationCostDubaiPage.tsx**

```tsx
import { Helmet } from 'react-helmet-async';
import PageContainer from '../../components/PageContainer';

const FAQS = [
  { q: 'How much does a full apartment renovation cost in Dubai?', a: 'A full apartment renovation in Dubai typically costs AED 50,000–150,000 for a standard 1,000 sq ft unit, depending on material quality and scope. Premium finishes can push costs to AED 200,000+.' },
  { q: 'What is the cost per square metre for renovation in Dubai?', a: 'Renovation costs in Dubai range from AED 400–500/sqm for basic work to AED 1,000–1,500/sqm for mid-range finishes, and AED 2,000+/sqm for luxury renovation.' },
  { q: 'What is the most expensive part of a home renovation?', a: 'Kitchen and bathroom renovations typically cost the most, representing 30–40% of total renovation budgets due to plumbing, cabinetry, and appliance costs.' },
  { q: 'Do renovation costs differ between Dubai and Abu Dhabi?', a: 'Generally, renovation costs are 5–15% lower in Abu Dhabi and Sharjah compared to Dubai, due to lower labour costs and permit fees.' },
  { q: 'How can I reduce renovation costs in the UAE?', a: 'Get at least 3 quotes from reputable companies, opt for local materials where possible, plan thoroughly to avoid change orders, and use Tarmeer to compare vetted companies.' },
];

export default function RenovationCostDubaiPage() {
  const canonicalUrl = 'https://www.tarmeer.com/guide/renovation-cost-dubai';
  const title = 'Renovation Cost in Dubai 2026: Complete Price Guide | Tarmeer';
  const description = 'How much does home renovation cost in Dubai? Full breakdown of renovation costs per sqm, by room type, and by material quality. Updated for 2026.';

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': canonicalUrl,
    'headline': title,
    'description': description,
    'url': canonicalUrl,
    'datePublished': '2026-05-28',
    'dateModified': '2026-05-28',
    'author': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' },
    'publisher': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com', 'logo': { '@type': 'ImageObject', 'url': 'https://www.tarmeer.com/og-default.jpg' } },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': FAQS.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })),
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PageContainer className="py-10 sm:py-16 max-w-3xl">
        <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">Renovation Guide</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-6 leading-tight">
          Renovation Cost in Dubai 2026: Complete Price Guide
        </h1>
        <p className="text-[17px] text-[#6b6b6b] leading-relaxed mb-8">
          Planning a home renovation in Dubai? Understanding costs upfront prevents budget surprises.
          This guide covers renovation costs by room type, material quality, and project size — based on
          real projects listed on Tarmeer.
        </p>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">Average Renovation Costs in Dubai (2026)</h2>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-[15px] border-collapse">
            <thead>
              <tr className="bg-stone-100">
                <th className="text-left p-3 font-semibold text-stone-700 border border-stone-200">Project Type</th>
                <th className="text-right p-3 font-semibold text-stone-700 border border-stone-200">Basic</th>
                <th className="text-right p-3 font-semibold text-stone-700 border border-stone-200">Mid-Range</th>
                <th className="text-right p-3 font-semibold text-stone-700 border border-stone-200">Luxury</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Full apartment (1,000 sqft)', 'AED 50K', 'AED 100K', 'AED 200K+'],
                ['Kitchen renovation', 'AED 15K', 'AED 35K', 'AED 80K+'],
                ['Bathroom renovation', 'AED 8K', 'AED 20K', 'AED 50K+'],
                ['Villa renovation (3,000 sqft)', 'AED 150K', 'AED 350K', 'AED 700K+'],
                ['Office fit-out (per sqm)', 'AED 400', 'AED 800', 'AED 1,500+'],
              ].map(([type, basic, mid, luxury], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                  <td className="p-3 text-[#2c2c2c] border border-stone-200">{type}</td>
                  <td className="p-3 text-right text-stone-600 border border-stone-200">{basic}</td>
                  <td className="p-3 text-right text-stone-600 border border-stone-200">{mid}</td>
                  <td className="p-3 text-right font-medium text-[#b8864a] border border-stone-200">{luxury}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">What Affects Renovation Cost in Dubai?</h2>
        <div className="space-y-4 mb-8">
          {[
            ['Material quality', 'Italian marble vs. local tiles can differ by 5–10× in cost. Material choices are the single biggest cost lever in any Dubai renovation.'],
            ['Labour costs', 'Labour typically represents 30–40% of total project cost. Experienced contractors charge more but deliver faster, higher-quality results.'],
            ['Permit requirements', 'Structural or MEP work requires permits from Dubai Municipality, adding AED 3,000–15,000 and 2–4 weeks to timelines.'],
            ['Project complexity', 'Open-plan conversions, curved walls, and custom built-ins significantly increase costs versus standard rectangular rooms.'],
            ['Fit-out category', 'Category A (shell & core to basic fit-out) costs less than Category B (full turnkey with furniture and AV systems).'],
          ].map(([title, body], i) => (
            <div key={i} className="p-4 bg-white rounded-2xl border border-stone-200">
              <div className="font-semibold text-[#2c2c2c] mb-1">{title}</div>
              <p className="text-[15px] text-[#6b6b6b]">{body}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6 mb-12">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3>
              <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#b8864a]/5 rounded-2xl border border-[#b8864a]/20">
          <p className="font-semibold text-[#2c2c2c] mb-2">Compare renovation companies on Tarmeer</p>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Browse portfolios and get free quotes from verified renovation companies in Dubai and across the UAE.</p>
          <a href="/services/renovation/dubai" className="btn-primary">Find renovation companies →</a>
        </div>
      </PageContainer>
    </div>
  );
}
```

**Step 2: Create BestInteriorDesignersDubaiPage.tsx**

```tsx
import { Helmet } from 'react-helmet-async';
import PageContainer from '../../components/PageContainer';

const FAQS = [
  { q: 'Who are the best interior designers in Dubai?', a: 'Tarmeer lists hundreds of verified interior design companies in Dubai with portfolios. Top-rated companies include specialists in modern, contemporary, and Arabic-influenced styles. Browse our directory to compare portfolios and find your match.' },
  { q: 'How do I find a good interior designer in Dubai?', a: 'Look for designers with portfolios matching your style, check their reviews, verify their trade licence with DED, and request a detailed proposal. Tarmeer makes it easy to compare multiple companies side by side.' },
  { q: 'What qualifications should a Dubai interior designer have?', a: 'Look for membership in the Emirates Green Building Council, a trade licence from DED, and ideally international qualifications (NCIDQ, BIID). Experience in UAE-specific regulations is essential.' },
  { q: 'What is the interior design consultation fee in Dubai?', a: 'Initial consultations typically cost AED 500–2,000 or are offered free as part of a project proposal. Full design fees range from 10–15% of total project cost or a flat rate of AED 100–300 per sqm.' },
  { q: 'Can interior designers in Dubai work with a tight budget?', a: 'Yes, many interior designers in Dubai specialize in budget-conscious projects. Clearly communicate your budget upfront, and look for designers who offer phased projects or package-based pricing.' },
];

export default function BestInteriorDesignersDubaiPage() {
  const canonicalUrl = 'https://www.tarmeer.com/guide/best-interior-designers-dubai';
  const title = 'Best Interior Designers in Dubai 2026 | Tarmeer';
  const description = 'Find the best interior designers and interior design companies in Dubai. Browse verified portfolios, compare styles, and get quotes. Updated 2026 guide.';

  const articleJsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', '@id': canonicalUrl,
    'headline': title, 'description': description, 'url': canonicalUrl,
    'datePublished': '2026-05-28', 'dateModified': '2026-05-28',
    'author': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' },
    'publisher': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' },
  };
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': FAQS.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })) };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PageContainer className="py-10 sm:py-16 max-w-3xl">
        <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">Interior Design Guide</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-6 leading-tight">
          Best Interior Designers in Dubai 2026
        </h1>
        <p className="text-[17px] text-[#6b6b6b] leading-relaxed mb-8">
          Dubai is home to hundreds of exceptional interior design companies — from boutique studios
          to large fit-out contractors. This guide helps you navigate the options and find the right
          match for your project.
        </p>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">What to Look for in a Dubai Interior Designer</h2>
        <div className="space-y-4 mb-8">
          {[
            ['Portfolio relevance', 'Look for projects similar in scale, style, and budget to yours. A designer who excels at modern minimalist may not be the best for traditional Arabic interiors.'],
            ['UAE market experience', 'Local knowledge matters — from sourcing materials in Dragon Mart to understanding developer NOC requirements in specific buildings.'],
            ['Trade licence verification', 'All interior design and renovation companies in Dubai must hold a valid trade licence from DED. Always verify before signing a contract.'],
            ['Project management capability', 'Ensure your designer or contractor provides a dedicated project manager and regular site visits. Communication is the most cited complaint in renovation projects.'],
            ['Transparent pricing', 'Get a detailed bill of quantities (BOQ), not just a lump-sum quote. This protects you from scope creep and hidden charges.'],
          ].map(([t, b], i) => (
            <div key={i} className="p-4 bg-white rounded-2xl border border-stone-200">
              <div className="font-semibold text-[#2c2c2c] mb-1">{t}</div>
              <p className="text-[15px] text-[#6b6b6b]">{b}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">Popular Interior Design Styles in Dubai</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {[
            ['Modern Minimalist', 'Clean lines, neutral palette, functional furniture'],
            ['Contemporary Luxury', 'Bold finishes, statement pieces, premium materials'],
            ['Arabic/Islamic', 'Mashrabiya screens, geometric patterns, warm tones'],
            ['Scandinavian', 'Light wood, white walls, hygge comfort'],
            ['Industrial', 'Exposed concrete, metal accents, open plans'],
            ['Coastal/Mediterranean', 'Blues, whites, natural textures, light-filled'],
          ].map(([style, desc], i) => (
            <div key={i} className="p-4 bg-white rounded-2xl border border-stone-200">
              <div className="font-semibold text-[#2c2c2c] text-[15px] mb-1">{style}</div>
              <p className="text-[13px] text-stone-500">{desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6 mb-12">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3>
              <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#b8864a]/5 rounded-2xl border border-[#b8864a]/20">
          <p className="font-semibold text-[#2c2c2c] mb-2">Browse interior designers on Tarmeer</p>
          <p className="text-[15px] text-[#6b6b6b] mb-4">View portfolios from hundreds of verified interior design companies across Dubai and the UAE.</p>
          <a href="/services/interior-design/dubai" className="btn-primary">See all Dubai interior designers →</a>
        </div>
      </PageContainer>
    </div>
  );
}
```

**Step 3: Create the remaining 3 guide pages**

Create `src/pages/guides/ApartmentRenovationUaePage.tsx`:

```tsx
import { Helmet } from 'react-helmet-async';
import PageContainer from '../../components/PageContainer';

const FAQS = [
  { q: 'How much does apartment renovation cost in UAE?', a: 'Apartment renovation in the UAE costs AED 400–1,500 per sqm depending on finish quality. A typical 800 sqft apartment costs AED 40,000–120,000 for a full renovation.' },
  { q: 'Do I need approval for apartment renovation in Dubai?', a: 'Cosmetic changes (painting, flooring, kitchen cabinets) generally do not need approval. Structural changes, plumbing, and electrical modifications require a NOC from the building management and a DM permit.' },
  { q: 'How long does an apartment renovation take in UAE?', a: 'Most apartment renovations take 4–8 weeks. Complex projects with structural changes or custom millwork can take 10–14 weeks.' },
  { q: 'Can I renovate a rented apartment in Dubai?', a: 'Yes, with written approval from your landlord. Get approval in writing before starting any work, and ensure you understand the reinstatement clause in your tenancy contract.' },
  { q: 'What are the best flooring options for apartments in UAE?', a: 'Porcelain tiles are the most popular choice in UAE due to heat and humidity resistance. Engineered wood and luxury vinyl planks are popular for bedrooms. Marble and granite are common in luxury apartments.' },
];

export default function ApartmentRenovationUaePage() {
  const canonicalUrl = 'https://www.tarmeer.com/guide/apartment-renovation-uae';
  const title = 'Apartment Renovation in UAE: Complete Checklist & Cost Guide | Tarmeer';
  const description = 'Planning an apartment renovation in UAE? Step-by-step checklist, cost breakdown, permit requirements, and tips for finding the right contractor.';
  const articleJsonLd = { '@context': 'https://schema.org', '@type': 'Article', '@id': canonicalUrl, 'headline': title, 'description': description, 'url': canonicalUrl, 'datePublished': '2026-05-28', 'dateModified': '2026-05-28', 'author': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' }, 'publisher': { '@type': 'Organization', 'name': 'Tarmeer' } };
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': FAQS.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })) };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PageContainer className="py-10 sm:py-16 max-w-3xl">
        <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">Renovation Guide</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-6 leading-tight">Apartment Renovation in UAE: Complete Checklist</h1>
        <p className="text-[17px] text-[#6b6b6b] leading-relaxed mb-8">Renovating an apartment in the UAE requires careful planning around permits, contractor selection, and material sourcing. This checklist walks you through every step.</p>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">Pre-Renovation Checklist</h2>
        <div className="space-y-3 mb-8">
          {[
            'Check tenancy contract for renovation clauses (if renting)',
            'Get written approval from landlord or building management',
            'Identify which changes require DM permits',
            'Set a realistic budget with 15% contingency',
            'Get at least 3 detailed quotes (BOQ format)',
            'Verify contractor trade licence with DED',
            'Agree on timeline, payment milestones, and penalty clauses',
            'Arrange temporary accommodation if needed',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-stone-200">
              <span className="w-5 h-5 rounded border-2 border-[#b8864a] flex-shrink-0 mt-0.5" />
              <span className="text-[15px] text-[#2c2c2c]">{item}</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6 mb-12">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3>
              <p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="p-6 bg-[#b8864a]/5 rounded-2xl border border-[#b8864a]/20">
          <p className="font-semibold text-[#2c2c2c] mb-2">Find renovation companies in UAE</p>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Compare verified renovation companies across Dubai, Abu Dhabi, and Sharjah.</p>
          <a href="/services/renovation/dubai" className="btn-primary">Browse renovation companies →</a>
        </div>
      </PageContainer>
    </div>
  );
}
```

Create `src/pages/guides/VillaRenovationDubaiPage.tsx`:

```tsx
import { Helmet } from 'react-helmet-async';
import PageContainer from '../../components/PageContainer';

const FAQS = [
  { q: 'How much does villa renovation cost in Dubai?', a: 'Villa renovation in Dubai typically costs AED 150,000–700,000+ depending on villa size and scope. A mid-range full renovation of a 3,000 sqft villa runs AED 300,000–500,000.' },
  { q: 'How long does a full villa renovation take in Dubai?', a: 'A comprehensive villa renovation in Dubai takes 3–6 months. Phased renovations room-by-room can be done while living in the villa.' },
  { q: 'What permits are required for villa renovation in Dubai?', a: 'Structural changes, roof modifications, swimming pool additions, and boundary wall changes require permits from Dubai Municipality. Your contractor should handle the permit process.' },
  { q: 'Can I add a room or extension to my villa in Dubai?', a: 'Extensions are possible but require approval from Dubai Municipality and potentially from your community developer (e.g., Emaar, Nakheel). Built-up area limits and setback rules apply.' },
  { q: 'What is the best time to renovate a villa in Dubai?', a: 'The cooler months (October–April) are ideal for villa renovations as outdoor work is more comfortable and workers are more productive. Avoid starting major projects in July–August.' },
];

export default function VillaRenovationDubaiPage() {
  const canonicalUrl = 'https://www.tarmeer.com/guide/villa-renovation-dubai';
  const title = 'Villa Renovation in Dubai: Costs, Permits & Contractor Guide 2026 | Tarmeer';
  const description = 'Planning a villa renovation in Dubai? Complete guide covering costs, permits, timelines, and how to choose the right contractor for your villa project.';
  const articleJsonLd = { '@context': 'https://schema.org', '@type': 'Article', '@id': canonicalUrl, 'headline': title, 'description': description, 'url': canonicalUrl, 'datePublished': '2026-05-28', 'dateModified': '2026-05-28', 'author': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' }, 'publisher': { '@type': 'Organization', 'name': 'Tarmeer' } };
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': FAQS.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })) };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PageContainer className="py-10 sm:py-16 max-w-3xl">
        <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">Villa Renovation Guide</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-6 leading-tight">Villa Renovation in Dubai: Complete 2026 Guide</h1>
        <p className="text-[17px] text-[#6b6b6b] leading-relaxed mb-8">Dubai villas require experienced contractors who understand local regulations, community rules, and the UAE climate. This guide covers everything from budgeting to contractor selection.</p>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">Villa Renovation Cost Breakdown</h2>
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-[15px] border-collapse">
            <thead><tr className="bg-stone-100"><th className="text-left p-3 font-semibold text-stone-700 border border-stone-200">Area</th><th className="text-right p-3 font-semibold text-stone-700 border border-stone-200">Mid-Range</th><th className="text-right p-3 font-semibold text-stone-700 border border-stone-200">Luxury</th></tr></thead>
            <tbody>
              {[['Living & dining areas', 'AED 60K–120K', 'AED 200K+'], ['Kitchen', 'AED 40K–80K', 'AED 150K+'], ['Master bedroom suite', 'AED 30K–60K', 'AED 100K+'], ['Bathrooms (per bathroom)', 'AED 15K–30K', 'AED 60K+'], ['External landscaping', 'AED 20K–50K', 'AED 100K+'], ['Swimming pool addition', 'AED 80K–150K', 'AED 300K+']].map(([area, mid, lux], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                  <td className="p-3 text-[#2c2c2c] border border-stone-200">{area}</td>
                  <td className="p-3 text-right text-stone-600 border border-stone-200">{mid}</td>
                  <td className="p-3 text-right font-medium text-[#b8864a] border border-stone-200">{lux}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6 mb-12">
          {FAQS.map((faq, i) => (<div key={i}><h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3><p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p></div>))}
        </div>

        <div className="p-6 bg-[#b8864a]/5 rounded-2xl border border-[#b8864a]/20">
          <p className="font-semibold text-[#2c2c2c] mb-2">Find villa renovation specialists on Tarmeer</p>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Browse portfolios from experienced villa renovation companies in Dubai.</p>
          <a href="/services/villa-renovation/dubai" className="btn-primary">See villa renovation companies →</a>
        </div>
      </PageContainer>
    </div>
  );
}
```

Create `src/pages/guides/HowToChooseInteriorDesignerPage.tsx`:

```tsx
import { Helmet } from 'react-helmet-async';
import PageContainer from '../../components/PageContainer';

const FAQS = [
  { q: 'How do I verify an interior designer\'s credentials in UAE?', a: 'Check their trade licence on the DED website, ask for previous client references, review their portfolio for completed projects similar to yours, and verify any professional memberships they claim.' },
  { q: 'Should I hire an interior designer or a renovation contractor?', a: 'For concept, space planning, and material selection, hire an interior designer. For construction and fit-out work, hire a contractor. Many Dubai companies offer both services under one roof.' },
  { q: 'What questions should I ask before hiring an interior designer?', a: 'Ask: How many projects similar to mine have you completed? What is your project management process? Who will be my day-to-day contact? How do you handle change orders? Can I see 3 client references?' },
  { q: 'How long does an interior design contract last in Dubai?', a: 'Design phase typically takes 4–8 weeks. Implementation takes 4–12 weeks for apartments, 3–6 months for villas. Always get a written timeline with milestones before signing.' },
  { q: 'What is a typical interior design fee structure in UAE?', a: 'Common fee structures include: percentage of project cost (10–15%), per sqm rate (AED 100–300/sqm), flat project fee, or hourly rate (AED 300–800/hour). Agree in writing before work starts.' },
];

export default function HowToChooseInteriorDesignerPage() {
  const canonicalUrl = 'https://www.tarmeer.com/guide/how-to-choose-interior-designer-uae';
  const title = 'How to Choose an Interior Designer in UAE: Expert Guide | Tarmeer';
  const description = 'Step-by-step guide to choosing the right interior designer in UAE. What to look for, questions to ask, how to compare quotes, and red flags to avoid.';
  const articleJsonLd = { '@context': 'https://schema.org', '@type': 'Article', '@id': canonicalUrl, 'headline': title, 'description': description, 'url': canonicalUrl, 'datePublished': '2026-05-28', 'dateModified': '2026-05-28', 'author': { '@type': 'Organization', 'name': 'Tarmeer', 'url': 'https://www.tarmeer.com' }, 'publisher': { '@type': 'Organization', 'name': 'Tarmeer' } };
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': FAQS.map(f => ({ '@type': 'Question', 'name': f.q, 'acceptedAnswer': { '@type': 'Answer', 'text': f.a } })) };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content="https://www.tarmeer.com/og-default.jpg" />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <PageContainer className="py-10 sm:py-16 max-w-3xl">
        <p className="text-sm font-medium text-[#b8864a] uppercase tracking-widest mb-3">Hiring Guide</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2c2c2c] mb-6 leading-tight">How to Choose an Interior Designer in UAE</h1>
        <p className="text-[17px] text-[#6b6b6b] leading-relaxed mb-8">Choosing the right interior designer can make the difference between a dream result and a costly mistake. This guide walks you through the selection process step by step.</p>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">6-Step Selection Process</h2>
        <div className="space-y-4 mb-8">
          {[
            ['Define your brief', 'Before approaching any designer, document your requirements: space size, budget, timeline, preferred style, and must-have features. A clear brief gets you accurate quotes.'],
            ['Review portfolios', 'Look for 3–5 completed projects similar to yours. Pay attention to material quality, finishing detail, and spatial flow. Style alignment matters more than awards or certifications.'],
            ['Verify credentials', 'Confirm their DED trade licence is valid and matches interior design / fit-out activities. Ask for professional indemnity insurance for larger projects.'],
            ['Request detailed proposals', 'Ask for a BOQ (bill of quantities) or at minimum a detailed scope of work. Compare apples to apples — the cheapest quote may exclude items others include.'],
            ['Check references', 'Speak with 2–3 previous clients. Ask: Did the project finish on time? Was the final cost close to the quote? Would you hire them again?'],
            ['Negotiate the contract', 'Ensure the contract covers: scope, timeline, payment milestones, change order process, warranties, and defects liability period (minimum 1 year recommended).'],
          ].map(([step, body], i) => (
            <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border border-stone-200">
              <div className="w-8 h-8 rounded-full bg-[#b8864a] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
              <div>
                <div className="font-semibold text-[#2c2c2c] mb-1">{step}</div>
                <p className="text-[15px] text-[#6b6b6b]">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-4">Red Flags to Watch For</h2>
        <div className="space-y-2 mb-8">
          {['No valid trade licence', 'No written contract or BOQ', 'Demands full payment upfront', 'Cannot provide client references', 'Vague timeline with no milestones', 'No professional indemnity insurance for large projects'].map((flag, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <span className="text-red-400 font-bold">✗</span>
              <span className="text-[15px] text-red-700">{flag}</span>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#2c2c2c] mt-10 mb-6">Frequently Asked Questions</h2>
        <div className="space-y-6 mb-12">
          {FAQS.map((faq, i) => (<div key={i}><h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{faq.q}</h3><p className="text-[15px] text-[#6b6b6b] leading-relaxed">{faq.a}</p></div>))}
        </div>

        <div className="p-6 bg-[#b8864a]/5 rounded-2xl border border-[#b8864a]/20">
          <p className="font-semibold text-[#2c2c2c] mb-2">Compare interior designers on Tarmeer</p>
          <p className="text-[15px] text-[#6b6b6b] mb-4">Browse portfolios from hundreds of verified interior design companies across UAE. Free to use.</p>
          <a href="/services/interior-design/dubai" className="btn-primary">Find an interior designer →</a>
        </div>
      </PageContainer>
    </div>
  );
}
```

**Step 4: Add routes in App.tsx**

Add lazy imports:
```tsx
const RenovationCostDubaiPage = lazyRetry(() => import('./pages/guides/RenovationCostDubaiPage'));
const BestInteriorDesignersDubaiPage = lazyRetry(() => import('./pages/guides/BestInteriorDesignersDubaiPage'));
const ApartmentRenovationUaePage = lazyRetry(() => import('./pages/guides/ApartmentRenovationUaePage'));
const VillaRenovationDubaiPage = lazyRetry(() => import('./pages/guides/VillaRenovationDubaiPage'));
const HowToChooseInteriorDesignerPage = lazyRetry(() => import('./pages/guides/HowToChooseInteriorDesignerPage'));
```

Add routes inside `<Layout>` before the `*` catch-all:
```tsx
<Route path="/guide/renovation-cost-dubai" element={<RenovationCostDubaiPage />} />
<Route path="/guide/best-interior-designers-dubai" element={<BestInteriorDesignersDubaiPage />} />
<Route path="/guide/apartment-renovation-uae" element={<ApartmentRenovationUaePage />} />
<Route path="/guide/villa-renovation-dubai" element={<VillaRenovationDubaiPage />} />
<Route path="/guide/how-to-choose-interior-designer-uae" element={<HowToChooseInteriorDesignerPage />} />
```

**Step 5: Add guide pages to sitemap in app.ts**

In `server/src/app.ts`, inside the static sitemap section, add after existing static pages:
```ts
{ path: '/guide/renovation-cost-dubai', changefreq: 'monthly', priority: '0.8' },
{ path: '/guide/best-interior-designers-dubai', changefreq: 'monthly', priority: '0.8' },
{ path: '/guide/apartment-renovation-uae', changefreq: 'monthly', priority: '0.8' },
{ path: '/guide/villa-renovation-dubai', changefreq: 'monthly', priority: '0.8' },
{ path: '/guide/how-to-choose-interior-designer-uae', changefreq: 'monthly', priority: '0.8' },
```

**Step 6: Add to SEO linter**

In `scripts/harness/lint-seo.mjs`, add to `PUBLIC_PAGES`:
```js
'src/pages/guides/RenovationCostDubaiPage.tsx',
'src/pages/guides/BestInteriorDesignersDubaiPage.tsx',
'src/pages/guides/ApartmentRenovationUaePage.tsx',
'src/pages/guides/VillaRenovationDubaiPage.tsx',
'src/pages/guides/HowToChooseInteriorDesignerPage.tsx',
```

**Step 7: Verify TypeScript**
```bash
cd /Users/kp/Code/tarmeer-4.0-local && node_modules/.bin/tsc --noEmit --skipLibCheck
```

**Step 8: Commit**
```bash
git add src/pages/guides/ src/App.tsx scripts/harness/lint-seo.mjs server/src/app.ts
git commit -m "feat(seo): add 5 guide content pages targeting high-value UAE renovation queries"
```

---

## Task 5: IndexNow Integration

**Files:**
- Create: `server/src/lib/indexNow.ts`
- Create: `public/[key].txt` (key file — see step 1 for key generation)
- Modify: `server/src/controllers/companyAdminController.ts` (call on company approval)
- Modify: `.env.example`

**Context:**
- IndexNow is a free API that instantly notifies Google/Bing of new URLs
- Requires a key file at `https://www.tarmeer.com/{key}.txt`
- The key file must contain just the key string
- Failures should be silent (never block the approval flow)

**Step 1: Generate IndexNow key**

```bash
node -e "const c='abcdefghijklmnopqrstuvwxyz0123456789';let k='';for(let i=0;i<32;i++)k+=c[Math.floor(Math.random()*c.length)];console.log(k)"
```

Copy the output (e.g. `a3f7k2m9p1q5r8s4t6u0v2w7x9y1z3b5`) — this is your `INDEXNOW_KEY`.

**Step 2: Create key file**

```bash
echo -n "YOUR_KEY_HERE" > public/YOUR_KEY_HERE.txt
```

(Replace both occurrences of `YOUR_KEY_HERE` with the generated key.)

**Step 3: Add to .env**
```
INDEXNOW_KEY=YOUR_KEY_HERE
```

**Step 4: Create server/src/lib/indexNow.ts**

```ts
import https from 'https';

const KEY = process.env.INDEXNOW_KEY || '';
const HOST = 'www.tarmeer.com';

/**
 * Notify IndexNow (Google + Bing) about new or updated URLs.
 * Failures are silent — never block the calling operation.
 */
export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (!KEY || !urls.length) return;

  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls.slice(0, 10000), // IndexNow max
  });

  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.indexnow.org',
      path: '/indexnow',
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      res.resume(); // drain response
      if (res.statusCode && res.statusCode >= 400) {
        console.warn(`[IndexNow] unexpected status ${res.statusCode}`);
      }
      resolve();
    });
    req.on('error', err => { console.warn('[IndexNow] request error:', err.message); resolve(); });
    req.write(body);
    req.end();
  });
}

export function companyIndexNowUrl(slug: string): string {
  return `https://${HOST}/@${slug}`;
}
```

**Step 5: Wire to company approval in companyAdminController.ts**

Find the function that sets `status = 'approved'` for a company (search for `'approved'` in the file). After the DB update succeeds, add:

```ts
import { notifyIndexNow, companyIndexNowUrl } from '../lib/indexNow';

// After UPDATE query that approves company:
if (company.slug) {
  notifyIndexNow([companyIndexNowUrl(company.slug)]).catch(() => {});
}
```

**Step 6: Compile and restart server**
```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && node_modules/.bin/tsc --noEmit --skipLibCheck
node_modules/.bin/tsc
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
```

**Step 7: Commit**
```bash
git add server/src/lib/indexNow.ts public/*.txt server/src/controllers/companyAdminController.ts .env.example
git commit -m "feat(seo): add IndexNow integration — instant crawl notification on company/project approval"
```

---

## Task 6: SEO Linter + Final Verification

**Step 1: Run SEO linter**
```bash
node scripts/harness/lint-seo.mjs
# All pages should PASS
```

**Step 2: Run route coverage linter**
```bash
node scripts/harness/lint-route-coverage.mjs
# New endpoint should be covered
```

**Step 3: Run frontend tsc**
```bash
cd /Users/kp/Code/tarmeer-4.0-local && node_modules/.bin/tsc --noEmit --skipLibCheck
```

**Step 4: Test key pages locally**
- `http://localhost:5180/services/interior-design/dubai` — company list + FAQ + schema
- `http://localhost:5180/guide/renovation-cost-dubai` — article + FAQ + schema
- `http://localhost:5180/@any-existing-company-slug` — canonical uses `/@slug` format

**Step 5: Final commit message summary**
```
feat(seo): SEO/GEO Phase 1 complete

- Task 1: CompanyDetailPage schema — /@slug canonical, dynamic areaServed, hasOfferCatalog, @id
- Task 2: GET /api/companies/by-service-city endpoint
- Task 3: ServiceCityPage — 48 programmatic landing pages at /services/:service/:city
- Task 4: 5 guide pages (renovation cost, best designers, apartment checklist, villa, how-to-choose)
- Task 5: IndexNow integration — instant crawl notification on approval
- Task 6: SEO linter passing, all routes covered

Test results: [fill in]
```
