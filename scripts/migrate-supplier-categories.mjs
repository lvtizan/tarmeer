/**
 * Migrate supplier 分类 + supplier_products.category from the OLD supplier-categories
 * taxonomy onto the canonical product_categories taxonomy (child `value`s).
 *
 * WHAT IT DOES
 *   1. Seeds the two missing product_categories children (stairs, plants) — idempotent INSERT IGNORE.
 *   2. Snapshots (reversible) every supplier_profiles.categories and every
 *      supplier_products.category into supplier_categories_migration_backup BEFORE touching data.
 *   3. Rewrites supplier_profiles.categories: parse (JSON array OR comma string) → map each old
 *      tag → product_categories child value (MAP below) → dedupe → DROP unmapped (incl. 'other'
 *      and Vietnamese/garbage) → store back as a JSON array of child values.
 *   4. Rewrites supplier_products.category through the same map (single value; DROP → NULL if unmapped).
 *   5. Prints before/after counts + a sample.
 *
 * Category values are GLOBAL (not country-specific). Suppliers ARE per-country, but a supplier's
 * category set is just a set of global taxonomy values — so we migrate ALL rows regardless of country.
 * This does NOT touch any country / ref_source column, so country isolation is untouched.
 *
 * SAFETY
 *   - Idempotent: re-running maps already-valid values to themselves; backup INSERT IGNOREs by id.
 *   - DOES snapshot first. DOES NOT drop/alter any production column beyond creating the backup table.
 *
 * USAGE (PRODUCTION — run ON the server, per AGENTS.md — NEVER against local unless testing):
 *   cd /tarmeer/tarmeer_api
 *   node /path/to/migrate-supplier-categories.mjs                 # reads /tarmeer/tarmeer_api/.env
 *   # or point at an explicit env file:
 *   ENV_PATH=/tarmeer/tarmeer_api/.env node migrate-supplier-categories.mjs
 *   DRY_RUN=1 ... node migrate-supplier-categories.mjs           # compute + print, write nothing
 *
 * ROLLBACK (restore from snapshot):
 *   UPDATE supplier_profiles p
 *     JOIN supplier_categories_migration_backup b
 *       ON b.entity='supplier' AND b.entity_id = p.id
 *     SET p.categories = b.old_value;
 *   UPDATE supplier_products pr
 *     JOIN supplier_categories_migration_backup b
 *       ON b.entity='product' AND b.entity_id = pr.id
 *     SET pr.category = b.old_value;
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

// Prefer the server's mysql2 (prod install); fall back to local node_modules for a local dry-run.
function loadMysql() {
  const candidates = [
    '/tarmeer/tarmeer_api/node_modules/mysql2/promise',
    'mysql2/promise',
  ];
  for (const p of candidates) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('mysql2 not found — run this on the server (cd /tarmeer/tarmeer_api) or install mysql2 locally.');
}
const mysql = loadMysql();

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

// ── DB creds: env file (operator supplies prod .env) with process.env fallback ────────────────
const ENV_PATH = process.env.ENV_PATH || '/tarmeer/tarmeer_api/.env';
const env = {};
try {
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) env[m[1]] = m[2].trim();
  }
} catch { /* no env file — rely purely on process.env */ }
const cfg = {
  host: env.DB_HOST || process.env.DB_HOST,
  port: parseInt(env.DB_PORT || process.env.DB_PORT || '3306', 10),
  user: env.DB_USER || process.env.DB_USER,
  password: env.DB_PASSWORD || process.env.DB_PASSWORD,
  database: env.DB_NAME || process.env.DB_NAME,
  charset: 'utf8mb4',
};
if (!cfg.host || !cfg.user || !cfg.database) {
  console.error('Missing DB creds. Provide via ENV_PATH file or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME env vars.');
  process.exit(1);
}

