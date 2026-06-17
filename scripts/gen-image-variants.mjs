/**
 * Canonical image-variant generator (HD + cached multi-size WebP).
 *
 * RULE: every image added to the site MUST be run through this before deploy.
 * Generates 4 WebP variants per image + chmods 0644 (nginx-readable):
 *   -blur   (64px,  q35) → instant blur-up placeholder
 *   -thumb  (600px, q78) → cards / small
 *   -medium (1200px,q84) → main display
 *   (full)  (≤2000px,q82) → srcSet top / large screens
 *
 * Usage — pass one or more  <src>::<outBaseWithDir>  pairs:
 *   node scripts/gen-image-variants.mjs \
 *     '/abs/path/18.png::public/images/about/hero-villa-ae-2' \
 *     '/abs/path/19.png::public/images/about/hero-villa-ae-3'
 *
 * Then in JSX use ProgressiveImage (blur-up) or <img srcSet> with:
 *   src     = `${base}-medium.webp`
 *   srcSet  = `${base}-thumb.webp 600w, ${base}-medium.webp 1200w, ${base}.webp 2000w`
 *   blur    = `${base}-blur.webp`
 *   loading = 'lazy' (hero/LCP: 'eager' + fetchPriority 'high'); explicit width/height to avoid CLS.
 */
import { createRequire } from 'module';
import { chmodSync } from 'fs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const VARIANTS = [
  { suf: '-blur', w: 64, q: 35 },
  { suf: '-thumb', w: 600, q: 78 },
  { suf: '-medium', w: 1200, q: 84 },
  { suf: '', w: 2000, q: 82, noEnlarge: true },
];

const pairs = process.argv.slice(2);
if (pairs.length === 0) {
  console.error('Usage: node scripts/gen-image-variants.mjs <src>::<outBase> [<src>::<outBase> ...]');
  process.exit(1);
}

(async () => {
  for (const pair of pairs) {
    const [src, base] = pair.split('::');
    if (!src || !base) { console.error(`Bad pair (need src::outBase): ${pair}`); process.exit(1); }
    for (const v of VARIANTS) {
      const out = `${base}${v.suf}.webp`;
      await sharp(src)
        .resize({ width: v.w, withoutEnlargement: !!v.noEnlarge })
        .webp({ quality: v.q, effort: 6 })
        .toFile(out);
      chmodSync(out, 0o644);
    }
    console.log(`✓ ${base} → -blur / -thumb / -medium / full`);
  }
  console.log('Done. Remember: srcSet + ProgressiveImage(blur) + eager-only-for-hero.');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
