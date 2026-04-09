#!/usr/bin/env node
/**
 * Auto-tag projects based on title, style, and description keywords.
 * Maps to standardized Room + Style tags.
 *
 * Usage:
 *   node scripts/auto-tag-projects.mjs          # Dry-run (report only)
 *   node scripts/auto-tag-projects.mjs --apply  # Write tags to DB
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('../server/node_modules/mysql2/promise');

const DB = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'tarmeer' };

// ── Tag taxonomy ──────────────────────────────────────────────────

const ROOM_TAGS = {
  'Living Room':  ['living room', 'living area', 'lounge', 'sitting room', 'family room'],
  'Dining Room':  ['dining room', 'dining area', 'dining', 'dinning'],
  'Bedroom':      ['bedroom', 'bed room', 'master bedroom', 'guest room'],
  'Kitchen':      ['kitchen', 'kitchenette', 'pantry'],
  'Bathroom':     ['bathroom', 'bath room', 'washroom', 'toilet', 'powder room', 'shower'],
  'Home Office':  ['office', 'study room', 'workspace', 'home office', 'work room'],
  'Majlis':       ['majlis', 'مجلس', 'arabic seating', 'diwan'],
  'Hallway':      ['hallway', 'corridor', 'hall', 'entry', 'entrance', 'foyer', 'lobby'],
  'Nursery':      ['nursery', 'kids room', 'children room', 'playroom', 'kid room'],
  'Patio':        ['patio', 'terrace', 'balcony', 'outdoor', 'garden', 'landscape', 'exterior'],
  'Staircase':    ['staircase', 'stair', 'stairs'],
  'Retail':       ['retail', 'shop', 'store', 'boutique', 'showroom', 'mall'],
  'Restaurant':   ['restaurant', 'cafe', 'dining bar', 'bar', 'coffee'],
  'Hotel':        ['hotel', 'resort', 'hospitality', 'guest house', 'suite'],
  'Villa':        ['villa', 'mansion', 'palace', 'residence', 'residential'],
  'Apartment':    ['apartment', 'flat', 'penthouse', 'condo'],
  'Commercial':   ['commercial', 'corporate', 'tower', 'building', 'mixed-use', 'mixed use'],
  'Mosque':       ['mosque', 'masjid'],
  'Salon':        ['salon', 'spa', 'beauty'],
  'Hospital':     ['hospital', 'clinic', 'medical', 'healthcare'],
  'School':       ['school', 'university', 'academy', 'college', 'education'],
  'Factory':      ['factory', 'warehouse', 'industrial'],
};

const STYLE_TAGS = {
  'Modern':       ['modern', 'contemporary', 'sleek'],
  'Minimalist':   ['minimalist', 'minimal', 'clean lines'],
  'Luxury':       ['luxury', 'luxurious', 'premium', 'opulent', 'grand'],
  'Classical':    ['classical', 'classic', 'neoclassical', 'french', 'victorian'],
  'Traditional':  ['traditional', 'heritage', 'conventional'],
  'Arabic':       ['arabic', 'islamic', 'moroccan', 'arabian', 'oriental'],
  'Scandinavian': ['scandinavian', 'nordic', 'scandi'],
  'Industrial':   ['industrial', 'loft', 'exposed brick', 'raw'],
  'Bohemian':     ['bohemian', 'boho', 'eclectic'],
  'Farmhouse':    ['farmhouse', 'rustic', 'country'],
  'Art Deco':     ['art deco', 'deco', 'gatsby'],
  'Coastal':      ['coastal', 'beach', 'nautical', 'mediterranean'],
  'Glam':         ['glam', 'glamorous', 'hollywood'],
  'Mid-Century':  ['mid-century', 'midcentury', 'retro', '60s', '70s'],
};

function autoTag(title, style, _description) {
  // Only use title + style for matching — description has too much noise
  const text = `${title || ''} ${style || ''}`.toLowerCase();
  const tags = new Set();

  for (const [tag, keywords] of Object.entries(ROOM_TAGS)) {
    if (keywords.some(kw => text.includes(kw))) tags.add(tag);
  }
  for (const [tag, keywords] of Object.entries(STYLE_TAGS)) {
    if (keywords.some(kw => text.includes(kw))) tags.add(tag);
  }

  return [...tags];
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = mysql.createPool(DB);

  // 1. Tag registered projects
  const [projects] = await pool.execute(
    'SELECT id, title, style, description FROM projects WHERE deleted_at IS NULL'
  );

  let tagged = 0, skipped = 0;
  for (const p of projects) {
    const tags = autoTag(p.title, p.style, p.description);
    if (tags.length === 0) { skipped++; continue; }
    tagged++;
    console.log(`  [${p.id}] "${p.title}" → ${tags.join(', ')}`);
    if (apply) {
      await pool.execute('UPDATE projects SET tags = ? WHERE id = ?', [JSON.stringify(tags), p.id]);
    }
  }

  // 2. Tag directory company portfolio categories (use category name as tag source)
  const [companies] = await pool.execute(
    'SELECT id, name_en, portfolio_images FROM uae_companies WHERE is_active = 1 AND portfolio_images IS NOT NULL AND portfolio_images != ""'
  );

  let dirTagged = 0;
  for (const c of companies) {
    let portfolio;
    try { portfolio = JSON.parse(c.portfolio_images); } catch { continue; }
    if (!portfolio || typeof portfolio !== 'object') continue;

    for (const catName of Object.keys(portfolio)) {
      const tags = autoTag(catName, '', c.name_en);
      if (tags.length > 0) {
        dirTagged++;
        console.log(`  [dir:${c.id}] "${catName}" → ${tags.join(', ')}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Registered projects: ${tagged} tagged, ${skipped} no match`);
  console.log(`Directory categories: ${dirTagged} tagged`);
  console.log(`Mode: ${apply ? 'APPLIED to database' : 'DRY RUN (use --apply to write)'}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