// ── Old tag → product_categories child value ──────────────────────────────────────────────────
// Anything NOT in this map (incl. 'other' and Vietnamese/garbage) is DROPPED.
// Already-valid product_categories child values map to themselves (idempotent re-runs).
const MAP = {
  // → furniture
  furniture: 'furniture', italian_minimal: 'furniture', italian_luxury: 'furniture',
  modern_functional: 'furniture', european_style: 'furniture', american_style: 'furniture',
  french_style: 'furniture', wabi_sabi: 'furniture', childrens_furn: 'furniture',
  outdoor_furn: 'furniture', office_furn: 'furniture', office: 'furniture',
  hotel_furn: 'furniture', beds: 'furniture', bedding: 'furniture',
  wardrobe: 'furniture', whole_house: 'furniture',
  // → lighting
  lighting: 'lighting', lighting_new: 'lighting',
  // → stone
  stone: 'stone', stone_materials: 'stone',
  // → flooring
  flooring: 'flooring', spc: 'flooring', wood_flooring: 'flooring',
  // → kitchen_bath
  kitchen: 'kitchen_bath', sanitary_ware: 'kitchen_bath', bath: 'kitchen_bath',
  // → doors_windows
  system_windows: 'doors_windows', entry_doors: 'doors_windows', interior_doors: 'doors_windows', garage_doors: 'doors_windows',
  // → curtains
  curtains: 'curtains',
  // → decor
  new_indoor_decorative: 'decor', outdoor_deco: 'decor', indoor_deco: 'decor',
  // → hardware
  smart_home: 'hardware', hardware: 'hardware', hardware_items: 'hardware',
  // → paint
  paint: 'paint', paint_coatings: 'paint',
  // → stairs / plants (new children)
  stairs: 'stairs', plants: 'plants',
  // 伞形/父级令牌兜底(供应商可能选到旧的大类伞标签)——软装伞→furniture(软装最主子类),避免整条被丢
  soft_furnishing: 'furniture',
};

// Canonical product_categories CHILD values (parent_value != null). Any tag that is already one of
// these is PRESERVED as-is (self-map) even if not in the explicit MAP — keeps the migration
// idempotent and never drops a value that is already valid in the current taxonomy.
// (Mirror of the autoMigrate seed: building_materials/soft_furnishing children.)
const CANONICAL = new Set([
  'new_materials', 'tiles', 'stone', 'boards', 'paint', 'art_paint', 'doors_windows',
  'kitchen_bath', 'hardware', 'flooring', 'stairs', 'plants',
  'furniture', 'lighting', 'curtains', 'decor',
]);

// old tag → canonical child value, or null to DROP.
function mapTag(t) {
  if (MAP[t]) return MAP[t];
  if (CANONICAL.has(t)) return t;
  return null;
}

// parse a stored categories value: JSON array string, real array, or comma-separated string.
function parseTags(v) {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (v == null) return [];
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      if (Array.isArray(a)) return a.map(String).map(x => x.trim()).filter(Boolean);
    } catch { /* fall through to comma-split */ }
  }
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

