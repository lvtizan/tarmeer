# Image Quality Pipeline

Five layers of filtering ensure only high-quality, unique images are displayed to users. Each layer catches different types of bad images.

## Layer 1: URL-level Filter (scrape time)

**When**: During portfolio scraping (`scripts/uae-scraper/scrape-logos-lib.mjs`).

**Also applied in** `toCompany()` in `src/lib/publicApi.ts` when building `projectImages` from portfolio categories.

Filters out URLs matching:
- Logo/icon patterns: `logo`, `icon`, `favicon`, `brand`, `badge`
- Tiny thumbnail indicators: `_150x150`, `_100x100`, `thumb`, `small`, `mini`
- Placeholder images: `placeholder`, `spacer`, `blank`, `pixel`
- SVG files: `.svg`
- Social media images: `facebook`, `twitter`, `linkedin`, `youtube`, `instagram`
- WordPress system files: `/wp-includes/`, `/plugins/`

## Layer 2: File-level Filter (sips scan)

**When**: Post-download batch processing with macOS `sips` command.

Removes files that are:
- Smaller than 200x150 pixels
- Smaller than 5KB file size
- SVG format
- Extreme aspect ratios (banner-like or narrow strip)

This layer runs as a one-time cleanup step after scraping, before images are committed to the repository.

## Layer 3: Canvas Fingerprint Dedup (client-side)

**Where**: `MasonryGallery.tsx`, applied in the `onLoad` handler of each image.

**How it works**:
1. Each loaded image is drawn to a hidden 16x16 canvas.
2. Pixel data is converted to grayscale values (256 numbers).
3. The grayscale array is compared against all previously seen fingerprints.
4. If similarity exceeds 0.92 (92%), the image is considered a duplicate and its container is hidden via `classList.add('hidden')`.
5. Non-duplicate fingerprints are stored in a ref (`fingerprintsRef`) for future comparisons.

**Similarity formula**: Per-pixel difference normalized to 0-1, averaged across all 256 pixels.

Fingerprints are reset when:
- The active category tab changes.
- The component receives new `categories` props (navigating to a different company).

## Layer 4: Dark Image Detection (client-side)

**Where**: `MasonryGallery.tsx`, same `onLoad` handler as Layer 3.

**Threshold**: Average brightness < 45 (on a 0-255 scale).

**How brightness is calculated**: From the same 16x16 canvas fingerprint. Each pixel's brightness = `0.299*R + 0.587*G + 0.114*B` (ITU-R BT.601 luma). Average across all 256 pixels.

Images below the threshold (very dark photos, black placeholders, dark overlays) are hidden.

## Layer 5: Aspect Ratio Filter (client-side)

**Where**: Two locations:
1. `MasonryGallery.tsx` `onLoad` handler -- hides images with `w < 200`, `h < 150`, `ratio > 3.5`, or `ratio < 0.25`.
2. `CompanyCard` in `CompaniesPage.tsx` `handleImageLoad` -- same thresholds, skips to next image in the listing card.

**What it catches**:
- `ratio > 3.5`: Horizontal banners, navigation bars, header strips.
- `ratio < 0.25`: Narrow vertical strips, sidebar decorations.
- `w < 200` or `h < 150`: Thumbnails that passed URL filtering but are still too small.

## Supporting Infrastructure

### Image URL Resolution (`src/lib/imageUrl.ts`)

- Normalizes relative paths, protocol-relative URLs, `public/` prefixes.
- Rewrites `/uploads/` paths to `/api/uploads/` (served by Express static middleware).
- Rewrites `admin.tarmeer.com` absolute URLs to `www.tarmeer.com`.
- Applies hotfix map for known broken file extensions (e.g., `.png` that should be `.jpg`).

### Image Cleanup Utilities (`src/lib/imageCleanup.ts`)

- `sanitizeImageUrl()`: Normalizes a single URL with all the rewriting rules.
- `sanitizeImageUrls()`: Batch normalize + deduplicate by stripping query strings.
- `sanitizeAvatarUrl()`: Filters out known seed/stock avatar images.
- `getImageFallbackCandidates()`: For a given URL, generates fallback candidates with different extensions (jpg, jpeg, png, webp, avif) and path variations.
- `getNextRenderableImageIndex()`: Finds the next image in an array that has not been marked as failed.

### Fallback Behavior

When an image fails to load (`onError`):
1. Try the next fallback candidate from `getImageFallbackCandidates()` (different extensions).
2. If all candidates exhausted, hide the container (MasonryGallery) or skip to the next image (CompanyCard).
