# Image SEO + Full Retag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Force-retag all project images with B+C engine, overwriting Gemini tags; (2) give each portfolio image its own SEO page at `/portfolio/{tag}/{companySlug}/{projectSlug}/{imageIndex}`; (3) fix Navbar taxonomy alignment.

**Architecture:** The tag engine already works (B=metadataTagger + C=onnxTagger). New backend endpoint returns single image context (image data + project info + sibling images). New frontend page renders hero image with full SEO Helmet + tags + project info. Portfolio feed extended with `imageIndex` field to construct image URLs.

**Tech Stack:** TypeScript, Express, React, React Router v6, React Helmet Async, existing tagEngine in `server/src/services/tagEngine/`

---

## Task 1: Force-retag all projects script

**Files:**
- Create: `scripts/force-retag-all.mjs`

**Context:** `backfill-image-tags.mjs` only picks up untagged projects. We need to retag ALL projects with `forceRetag=true` to overwrite Gemini tags.

**Step 1: Create the script**

```js
// scripts/force-retag-all.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { config: dotenvConfig } = require('./server/node_modules/dotenv/lib/main.js');
dotenvConfig({ path: './server/.env' });

const { tagProjectImages } = await import('./server/dist/services/tagEngine/index.js');
const pool = (await import('./server/dist/config/database.js')).default;

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 999999;
const startArg = process.argv.find(a => a.startsWith('--start-id='));
const START_ID = startArg ? parseInt(startArg.split('=')[1], 10) : 0;

const [rows] = await pool.execute(
  `SELECT id, title FROM projects
   WHERE deleted_at IS NULL
     AND images IS NOT NULL AND images != '[]'
     AND id > ?
   ORDER BY id ASC
   LIMIT ?`,
  [START_ID, LIMIT]
);

console.log(`全量重打标: ${rows.length} 个项目 (force=true)`);

if (!apply) {
  console.log('Dry run — 加 --apply 执行写入');
  console.log('前5个:', rows.slice(0, 5).map(r => `#${r.id} ${r.title}`).join(', '));
  await pool.end();
  process.exit(0);
}

let done = 0;
for (const row of rows) {
  process.stdout.write(`[${done + 1}/${rows.length}] #${row.id} ${row.title} ... `);
  await tagProjectImages(row.id, true); // forceRetag=true
  console.log('done');
  done++;
  await new Promise(r => setTimeout(r, 500));
}

console.log(`全部完成: ${done} 个项目已重打标`);
await pool.end();
```

**Step 2: Dry-run locally to confirm project count**

```bash
cd /Users/kp/Code/tarmeer-4.0-local
node scripts/force-retag-all.mjs
```

Expected: prints project count, exits without writing

**Step 3: Commit**

```bash
git add scripts/force-retag-all.mjs
git commit -m "feat: add force-retag-all script — overwrites Gemini tags with B+C engine"
```

---

## Task 2: Add `imageIndex` to portfolio feed response

**Files:**
- Modify: `server/src/controllers/companyController.ts`

**Context:** Portfolio page needs to construct image SEO URLs. URL format is `/portfolio/{primaryTag}/{companySlug}/{projectSlug}/{imageIndex}`. The `imageIndex` is the 0-based position of the image within its project's images array.

**Step 1: Read the current `extractImageEntries` function**

```bash
sed -n '1,45p' server/src/controllers/companyController.ts
```

**Step 2: Update `extractImageEntries` to include imageIndex**

Change the return type and add `idx` tracking in the `.map()` call:

```typescript
// Change return type:
function extractImageEntries(raw: unknown): Array<{ url: string; tags: string[]; imageIndex: number }> {
  if (!raw) return [];
  let arr: unknown[] = [];
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];

  return (arr
    .map((entry, idx) => {   // <-- add idx
      if (typeof entry === 'string') {
        return { url: entry, tags: [] as string[], imageIndex: idx };
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const url = typeof obj.url === 'string' ? obj.url : '';
        const tags: string[] = Array.isArray(obj.ai_tags)
          ? (obj.ai_tags as unknown[]).filter((t): t is string => typeof t === 'string')
          : [];
        return { url, tags, imageIndex: idx };
      }
      return { url: '', tags: [] as string[], imageIndex: idx };
    })
    .filter(e => e.url));
}
```

**Step 3: Add `imageIndex` to the registered images map**

Find the `.map(entry => ({...}))` inside `getPortfolioFeed` (around line 140) and add:

```typescript
imageIndex: entry.imageIndex,   // <-- add this line
```

**Step 4: Build check**

```bash
cd server && npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors

**Step 5: Commit**

```bash
git add server/src/controllers/companyController.ts
git commit -m "feat: add imageIndex to portfolio feed response for SEO URL construction"
```

---

## Task 3: Backend — single image detail endpoint

**Files:**
- Modify: `server/src/controllers/companyController.ts` (add new function)
- Modify: routes file that registers company/portfolio routes

**Step 1: Find the routes file**

```bash
grep -rn "getPortfolioFeed\|portfolio" server/src/routes/ | head -10
```

**Step 2: Add `getPortfolioImage` at the end of `companyController.ts`**

```typescript
/**
 * GET /api/portfolio/image/:companySlug/:projectSlug/:imageIndex
 * Returns data for a single image SEO page.
 */
export async function getPortfolioImage(req: any, res: any) {
  try {
    const { companySlug, projectSlug, imageIndex: imageIndexStr } = req.params;
    const imageIndex = parseInt(imageIndexStr, 10);
    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({ error: 'Invalid imageIndex' });
    }

    const [rows] = await pool.execute(
      `SELECT
         p.id, p.title, p.slug as project_slug, p.images, p.style, p.description, p.location,
         cp.id as company_id, cp.company_name, cp.slug as company_slug,
         cp.logo_url, cp.city
       FROM projects p
       JOIN company_profiles cp ON p.company_profile_id = cp.id
       WHERE cp.slug = ? AND p.slug = ?
         AND cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 1`,
      [companySlug, projectSlug]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: 'Not found' });
    }

    const row = (rows as any[])[0];
    const entries = extractImageEntries(row.images);

    if (imageIndex >= entries.length) {
      return res.status(404).json({ error: 'Image index out of range' });
    }

    const targetEntry = entries[imageIndex];
    const siblings = entries
      .filter((_, i) => i !== imageIndex)
      .map(e => ({ url: e.url, tags: e.tags, imageIndex: e.imageIndex }))
      .slice(0, 8);

    res.json({
      image: {
        url: targetEntry.url,
        tags: targetEntry.tags,
        imageIndex,
      },
      project: {
        id: row.id,
        title: row.title || '',
        slug: row.project_slug || '',
        style: row.style || '',
        description: row.description || '',
        location: row.location || '',
      },
      company: {
        id: row.company_id,
        name: row.company_name || '',
        slug: row.company_slug || '',
        logo: row.logo_url || '',
        city: row.city || '',
      },
      siblings,
    });
  } catch (error) {
    console.error('Get portfolio image error:', error);
    res.status(500).json({ error: 'Failed to load image.' });
  }
}
```

**Step 3: Register the route**

Open the routes file found in Step 1. Add import and route:

```typescript
import { getPortfolioFeed, getPortfolioImage } from '../controllers/companyController.js';

// Add this route (BEFORE any wildcard routes):
router.get('/portfolio/image/:companySlug/:projectSlug/:imageIndex', getPortfolioImage);
```

**Step 4: Build and test locally**

```bash
cd server && npx tsc --noEmit --skipLibCheck && npm run build 2>/dev/null || npx tsc --skipLibCheck
PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js &
sleep 2
# Replace slugs with real values from your DB
curl "http://localhost:3099/api/portfolio/image/test-company/test-project/0"
# Expected: 200 JSON or 404 (if slugs don't exist — that's fine for structure test)
kill %1
```

**Step 5: Commit**