// Snapshot the RAW original for reversible rollback. mysql2 auto-parses JSON columns into JS
// arrays/objects, so String() on them would yield comma-joined garbage that a JSON column rejects
// on restore — JSON.stringify keeps it valid-JSON text; plain strings (VARCHAR) pass through.
function rawSnapshot(v) {
  if (v == null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function mapTags(tags) {
  const out = [];
  for (const t of tags) {
    const mapped = mapTag(t);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

(async () => {
  const conn = await mysql.createConnection(cfg);
  console.log(`DB=${cfg.host}/${cfg.database}  DRY_RUN=${DRY_RUN ? 'yes' : 'no'}`);

  // 1. Seed the two missing children (idempotent). Safe even if autoMigrate already added them.
  if (!DRY_RUN) {
    await conn.execute(`
      INSERT IGNORE INTO product_categories (value, label, label_zh, parent_value, sort_order) VALUES
        ('stairs','Stairs & Handrails','楼梯','building_materials',11),
        ('plants','Plants & Landscaping','植物景观','building_materials',12)
    `);
    console.log('Seeded stairs/plants into product_categories (INSERT IGNORE).');
  }

  // 2. Snapshot table (reversible). Store the RAW original value verbatim.
  if (!DRY_RUN) {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS supplier_categories_migration_backup (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity ENUM('supplier','product') NOT NULL,
        entity_id INT NOT NULL,
        old_value TEXT NULL,
        migrated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_entity (entity, entity_id)
      ) CHARACTER SET utf8mb4
    `);
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────────────────────
  const [supRows] = await conn.execute('SELECT id, categories FROM supplier_profiles');
  let supChanged = 0, supDroppedTags = 0;
  const supSamples = [];
  const droppedSet = new Set(); // 去重的被丢弃令牌集——让运营在 DRY_RUN 时能一眼看出有没有误丢
  for (const row of supRows) {
    const before = parseTags(row.categories);
    const after = mapTags(before);
    before.filter(t => mapTag(t) == null).forEach(t => droppedSet.add(t));
    supDroppedTags += before.filter(t => mapTag(t) == null).length;
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    if (supSamples.length < 8 && beforeJson !== afterJson) {
      supSamples.push({ id: row.id, before, after });
    }
    if (beforeJson === afterJson) continue; // already canonical — skip
    supChanged++;
    if (!DRY_RUN) {
      // snapshot raw original (INSERT IGNORE so a re-run never overwrites the FIRST snapshot)
      await conn.execute(
        `INSERT IGNORE INTO supplier_categories_migration_backup (entity, entity_id, old_value) VALUES ('supplier', ?, ?)`,
        [row.id, rawSnapshot(row.categories)],
      );
      await conn.execute('UPDATE supplier_profiles SET categories = ? WHERE id = ?', [afterJson, row.id]);
    }
  }

  // ── Products ───────────────────────────────────────────────────────────────────────────────
  const [prodRows] = await conn.execute('SELECT id, category FROM supplier_products');
  let prodChanged = 0, prodDropped = 0;
  const prodSamples = [];
  for (const row of prodRows) {
    const raw = row.category == null ? null : String(row.category).trim();
    const before = raw || null;
    const mapped = raw ? mapTag(raw) : null; // single value; unmapped → NULL
    if (raw && mapTag(raw) == null) { prodDropped++; droppedSet.add(raw); }
    if (prodSamples.length < 8 && before !== mapped) prodSamples.push({ id: row.id, before, after: mapped });
    if (before === mapped) continue;
    prodChanged++;
    if (!DRY_RUN) {
      await conn.execute(
        `INSERT IGNORE INTO supplier_categories_migration_backup (entity, entity_id, old_value) VALUES ('product', ?, ?)`,
        [row.id, rawSnapshot(row.category)],
      );
      await conn.execute('UPDATE supplier_products SET category = ? WHERE id = ?', [mapped, row.id]);
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────────────────────
  console.log('\n── suppliers (supplier_profiles.categories) ──');
  console.log(`  scanned=${supRows.length}  changed=${supChanged}  unmapped_tags_dropped=${supDroppedTags}`);
  for (const s of supSamples) console.log(`  #${s.id}: ${JSON.stringify(s.before)} → ${JSON.stringify(s.after)}`);

  console.log('\n── products (supplier_products.category) ──');
  console.log(`  scanned=${prodRows.length}  changed=${prodChanged}  unmapped_dropped_to_null=${prodDropped}`);
  for (const s of prodSamples) console.log(`  #${s.id}: ${JSON.stringify(s.before)} → ${JSON.stringify(s.after)}`);

  // 去重的被丢弃令牌 —— 运营在 DRY_RUN 时务必核对,若出现本应保留的值(如某个新子类)先补进 MAP 再跑
  console.log('\n── DROPPED distinct tokens (核对有无误丢!) ──');
  console.log('  ' + (droppedSet.size ? [...droppedSet].sort().join(', ') : '(无)'));

  console.log(`\n${DRY_RUN ? 'DRY RUN — no writes performed.' : 'DONE — writes committed. Snapshot in supplier_categories_migration_backup.'}`);
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
