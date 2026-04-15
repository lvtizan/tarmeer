#!/usr/bin/env node
/**
 * Migrate project tags to the unified room + style taxonomy.
 *
 * Old tags:  ["Modern Luxury", "Dubai", "Residential"]
 * New tags:  ["Living Room", "Modern", "Luxury"]
 *
 * Logic:
 * 1. Map old style tag → new style tag(s)
 * 2. Extract room type from project title keywords
 * 3. Preserve any already-correct tags (room types from Gemini)
 * 4. Drop city names and Residential/Turnkey
 *
 * Usage:
 *   node scripts/migrate-project-tags.mjs              # dry run
 *   node scripts/migrate-project-tags.mjs --apply      # write to DB
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Support both local (scripts/ → ../server/.env) and server (/tarmeer/tarmeer_api/.env)
import { existsSync } from 'fs';
const envCandidates = [
  resolve(__dirname, '../server/.env'),
  resolve(__dirname, '.env'),
  resolve(__dirname, '../.env'),
];
const envPath = envCandidates.find(p => existsSync(p));
if (!envPath) { console.error('Cannot find .env file'); process.exit(1); }
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const apply = process.argv.includes('--apply');

// ── Style mapping: old tag → new canonical style tag(s) ──
const STYLE_MAP = {
  'Modern Luxury':            ['Modern', 'Luxury'],
  'Luxury Modern':            ['Modern', 'Luxury'],
  'Contemporary':             ['Modern'],
  'Smart Contemporary':       ['Modern'],
  'Elegant Contemporary':     ['Modern'],
  'Classic Contemporary':     ['Classical', 'Modern'],
  'Commercial Contemporary':  ['Modern'],
  'Soft Minimal':             ['Minimalist'],
  'Calm Minimal':             ['Minimalist'],
  'Modern Arabic':            ['Modern', 'Arabic'],
  'Boutique Luxury':          ['Luxury'],
  'Signature Luxury':         ['Luxury'],
  'Luxury Craft':             ['Luxury'],
  'Minimalist':               ['Minimalist'],
  'Coastal':                  ['Coastal'],
  'Resort Coastal':           ['Coastal'],
  'Scandinavian':             ['Scandinavian'],
  'Industrial':               ['Industrial'],
  'Modern Renovation':        ['Modern'],
  'Warm Modern':              ['Modern'],
  'Lifestyle Modern':         ['Modern'],
  'Budget Modern':            ['Modern'],
  'Urban Modern':             ['Modern'],
  'Workplace Modern':         ['Modern'],
  'Soft Decoration':          ['Modern'],
};

// ── Room detection from title keywords ──
const ROOM_KEYWORDS = [
  { pattern: /\bbedroom\b/i,                          tag: 'Bedroom' },
  { pattern: /\b(?:bed\s+suite|master\s+suite)\b/i,   tag: 'Bedroom' },
  { pattern: /\bkitchen\b/i,                          tag: 'Kitchen' },
  { pattern: /\b(?:bathroom|bath\b|powder\s*room)\b/i, tag: 'Bathroom' },
  { pattern: /\bliving\s*(?:room|area|space)?\b/i,    tag: 'Living Room' },
  { pattern: /\blounge\b/i,                           tag: 'Living Room' },
  { pattern: /\bdining\b/i,                           tag: 'Dining Room' },
  { pattern: /\b(?:office|library|workspace)\b/i,     tag: 'Home Office' },
  { pattern: /\bmajlis\b/i,                           tag: 'Majlis' },
  { pattern: /\b(?:hall\b|hallway|stair|entrance|lobby|reception|foyer)\b/i, tag: 'Hallway' },
  { pattern: /\b(?:kids?\s*room|nursery|children)\b/i, tag: 'Nursery' },
  { pattern: /\b(?:patio|terrace|deck|poolside|garden|outdoor|courtyard|balcony)\b/i, tag: 'Outdoor' },
  { pattern: /\b(?:closet|walk-?in|wardrobe)\b/i,     tag: 'Bedroom' },
  { pattern: /\bmedia\s*room\b/i,                     tag: 'Living Room' },
];

// Tags from Gemini that should be normalized
const GEMINI_NORMALIZE = {
  'Living':    'Living Room',
  'Dining':    'Dining Room',
  'Workspace': 'Home Office',
};

// Tags to drop (cities, types, non-filter utility tags)
const DROP_TAGS = new Set([
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah',
  'Residential', 'Turnkey',
  'Lighting', 'Materials', 'Storage', 'Renovation',
  'Villa', 'Apartment',
]);

// Valid final tags
const VALID_TAGS = new Set([
  'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room',
  'Home Office', 'Majlis', 'Hallway', 'Nursery', 'Outdoor',
  'Modern', 'Luxury', 'Minimalist', 'Classical', 'Arabic',
  'Industrial', 'Scandinavian', 'Coastal', 'Art Deco', 'Bohemian',
]);

function migrateTags(title, oldTags) {
  const newTags = new Set();

  for (const tag of oldTags) {
    // 1. Try style mapping
    if (STYLE_MAP[tag]) {
      for (const s of STYLE_MAP[tag]) newTags.add(s);
      continue;
    }

    // 2. Normalize Gemini short names
    if (GEMINI_NORMALIZE[tag]) {
      newTags.add(GEMINI_NORMALIZE[tag]);
      continue;
    }

    // 3. Drop known non-filter tags
    if (DROP_TAGS.has(tag)) continue;

    // 4. Keep if already valid
    if (VALID_TAGS.has(tag)) {
      newTags.add(tag);
      continue;
    }

    // 5. Unknown tag — drop silently (likely old-format)
  }

  // 6. Extract room type from title
  for (const { pattern, tag } of ROOM_KEYWORDS) {
    if (pattern.test(title)) {
      newTags.add(tag);
    }
  }

  return [...newTags].sort();
}

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  console.log(`Mode: ${apply ? 'APPLY (writing to DB)' : 'DRY RUN'}\n`);

  const [rows] = await conn.execute(
    `SELECT id, title, tags FROM projects
     WHERE deleted_at IS NULL AND images IS NOT NULL AND images != '[]'`
  );

  let changed = 0;
  let unchanged = 0;
  let noRoom = 0;

  for (const row of rows) {
    let oldTags = [];
    try {
      const parsed = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      if (Array.isArray(parsed)) oldTags = parsed;
    } catch { /* skip */ }

    const newTags = migrateTags(row.title || '', oldTags);
    const oldStr = JSON.stringify(oldTags.sort());
    const newStr = JSON.stringify(newTags);

    if (oldStr === newStr) {
      unchanged++;
      continue;
    }

    changed++;
    const hasRoom = newTags.some(t =>
      ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room',
       'Home Office', 'Majlis', 'Hallway', 'Nursery', 'Outdoor'].includes(t)
    );
    if (!hasRoom) noRoom++;

    console.log(`[${row.id}] "${row.title}"`);
    console.log(`  old: ${JSON.stringify(oldTags)}`);
    console.log(`  new: ${JSON.stringify(newTags)}${hasRoom ? '' : '  ⚠ NO ROOM TAG'}`);

    if (apply) {
      await conn.execute(
        'UPDATE projects SET tags = ? WHERE id = ?',
        [JSON.stringify(newTags), row.id]
      );
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total:     ${rows.length}`);
  console.log(`Changed:   ${changed}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`No room:   ${noRoom} (style-only, title didn't match any room keyword)`);
  if (!apply && changed > 0) {
    console.log(`\nRun with --apply to write changes to DB.`);
  }

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
