// scripts/backfill-image-tags.mjs
// Usage: node scripts/backfill-image-tags.mjs [--apply] [--limit=N]
// Default: dry-run. Add --apply to actually write to DB.
// Requires: cd server && npx tsc first (to compile tag engine)

// dotenv lives in server/node_modules (not root), load it from there
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { config: dotenvConfig } = require('./server/node_modules/dotenv/lib/main.js');
dotenvConfig({ path: './server/.env' });

const { tagProjectImages } = await import('./server/dist/services/tagEngine/index.js');
const pool = (await import('./server/dist/config/database.js')).default;

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const [rows] = await pool.execute(
  `SELECT id, title FROM projects
   WHERE deleted_at IS NULL
     AND images IS NOT NULL AND images != '[]'
     AND (tags IS NULL OR tags = '[]' OR tags = '')
   LIMIT ?`,
  [LIMIT]
);

console.log(`未打标项目: ${rows.length} 个 (limit=${LIMIT})`);

if (!apply) {
  console.log('Dry run — add --apply to write to DB');
  console.log('First 5:', rows.slice(0, 5).map(r => `#${r.id} ${r.title}`).join(', '));
  await pool.end();
  process.exit(0);
}

for (const row of rows) {
  process.stdout.write(`Tagging #${row.id} ${row.title} ... `);
  await tagProjectImages(row.id, false);
  console.log('done');
  await new Promise(r => setTimeout(r, 300));
}

console.log('All done.');
await pool.end();
