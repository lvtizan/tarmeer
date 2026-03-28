# UAE Portfolio Re-crawl Runbook

## Goal
Reuse the proven scraping workflow to maximize portfolio image coverage (especially large project images) for UAE companies.

## Core Method (Large-Image Oriented)
1. Render pages with Puppeteer (not static HTML only).
2. Auto-scroll to trigger lazy-loaded media.
3. Prefer category pages (`portfolio/project/work`) first.
4. Fallback to project-detail pages.
5. Last fallback: deep scan homepage.
6. Extract from multiple sources: `img/src`, `data-src`, `srcset`, `picture source`, CSS `background-image`, and direct image links.
7. Normalize URLs, dedupe, filter obvious noise (`logo/icon/favicon`).
8. Download with `curl --location` and keep original extension (`jpg/png/webp`).

## Script and Data Files
- Scraper: `scripts/uae-scraper/scrape-portfolio-categories.mjs`
- Source list: `scripts/uae-scraper/companies-data.json`
- Output: `scripts/uae-scraper/companies-data-final.json`
- Incremental state: `scripts/uae-scraper/crawl-manifest.json`
- Local image root: `public/images/uae-companies/portfolio/`

## Environment
If Puppeteer cannot launch browser on macOS, set Chrome explicitly:

```bash
export PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

## Execution Modes
### 1) Incremental (recommended day-to-day)
Skips fresh companies that already have images.

```bash
cd /Users/kp/Code/tarmeer-4.0-local
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/uae-scraper/scrape-portfolio-categories.mjs
```

### 2) Full force recrawl (expensive)
Re-crawls all companies regardless of manifest freshness.

```bash
cd /Users/kp/Code/tarmeer-4.0-local
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/uae-scraper/scrape-portfolio-categories.mjs --force
```

### 3) Single company debug

```bash
cd /Users/kp/Code/tarmeer-4.0-local
PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/uae-scraper/scrape-portfolio-categories.mjs --slug <company-slug> --force
```

## Quick Validation
### Company-level image counts

```bash
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('scripts/uae-scraper/companies-data-final.json','utf8'));d.forEach(c=>{const cats=c.portfolio_categories||{};const n=Object.values(cats).reduce((a,v)=>a+(Array.isArray(v)?v.length:0),0);console.log(`${c.slug}\t${n}`);});"
```

### Global summary

```bash
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('scripts/uae-scraper/companies-data-final.json','utf8'));const counts=d.map(c=>Object.values(c.portfolio_categories||{}).reduce((a,v)=>a+(Array.isArray(v)?v.length:0),0));console.log(JSON.stringify({total:d.length,withImages:counts.filter(n=>n>0).length,withoutImages:counts.filter(n=>n===0).length},null,2));"
```

## Common Failures and Handling
1. `Failed to launch the browser process`.
Set `PUPPETEER_EXECUTABLE_PATH` to local Chrome and retry.
2. `ERR_CONNECTION_CLOSED` / timeout.
Mark as temporary site/network failure and retry later with `--slug`.
3. `curl 403/404` for some URLs.
Keep crawl result, accept partial saves for that category, and continue.

## Practical Operating Rules
1. Use incremental mode by default.
2. Use full force mode only for major refreshes.
3. Keep `crawl-manifest.json` under version control to preserve skip logic.
4. Re-run failed slugs separately instead of restarting full run.

