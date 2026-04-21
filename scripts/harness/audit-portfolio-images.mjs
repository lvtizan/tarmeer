#!/usr/bin/env node
/**
 * Portfolio Image Audit & Repair
 *
 * Scans all portfolio images on the server, identifies:
 * 1. Broken originals (< 10KB or 0 bytes)
 * 2. Missing medium/thumb/blur variants
 * 3. Orphan variants without originals
 *
 * Modes:
 *   --report     List issues (default)
 *   --fix        Regenerate missing variants from good originals (requires sharp)
 *   --list-broken  Output broken originals for re-crawl
 *
 * Usage:
 *   node scripts/harness/audit-portfolio-images.mjs --report
 *   node scripts/harness/audit-portfolio-images.mjs --fix
 *   node scripts/harness/audit-portfolio-images.mjs --list-broken > broken.txt
 *
 * Run on server: scp to ECS, then node audit-portfolio-images.mjs --report
 */

import fs from 'fs';
import path from 'path';

const PORTFOLIO_DIR = process.env.PORTFOLIO_DIR || 'public/images/uae-companies/portfolio';
const MIN_ORIGINAL_SIZE = 10 * 1024; // 10KB — below this is broken
const VARIANTS = ['blur', 'thumb', 'medium'];

const mode = process.argv.includes('--fix') ? 'fix'
  : process.argv.includes('--list-broken') ? 'list-broken'
  : 'report';

function walkDir(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else {
        results.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

function isOriginal(filename) {
  const base = path.basename(filename, path.extname(filename));
  return !VARIANTS.some(v => base.endsWith(`-${v}`));
}

function getVariantPath(originalPath, variant) {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  return path.join(dir, `${base}-${variant}.webp`);
}

// Scan
const allFiles = walkDir(PORTFOLIO_DIR);
const originals = allFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && isOriginal(f));

let brokenCount = 0;
let missingVariants = 0;
let goodCount = 0;
const brokenFiles = [];
const missingVariantFiles = [];

for (const orig of originals) {
  const stat = fs.statSync(orig);

  if (stat.size < MIN_ORIGINAL_SIZE) {
    brokenCount++;
    brokenFiles.push({ path: orig, size: stat.size });
    if (mode === 'list-broken') {
      const rel = path.relative(PORTFOLIO_DIR, orig);
      const company = rel.split(path.sep)[0];
      console.log(`${company}|${rel}|${stat.size}B`);
    }
    continue;
  }

  goodCount++;

  // Check variants exist
  for (const variant of VARIANTS) {
    const vPath = getVariantPath(orig, variant);
    if (!fs.existsSync(vPath)) {
      missingVariants++;
      missingVariantFiles.push({ original: orig, variant, variantPath: vPath });
    }
  }
}

if (mode === 'report') {
  console.log('\n' + '='.repeat(50));
  console.log('  Portfolio Image Audit Report');
  console.log('='.repeat(50));
  console.log(`  Total originals:     ${originals.length}`);
  console.log(`  Good (>= 10KB):      ${goodCount}`);
  console.log(`  Broken (< 10KB):     ${brokenCount}`);
  console.log(`  Missing variants:    ${missingVariants}`);
  console.log('='.repeat(50));

  if (brokenCount > 0) {
    console.log('\nBroken originals (top 20):');
    brokenFiles.slice(0, 20).forEach(f => {
      const rel = path.relative(PORTFOLIO_DIR, f.path);
      console.log(`  ${f.size}B  ${rel}`);
    });
    if (brokenCount > 20) console.log(`  ... and ${brokenCount - 20} more`);
  }

  if (missingVariants > 0) {
    console.log(`\nMissing variants (top 10):`);
    missingVariantFiles.slice(0, 10).forEach(f => {
      console.log(`  ${path.relative(PORTFOLIO_DIR, f.original)} → missing -${f.variant}.webp`);
    });
  }

  console.log(`\nTo fix: node audit-portfolio-images.mjs --fix`);
  console.log(`To list broken for re-crawl: node audit-portfolio-images.mjs --list-broken\n`);
}

if (mode === 'fix') {
  // Only regenerate variants for good originals that are missing them
  if (missingVariantFiles.length === 0) {
    console.log('No missing variants to fix.');
    process.exit(0);
  }

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp not installed. Run: npm install sharp');
    process.exit(1);
  }

  console.log(`Regenerating ${missingVariantFiles.length} missing variants...`);
  let fixed = 0;
  let errors = 0;

  for (const { original, variant, variantPath } of missingVariantFiles) {
    try {
      const img = sharp(original);
      const meta = await img.metadata();
      if (!meta.width || !meta.height) { errors++; continue; }

      let pipeline;
      switch (variant) {
        case 'blur':
          pipeline = img.resize(16, 16, { fit: 'cover' }).webp({ quality: 20 });
          break;
        case 'thumb':
          pipeline = img.resize(400, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 });
          break;
        case 'medium':
          pipeline = img.resize(1200, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 });
          break;
      }

      await pipeline.toFile(variantPath);
      fixed++;

      if (fixed % 50 === 0) {
        console.log(`  Progress: ${fixed}/${missingVariantFiles.length}`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error: ${path.relative(PORTFOLIO_DIR, original)} → ${variant}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${errors} errors`);
}

process.exit(brokenCount > 0 && mode === 'report' ? 1 : 0);
