# UAE Companies Scraping Workflow

> Complete pipeline for scraping, processing, and deploying company portfolio data.

## Overview

```
Scrape → Quality Filter → Dedup → Compress → Sync DB → Deploy
```

## Step 1: Scrape Portfolio Images

**Script:** `scripts/uae-scraper/scrape-portfolio-categories.mjs`

```bash
# Single company
node scripts/uae-scraper/scrape-portfolio-categories.mjs --slug algedra --force

# All companies
node scripts/uae-scraper/scrape-portfolio-categories.mjs --force

# Large batch: split into 10 agents for parallel execution
```

### Image Quality Upgrade Algorithms

#### 1. WordPress Original Image Restoration
Strip thumbnail size suffix from URL to get full-size original:
```
image-300x200.jpg  →  image.jpg  (original 3199x2107)
image-1024x768.jpg →  image.jpg
```
Regex: `url.replace(/-\d{2,4}x\d{2,4}(\.\w+)$/, '$1')`

#### 2. srcset Largest Version Selection
Parse srcset attribute, sort by width descriptor descending, pick largest:
```
srcset="img-384w.jpg 384w, img-1200w.jpg 1200w"
→ Pick: img-1200w.jpg (largest)
```
Previously picked first entry (smallest).

#### 3. Next.js Image Optimizer Upgrade
Increase resolution and quality parameters:
```
/_next/image?url=...&w=384&q=75  →  &w=1200&q=90
```

#### 4. Cloudinary CDN Upgrade
Request higher resolution from Cloudinary:
```
/w_400,h_300,c_fill/  →  /w_1200,c_fill,q_auto/
```

### Scraper Configuration
- `MAX_IMAGES_PER_CATEGORY`: 20
- `MAX_IMAGES_PER_COMPANY`: 100
- `REQUEST_DELAY_MS`: 2000 (polite delay)
- `PUPPETEER_TIMEOUT`: 30000ms (falls back to domcontentloaded)

### Category Discovery Strategy (5 layers)
1. Extract category links from homepage HTML (nav links matching portfolio/projects/work patterns)
2. Support language prefixes (`/en/`, `/ar/`) and deep paths (`/services/interior-design/residential`)
3. Fallback to rendered links via Puppeteer (for SPA sites)
4. Crawl portfolio listing pages for deeper project links
5. Last resort: deep-scan homepage for any images

---

## Step 2: Quality Filter (5-Layer Pipeline)

### Layer 1: URL Pattern Filter (at scrape time)
**File:** `scripts/uae-scraper/scrape-logos-lib.mjs` → `isLikelyContentImage()`

Skip images matching:
- `logo`, `icon`, `favicon`, `brand`, `badge`
- `placeholder`, `spacer`, `blank`, `pixel`, `tracking`
- `facebook`, `twitter`, `linkedin`, `youtube`, `instagram`
- `.svg` files (usually icons/logos)
- `/wp-includes/`, `/plugins/` paths

### Layer 2: Dimension + Aspect Ratio Filter (pre-import)
**Script:** `scripts/uae-scraper/dedup-images.mjs`

- Width < 200px → remove
- Height < 150px → remove
- Aspect ratio > 3.5 (banner/strip) → remove
- Aspect ratio < 0.25 (narrow vertical) → remove

### Layer 3: Fingerprint Dedup (pre-import)
**Script:** `scripts/uae-scraper/dedup-images.mjs`

- Resize to 16x16 grayscale with `sharp`
- Compare pixel arrays between images
- Similarity > 92% → duplicate → remove
- Keeps first occurrence, removes subsequent duplicates

### Layer 4: Dark Image Detection (pre-import)
**Script:** `scripts/uae-scraper/dedup-images.mjs`

- Calculate average brightness from 16x16 grayscale thumbnail
- Brightness < 45 (out of 255) → too dark → remove

### Layer 5: Text/Banner Overlay Detection (pre-import)
**Script:** `scripts/uae-scraper/dedup-images.mjs`

- Scan 64x64 grayscale image
- Count bright pixels (>240) and bright-edge transitions (bright pixel adjacent to dark pixel <180)
- If >8% bright pixels AND >3% bright-edge ratio → promotional banner with text → remove

### Running Quality Filter
```bash
# Dry run (see what would be removed)
node scripts/uae-scraper/dedup-images.mjs

# Apply changes
node scripts/uae-scraper/dedup-images.mjs --apply

# Single company
node scripts/uae-scraper/dedup-images.mjs --slug fitout-squad --apply
```

