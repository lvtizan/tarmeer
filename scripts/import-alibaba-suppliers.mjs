/**
 * Import scraped Alibaba suppliers into Tarmeer DB.
 * Usage:
 *   # Local (uses server/.env):
 *   node scripts/import-alibaba-suppliers.mjs
 *
 *   # Production (set env vars first):
 *   DB_HOST=rm-xxx.mysql.dubai.rds.aliyuncs.com \
 *   DB_USER=tarmeer DB_PASSWORD=xxx DB_NAME=tarmeer \
 *   node scripts/import-alibaba-suppliers.mjs
 *
 * Input:  scripts/alibaba-suppliers.json
 * Output: prints inserted IDs + public URLs
 */

// Use server's node_modules so we can access mysql2 + bcryptjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('../server/node_modules/mysql2/promise');
const bcrypt = require('../server/node_modules/bcryptjs');
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env (server/.env) unless env vars already set ──────────────────────
if (!process.env.DB_HOST) {
  try {
    const envPath = path.join(__dirname, '../server/.env');
    const envText = readFileSync(envPath, 'utf8');
    for (const line of envText.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
    console.log('Loaded DB config from server/.env');
  } catch (_) {
    console.warn('Could not load server/.env — using env vars');
  }
}

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306', 10),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tarmeer',
  charset:  'utf8mb4',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function uniqueSlug(conn, base) {
  let slug = base;
  let i = 2;
  while (true) {
    const [rows] = await conn.execute('SELECT id FROM supplier_profiles WHERE slug = ? LIMIT 1', [slug]);
    if ((rows).length === 0) return slug;
    slug = `${base}-${i++}`;
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const suppliersPath = path.join(__dirname, 'alibaba-suppliers.json');
  const suppliers = JSON.parse(readFileSync(suppliersPath, 'utf8'));

  if (suppliers.length === 0) {
    console.error('No suppliers in alibaba-suppliers.json. Run the scraper first.');
    process.exit(1);
  }

  console.log(`Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}…`);
  const conn = await mysql.createConnection(DB_CONFIG);

  const results = [];

  for (const s of suppliers) {
    if (s.error) {
      console.warn(`Skipping ${s.url} (has error: ${s.error})`);
      continue;
    }

    const name = s.name ?? 'Unknown Supplier';
    const baseSlug = slugify(name);
    const slug = await uniqueSlug(conn, baseSlug);
    const email = `${slug}@alibaba-import.internal`;

    console.log(`\nImporting: ${name} → slug: ${slug}`);

    try {
      // 1. Create supplier_user (dummy account, email not verified, no login intended)
      const hashedPassword = await bcrypt.hash(Math.random().toString(36) + Math.random().toString(36), 10);
      const [userResult] = await conn.execute(
        `INSERT INTO supplier_users (email, password, full_name, email_verified, created_at)
         VALUES (?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [email, hashedPassword, name]
      );
      const supplierUserId = (userResult).insertId || (
        await conn.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email])
      ).then(([r]) => r[0]?.id);

      // 2. Create supplier_profile
      const coverImage = s.bannerImages?.[0] ?? s.profileImages?.[0] ?? null;
      const categories = JSON.stringify(s.mainCategories ?? []);

      const [profileResult] = await conn.execute(
        `INSERT INTO supplier_profiles
           (supplier_user_id, company_name, slug, description, logo_url, cover_image_url,
            origin, categories, website, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'china', ?, ?, 'approved', NOW())`,
        [
          supplierUserId,
          name,
          slug,
          s.profile ?? s.mainCategories?.join(', ') ?? null,
          s.logo ?? null,
          coverImage,
          categories,
          s.url ?? null,
        ]
      );
      const profileId = (profileResult).insertId;
      console.log(`  ✓ Profile created: id=${profileId}`);

      // 3. Insert products (up to 12, skip entries with no name AND no image)
      const validProducts = (s.products ?? [])
        .filter(p => p.name && p.image)
        .slice(0, 12);

      for (const [i, p] of validProducts.entries()) {
        const desc = [
          p.price ? `Price: ${p.price}` : null,
          p.minOrder ? `MOQ: ${p.minOrder}` : null,
        ].filter(Boolean).join(' | ') || null;

        await conn.execute(
          `INSERT INTO supplier_products (supplier_profile_id, title, description, image_url, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [profileId, p.name.slice(0, 254), desc, p.image, i]
        );
      }
      console.log(`  ✓ Products inserted: ${validProducts.length}`);

      // 4. Insert banner images as projects (if no real projects scraped)
      const projectImages = s.bannerImages?.slice(1) ?? [];  // skip cover (already used)
      if (projectImages.length > 0) {
        for (const [i, imgUrl] of projectImages.entries()) {
          await conn.execute(
            `INSERT INTO supplier_projects (supplier_profile_id, title, images, sort_order)
             VALUES (?, ?, ?, ?)`,
            [profileId, `Gallery ${i + 1}`, JSON.stringify([imgUrl]), i]
          );
        }
        console.log(`  ✓ Gallery projects inserted: ${projectImages.length}`);
      }

      results.push({
        name,
        slug,
        profileId,
        supplierUserId,
        publicUrl: `https://www.tarmeer.com/materials/suppliers/${slug}`,
        products: validProducts.length,
      });
    } catch (err) {
      console.error(`  ✗ Failed to import ${name}:`, err.message);
    }
  }

  await conn.end();

  console.log('\n══════════════════════════════════════════');
  console.log('Import complete!');
  console.table(results.map(r => ({
    Name: r.name.slice(0, 35),
    Slug: r.slug,
    Products: r.products,
    URL: r.publicUrl,
  })));
  console.log('\nPublic URLs:');
  results.forEach(r => console.log(`  ${r.publicUrl}`));
}

main().catch(e => { console.error(e); process.exit(1); });
