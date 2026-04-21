#!/usr/bin/env node
/**
 * Migrate brands.ts data → supplier_users + supplier_profiles + supplier_products
 * Run: node scripts/harness/migrate-brands-to-suppliers.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

const BRANDS = [
  {
    slug: 'huasheng-home',
    name: '华盛家居',
    nameEn: 'Huasheng Home',
    tagline: 'Premium furniture & home solutions',
    intro: 'Huasheng Home specializes in high-end furniture and whole-house customization, providing one-stop service from design to delivery for UAE residential and commercial spaces.',
    logo: '/images/华盛家居logo.png',
    categories: ['furniture'],
    works: [
      { title: 'Living room set', description: 'Modern sofa & coffee table', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80' },
      { title: 'Bedroom suite', description: 'Master bedroom design', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80' },
      { title: 'Dining collection', description: 'Dining table & chairs', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&q=80' },
      { title: 'Office furniture', description: 'Commercial fit-out', image: 'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&q=80' },
      { title: 'Custom cabinetry', description: 'Bespoke storage solutions', image: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&q=80' },
    ],
  },
  {
    slug: 'chunlei-plants',
    name: '春蕾绿植',
    nameEn: 'Chunlei Plants',
    tagline: 'Indoor & landscape greenery',
    intro: 'Chunlei Plants provides indoor and outdoor plants, landscape design and maintenance services.',
    logo: '/images/春蕾logo.png',
    categories: ['plants'],
    works: [
      { title: 'Lobby greenery', description: 'Hotel entrance landscape', image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80' },
      { title: 'Indoor plant wall', description: 'Vertical garden installation', image: 'https://images.unsplash.com/photo-1598902108854-10e335adac99?w=800&q=80' },
      { title: 'Terrace garden', description: 'Residential outdoor', image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=800&q=80' },
      { title: 'Office plants', description: 'Workspace wellness', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
    ],
  },
  {
    slug: 'yifa-doors-windows',
    name: '毅发门窗',
    nameEn: 'Yifa Doors & Windows',
    tagline: 'Aluminum & glass solutions',
    intro: 'Yifa Doors & Windows manufactures and installs premium aluminum doors, windows, and glass curtain walls.',
    logo: '/images/毅发门窗logo.png',
    categories: ['hardware'],
    works: [
      { title: 'Villa entrance', description: 'Custom aluminum doors', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
      { title: 'Office glazing', description: 'Floor-to-ceiling glass', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80' },
    ],
  },
  {
    slug: 'suofeiya-furniture',
    name: '索菲亚家居',
    nameEn: 'Suofeiya Home',
    tagline: 'Whole-house custom furniture',
    intro: 'Suofeiya Home offers whole-house customized furniture solutions including wardrobes, cabinets, and storage systems.',
    logo: '/images/索菲亚logo.png',
    categories: ['furniture', 'kitchen'],
    works: [
      { title: 'Walk-in closet', description: 'Custom wardrobe system', image: 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=800&q=80' },
      { title: 'Kitchen cabinet', description: 'Integrated kitchen design', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80' },
    ],
  },
  {
    slug: 'mingxuan-materials',
    name: '铭煊建材',
    nameEn: 'Mingxuan Materials',
    tagline: 'Building materials & finishes',
    intro: 'Mingxuan Materials provides a wide range of building materials including tiles, stone, and finishing products.',
    logo: '/images/铭煊建材logo.png',
    categories: ['stone', 'flooring'],
    works: [
      { title: 'Marble flooring', description: 'Villa marble installation', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80' },
      { title: 'Tile work', description: 'Bathroom tile design', image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80' },
    ],
  },
];

async function migrate() {
  const dummyPassword = await bcrypt.hash('supplier_2026', 10);

  for (const brand of BRANDS) {
    const email = `${brand.slug}@supplier.tarmeer.local`;
    console.log(`\nMigrating: ${brand.nameEn} (${email})`);

    // Check if already exists
    const [existing] = await pool.execute('SELECT id FROM supplier_users WHERE email = ?', [email]);
    if ((existing).length > 0) {
      console.log('  Already exists, skipping.');
      continue;
    }

    // Create supplier_user
    const [userResult] = await pool.execute(
      `INSERT INTO supplier_users (email, password, full_name, email_verified) VALUES (?, ?, ?, 1)`,
      [email, dummyPassword, brand.nameEn]
    );
    const userId = userResult.insertId;
    console.log(`  Created supplier_user id=${userId}`);

    // Create supplier_profile
    const [profileResult] = await pool.execute(
      `INSERT INTO supplier_profiles
        (supplier_user_id, company_name, slug, description, logo_url, origin, categories, status)
       VALUES (?, ?, ?, ?, ?, 'china', ?, 'approved')`,
      [userId, brand.nameEn, brand.slug, `${brand.tagline}. ${brand.intro}`, brand.logo, JSON.stringify(brand.categories)]
    );
    const profileId = profileResult.insertId;
    console.log(`  Created supplier_profile id=${profileId}, slug=${brand.slug}`);

    // Create supplier_products
    for (let i = 0; i < brand.works.length; i++) {
      const w = brand.works[i];
      await pool.execute(
        `INSERT INTO supplier_products (supplier_profile_id, title, description, image_url, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [profileId, w.title, w.description || null, w.image, i]
      );
    }
    console.log(`  Created ${brand.works.length} products`);
  }

  console.log('\nMigration complete.');
  await pool.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