---

## Step 3: Compress Images

**Script:** `scripts/uae-scraper/compress-images.py`

- Max dimensions: 800x800px
- Quality: JPEG 75
- Skip files already under 50KB
- Convert PNG/WebP to JPEG for better compression
- Typical savings: 77% (1376MB → 310MB)

```bash
# Dry run
python3 scripts/uae-scraper/compress-images.py

# Apply
python3 scripts/uae-scraper/compress-images.py --apply

# Custom settings
python3 scripts/uae-scraper/compress-images.py --apply --max-width 600 --quality 70
```

---

## Step 4: Sync to Database

**Script:** `scripts/uae-scraper/sync-to-db.mjs`

Updates `uae_companies.portfolio_images` JSON field with categorized data.

```bash
# Dry run
node scripts/uae-scraper/sync-to-db.mjs

# Apply to local DB
node scripts/uae-scraper/sync-to-db.mjs --apply

# Single company
node scripts/uae-scraper/sync-to-db.mjs --slug algedra --apply
```

---

## Step 5: Deploy to Production

**ALWAYS ask user before deploying.**

### Sync data to RDS
```bash
mysqldump -u root tarmeer uae_companies --no-create-info --complete-insert --skip-lock-tables --set-gtid-purged=OFF > /tmp/uae_companies_data.sql

ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "mysql -h rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com -u tarmeerCRM -pXXX tarmeer -e 'TRUNCATE TABLE uae_companies;'"

cat /tmp/uae_companies_data.sql | ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "mysql -h rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com -u tarmeerCRM -pXXX tarmeer"
```

### Sync images to server
```bash
rsync -az --stats -e "ssh -i ~/.ssh/tarmeer_ecs" \
  public/images/uae-companies/portfolio/ \
  root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/uae-companies/portfolio/

# Fix permissions
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal/images/uae-companies/portfolio/ -type d -exec chmod 755 {} + && \
   find /tarmeer/tarmeer_web_portal/images/uae-companies/portfolio/ -type f -exec chmod 644 {} +"
```

---

## Full Pipeline Command Sequence

```bash
# 1. Scrape (parallel: split into 10 agents)
node scripts/uae-scraper/scrape-portfolio-categories.mjs --force

# 2. Quality filter + dedup
node scripts/uae-scraper/dedup-images.mjs --apply

# 3. Compress
python3 scripts/uae-scraper/compress-images.py --apply

# 4. Sync to local DB
node scripts/uae-scraper/sync-to-db.mjs --apply

# 5. Deploy (ask user first!)
# ... see Step 5 above
```

---

## Category Normalization

**File:** `src/lib/categoryNormalize.ts`

Maps 180+ raw scraped category names to ~10 unified display names:

| Raw Examples | Display Name |
|---|---|
| Villa, Villas-Design, Penthouse, Apartment | Residential |
| Hotel, Restaurant, Dining, Spa, Cafe | Hospitality |
| Malls, Shopping-malls, Banks, Showroom | Commercial |
| Offices, Office-fitout, Workspace, Corporate | Office |
| Hospital, Clinic, Healthcare | Healthcare |
| Museum, Mosque, School, Pavilion | Cultural & Public |
| Long-hyphenated-project-names | Featured Projects |

---

## Copyright Compliance

- Scraped images: click → redirect to source website (referral mode)
- Claimed companies (`owner_user_id` set): click → Lightbox on-site (legal)
- Logo only shown if URL path contains `/logos/`
- All company pages link back to original website
- DMCA complaint mechanism planned

---

## Key Files

| File | Purpose |
|---|---|
| `scripts/uae-scraper/scrape-portfolio-categories.mjs` | Main scraper |
| `scripts/uae-scraper/scrape-logos-lib.mjs` | Image extraction + URL upgrade algorithms |
| `scripts/uae-scraper/dedup-images.mjs` | Quality filter + fingerprint dedup |
| `scripts/uae-scraper/compress-images.py` | Image compression |
| `scripts/uae-scraper/sync-to-db.mjs` | Database sync |
| `scripts/uae-scraper/companies-data.json` | Source company list (100) |
| `scripts/uae-scraper/companies-data-final.json` | Processed data with portfolio categories |
| `scripts/uae-scraper/crawl-manifest.json` | Crawl metadata and timestamps |
| `src/lib/categoryNormalize.ts` | Frontend category name mapping |