```bash
git add server/src/controllers/companyController.ts server/src/routes/
git commit -m "feat: add GET /api/portfolio/image/:companySlug/:projectSlug/:imageIndex endpoint"
```

---

## Task 4: Frontend — PortfolioImagePage

**Files:**
- Create: `src/pages/PortfolioImagePage.tsx`
- Modify: `src/App.tsx`

**Step 1: Create the page**

```tsx
// src/pages/PortfolioImagePage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

interface ImageData { url: string; tags: string[]; imageIndex: number; }
interface ProjectData { id: number; title: string; slug: string; style: string; description: string; location: string; }
interface CompanyData { id: number; name: string; slug: string; logo: string; city: string; }
interface PageData { image: ImageData; project: ProjectData; company: CompanyData; siblings: ImageData[]; }

function getFullImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://www.tarmeer.com${url}`;
}

export default function PortfolioImagePage() {
  const { primaryTag, companySlug, projectSlug, imageIndex } = useParams<{
    primaryTag: string; companySlug: string; projectSlug: string; imageIndex: string;
  }>();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companySlug || !projectSlug || imageIndex === undefined) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/portfolio/image/${companySlug}/${projectSlug}/${imageIndex}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [companySlug, projectSlug, imageIndex]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-stone-500">Image not found.</p>
        <Link to="/portfolio" className="text-[#b8864a] text-sm hover:underline">Back to Portfolio</Link>
      </div>
    );
  }

  const { image, project, company, siblings } = data;
  const fullImageUrl = getFullImageUrl(image.url);
  const pageTitle = `${project.title || primaryTag} — ${company.name} | Tarmeer Portfolio`;
  const pageDescription = `${primaryTag} interior design by ${company.name}${company.city ? ' in ' + company.city : ''}. ${project.description?.slice(0, 100) || ''}`.trim();
  const canonicalUrl = `https://www.tarmeer.com/portfolio/${primaryTag}/${companySlug}/${projectSlug}/${imageIndex}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    url: fullImageUrl,
    name: pageTitle,
    description: pageDescription,
    author: { '@type': 'Organization', name: company.name },
    keywords: image.tags.join(', '),
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={fullImageUrl} />
        <meta property="og:type" content="article" />
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Back nav */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-3">
          <Link
            to={`/portfolio?tag=${encodeURIComponent(primaryTag || '')}`}
            className="text-sm text-stone-500 hover:text-[#b8864a] transition-colors"
          >
            ← {primaryTag} Portfolio
          </Link>
        </div>

        {/* Hero image */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="rounded-2xl overflow-hidden bg-stone-100">
            <img
              src={image.url}
              alt={`${project.title} by ${company.name}`}
              className="w-full max-h-[70vh] object-contain"
              loading="eager"
            />
          </div>
        </div>

        {/* Tags */}
        {image.tags.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 mt-4 flex flex-wrap gap-2">
            {image.tags.map(tag => (
              <Link
                key={tag}
                to={`/portfolio?tag=${encodeURIComponent(tag)}`}
                className="text-xs px-3 py-1 rounded-full border border-stone-200 text-stone-600 hover:bg-[#b8864a] hover:text-white hover:border-[#b8864a] transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Company + project info */}
        <div className="max-w-5xl mx-auto px-4 mt-6 flex items-start gap-4">
          {company.logo && (
            <img src={company.logo} alt={company.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-bold text-[#2c2c2c]">{project.title || 'Untitled Project'}</h1>
            <p className="text-sm text-stone-500 mt-1">
              by{' '}
              <Link to={`/companies/${company.slug}`} className="text-[#b8864a] hover:underline">
                {company.name}
              </Link>
              {company.city && ` · ${company.city}`}
            </p>
            {project.description && (
              <p className="text-[15px] text-stone-600 mt-3 line-clamp-3">{project.description}</p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <Link to={`/companies/${company.slug}/${project.slug}`} className="btn-primary">
            View Full Project
          </Link>
        </div>

        {/* Sibling images */}
        {siblings.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 mt-10 mb-16">
            <h2 className="text-sm font-medium text-stone-500 mb-3">More from this project</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {siblings.map(sib => {
                const sibTag = sib.tags[0] || primaryTag || '';
                return (
                  <Link
                    key={sib.imageIndex}
                    to={`/portfolio/${encodeURIComponent(sibTag)}/${companySlug}/${projectSlug}/${sib.imageIndex}`}
                    className="aspect-square rounded-xl overflow-hidden bg-stone-100 block"
                  >
                    <img
                      src={sib.url}
                      alt={`${project.title} image ${sib.imageIndex + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Add lazy import and route in `src/App.tsx`**

Find (around line 64):
```tsx
const PortfolioPage = lazyRetry(() => import('./pages/PortfolioPage'));
```

Add after it:
```tsx
const PortfolioImagePage = lazyRetry(() => import('./pages/PortfolioImagePage'));
```

Find (around line 358):
```tsx
<Route path="/portfolio" element={<PortfolioPage />} />
```

Add after it:
```tsx
<Route path="/portfolio/:primaryTag/:companySlug/:projectSlug/:imageIndex" element={<PortfolioImagePage />} />
```

**Step 3: Verify tsc**

```bash
cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck
```

**Step 4: Commit**

```bash
git add src/pages/PortfolioImagePage.tsx src/App.tsx
git commit -m "feat: add per-image SEO page at /portfolio/:tag/:companySlug/:projectSlug/:imageIndex"
```

---

## Task 5: Wire image links in PortfolioPage

**Files:**
- Modify: `src/pages/PortfolioPage.tsx`

**Step 1: Read the image rendering section**

```bash
grep -n "onClick\|Link\|navigate\|companySlug\|imageIndex\|image\.url" src/pages/PortfolioPage.tsx | head -30
```

**Step 2: Add image SEO URL helper function near top of PortfolioPage**

```tsx
function getImageSeoUrl(image: {
  tags: string[];
  companySlug: string;
  projectSlug: string;
  imageIndex: number;
  source: string;
}): string | null {
  if (image.source !== 'registered') return null;
  if (!image.companySlug || !image.projectSlug || image.imageIndex === undefined) return null;
  const primaryTag = encodeURIComponent(image.tags[0] || 'portfolio');
  return `/portfolio/${primaryTag}/${image.companySlug}/${image.projectSlug}/${image.imageIndex}`;
}
```

**Step 3: Update image rendering to use Link for registered images**

Find where images are rendered (the JustifiedGallery or grid). For each image, wrap with:

```tsx
import { Link } from 'react-router-dom';

// In the render:
const seoUrl = getImageSeoUrl(image);
if (seoUrl) {
  return (
    <Link to={seoUrl} key={/* key */}>
      <img src={image.url} alt={image.projectTitle} ... />
    </Link>
  );
}
// Fallback for directory images (no SEO page yet):
return <img src={image.url} alt={image.projectTitle} ... />;
```

**Step 4: Verify tsc**

```bash
npx tsc --noEmit --skipLibCheck
```

**Step 5: Test locally**

```bash
# Start local dev
# Open http://localhost:5180/portfolio
# Click any image — should navigate to /portfolio/Kitchen/company/project/0
```

**Step 6: Commit**

```bash
git add src/pages/PortfolioPage.tsx
git commit -m "feat: link portfolio grid images to individual SEO pages"
```

---

## Task 6: Fix Navbar taxonomy alignment

**Files:**
- Modify: `src/components/Navbar.tsx` (lines 21–42)

**Context:** Taxonomy mismatches found:
- Navbar "Office" → engine produces "Home Office" → filter never matches
- Navbar missing: Majlis, Coastal, Bohemian

**Step 1: Replace `portfolioCategories` in Navbar.tsx**

```typescript
const portfolioCategories = {
  'By Room': [
    { label: 'Living Room', to: '/portfolio?tag=Living+Room' },
    { label: 'Bedroom',     to: '/portfolio?tag=Bedroom' },
    { label: 'Kitchen',     to: '/portfolio?tag=Kitchen' },
    { label: 'Bathroom',    to: '/portfolio?tag=Bathroom' },
    { label: 'Dining Room', to: '/portfolio?tag=Dining+Room' },
    { label: 'Home Office', to: '/portfolio?tag=Home+Office' },
    { label: 'Majlis',      to: '/portfolio?tag=Majlis' },
    { label: 'Hallway',     to: '/portfolio?tag=Hallway' },
    { label: 'Outdoor',     to: '/portfolio?tag=Outdoor' },
  ],
  'By Style': [
    { label: 'Modern',       to: '/portfolio?tag=Modern' },
    { label: 'Luxury',       to: '/portfolio?tag=Luxury' },
    { label: 'Minimalist',   to: '/portfolio?tag=Minimalist' },
    { label: 'Classical',    to: '/portfolio?tag=Classical' },
    { label: 'Arabic',       to: '/portfolio?tag=Arabic' },
    { label: 'Industrial',   to: '/portfolio?tag=Industrial' },
    { label: 'Scandinavian', to: '/portfolio?tag=Scandinavian' },
    { label: 'Coastal',      to: '/portfolio?tag=Coastal' },
    { label: 'Art Deco',     to: '/portfolio?tag=Art+Deco' },
    { label: 'Bohemian',     to: '/portfolio?tag=Bohemian' },
  ],
};
```

**Step 2: Verify tsc**

```bash
cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck
```

**Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "fix: align Navbar portfolio categories with tag taxonomy (Home Office, Majlis, Coastal, Bohemian)"
```

---

## Task 7: SEO lint check

**Step 1: Run lint**

```bash
node scripts/harness/lint-seo.mjs
```

Expected: PASS. The new dynamic image route uses canonical URLs in Helmet — no static entry needed.

If it fails due to missing Helmet on PortfolioImagePage, add the Helmet block (already in Task 4 template above).

---

## Task 8: Deploy and run force-retag on production

**Step 1: Build backend**

```bash
cd server && npx tsc --skipLibCheck
```

**Step 2: Deploy backend**

```bash
bash deploy-backend-ecs.sh
```

**Step 3: Deploy frontend**

```bash
DEPLOY_SSH_KEY=~/.ssh/tarmeer_ecs DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES SKIP_SCHEMA_CHECK=YES bash deploy-simple.sh
```

**Step 4: Copy force-retag script to production**

```bash
scp -i ~/.ssh/tarmeer_ecs scripts/force-retag-all.mjs root@47.91.108.104:/tarmeer/tarmeer_api/force-retag-all.mjs
```

**Step 5: SSH dry-run**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
cd /tarmeer/tarmeer_api
node force-retag-all.mjs
# Expected: prints N 个项目, exits
```

**Step 6: Run with --apply**

```bash
node force-retag-all.mjs --apply 2>&1 | tee /tmp/retag-$(date +%Y%m%d).log
```

If interrupted, resume from last `#id`:
```bash
node force-retag-all.mjs --apply --start-id=1234
```

**Step 7: Verify a sample**

```bash
mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT id, LEFT(tags, 200) FROM projects WHERE deleted_at IS NULL LIMIT 5;"
```

Expected: non-empty JSON arrays

---

## Task 9: Smoke test production

```bash
# Tag filter
curl "https://www.tarmeer.com/api/companies/portfolio?tag=Kitchen&limit=3"
# Expected: images with "Kitchen" in tags

# Image detail endpoint
curl "https://www.tarmeer.com/api/portfolio/image/{companySlug}/{projectSlug}/0"
# Expected: JSON with image, project, company, siblings

# Browser checks:
# 1. https://www.tarmeer.com/portfolio — click an image → SEO page loads
# 2. SEO page: tags clickable, CTA works, siblings show
# 3. Navbar Portfolio → "Home Office" link → filter returns results
# 4. Navbar Portfolio → "Kitchen" → filter returns results
```
