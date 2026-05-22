// scripts/force-retag-all.mjs
// Usage: node scripts/force-retag-all.mjs [--apply] [--limit=N] [--start-id=N]
// Default: dry-run. Add --apply to actually write to DB.
// --limit=N    cap on number of projects to process (default: no limit)
// --start-id=N skip projects with id <= N (for resuming interrupted runs)
// Requires: cd server && npx tsc first (to compile tag engine)

// dotenv lives in server/node_modules (not root), load it from there
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const require = createRequire(import.meta.url);
const { config: dotenvConfig } = require(path.join(projectRoot, 'server/node_modules/dotenv/lib/main.js'));
dotenvConfig({ path: path.join(projectRoot, 'server/.env') });

const tagEngineModule = await import(path.join(projectRoot, 'server/dist/services/tagEngine/index.js'));
const tagProjectImages = tagEngineModule.tagProjectImages ?? tagEngineModule.default?.tagProjectImages;

// Fix #3: guard against missing compiled output
if (typeof tagProjectImages !== 'function') {
  console.error('tagProjectImages not found — run: cd server && npx tsc --skipLibCheck');
  process.exit(1);
}

const dbModule = await import(path.join(projectRoot, 'server/dist/config/database.js'));
// CJS module exported as exports.default = pool; ESM interop wraps it one level deep
const pool = dbModule.default?.default ?? dbModule.default;

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const startIdArg = process.argv.find(a => a.startsWith('--start-id='));

const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const START_ID = startIdArg ? parseInt(startIdArg.split('=')[1], 10) : 0;

// Fix #4: NaN check for CLI args
if (limitArg && isNaN(LIMIT)) { console.error('--limit must be a number'); process.exit(1); }
if (startIdArg && isNaN(START_ID)) { console.error('--start-id must be a number'); process.exit(1); }

// Fix #2: try/catch around initial DB query
let rows;
try {
  const [result] = await pool.query(
    `SELECT id, title FROM projects
     WHERE deleted_at IS NULL
       AND images IS NOT NULL AND images != '[]'
       AND id > ${START_ID}
     ORDER BY id ASC
     ${LIMIT !== null ? `LIMIT ${LIMIT}` : ''}`
  );
  rows = result;
} catch (err) {
  console.error('DB query failed:', err.message);
  await pool.end();
  process.exit(1);
}

console.log(`待重打标项目: ${rows.length} 个 (limit=${LIMIT ?? 'none'}, start-id>${START_ID})`);

if (!apply) {
  console.log('Dry run — add --apply to write to DB');
  console.log('First 5:', rows.slice(0, 5).map(r => `#${r.id} ${r.title}`).join(', '));
  await pool.end();
  process.exit(0);
}

const total = rows.length;
let done = 0;

// Fix #1: try/catch around tagProjectImages, pool.end() in finally
try {
  for (const row of rows) {
    done++;
    process.stdout.write(`[${done}/${total}] #${row.id} ${row.title} ... `);
    try {
      await tagProjectImages(row.id, true);
      console.log('done');
    } catch (err) {
      // Fix #5: print last successful ID so user can resume
      console.error(`FAILED — ${err.message}`);
      console.error(`Resume with --start-id=${row.id - 1}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`All done. ${total} projects retagged.`);
} finally {
  await pool.end();
}
