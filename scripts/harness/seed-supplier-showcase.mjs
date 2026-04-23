#!/usr/bin/env node
/**
 * Supplier showcase seed (15 suppliers, 2 projects each, 6 materials per project).
 *
 * Usage:
 *   node scripts/harness/seed-supplier-showcase.mjs
 *   node scripts/harness/seed-supplier-showcase.mjs --reset
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
  connectionLimit: 10,
});

const RESET = process.argv.includes('--reset');
const SEED_DOMAIN = '@supplier.seed.local';
const DEFAULT_PASSWORD = 'supplier_seed_2026';

const COMPANY_TYPES = {
  design_studio: 'Design Studio',
  renovation_company: 'Renovation & Fit-out',
  general_contractor: 'General Contractor',
  mep_contractor: 'MEP Contractor',
  maintenance_company: 'Maintenance Company',
  specialty_trade: 'Specialty Trade',
  landscaping: 'Landscaping & Pools',
  furnishing: 'Furnishing',
};

const CATEGORY_POOL = {
  furniture: [
    ['Modular Sofa Set', 'CasaLinea', 'Urban Cloud', '3200x950', 'Sand Beige', 'Living Room', 'AED 8k-12k'],
    ['Walnut Coffee Table', 'NordicForm', 'W-01', '1200x700', 'Walnut', 'Living Room', 'AED 1.8k-3k'],
    ['Dining Chair Set', 'StudioOak', 'Dine-6', '6-seat set', 'Oatmeal', 'Dining', 'AED 2.5k-4k'],
  ],
  stone: [
    ['Calacatta Marble Slab', 'StoneCraft', 'Calacatta Gold', '20mm', 'White/Gold', 'Feature Wall', 'AED 550-850/m2'],
    ['Travertine Tile', 'AsterStone', 'T-Prime', '600x1200', 'Cream', 'Flooring', 'AED 220-380/m2'],
    ['Quartz Countertop', 'QZ Home', 'Q-Polar', '30mm', 'Snow White', 'Kitchen', 'AED 900-1300/lfm'],
  ],
  lighting: [
    ['Magnetic Track Light', 'GlowLine', 'M-Track', '12W', 'Matte Black', 'Ceiling', 'AED 220-360/unit'],
    ['Linear Pendant', 'LumaWorks', 'Line-120', '1200mm', 'Champagne', 'Dining', 'AED 480-780/unit'],
    ['Wall Washer', 'ArcLight', 'WW-24', '24W', 'Warm 3000K', 'Feature Wall', 'AED 180-300/unit'],
  ],
  plants: [
    ['Ficus Lyrata Set', 'OasisGrow', 'Ficus Pack', '1.6m height', 'Natural Green', 'Living Room', 'AED 600-1100/set'],
    ['Zamia Planter Kit', 'PalmLeaf', 'ZK-3', '3 pots', 'Olive Green', 'Indoor Corners', 'AED 350-650/set'],
    ['Vertical Green Panel', 'GreenScape', 'VG-02', '1m x 2m', 'Mixed Green', 'Entrance Wall', 'AED 900-1500/panel'],
  ],
  flooring: [
    ['SPC Floor Board', 'FloorPro', 'SPC-Luxe', '5.5mm', 'Natural Oak', 'Bedroom', 'AED 120-220/m2'],
    ['Engineered Wood', 'TimberNest', 'EN-Classic', '14mm', 'Smoked Oak', 'Living Room', 'AED 260-420/m2'],
    ['Porcelain Floor Tile', 'Ceramix', 'P-Urban', '800x800', 'Concrete Grey', 'Hallway', 'AED 90-160/m2'],
  ],
  kitchen: [
    ['Sintered Stone Top', 'KraftTop', 'ST-Prime', '12mm', 'Ivory', 'Kitchen Counter', 'AED 700-1100/lfm'],
    ['Soft-close Hinge Kit', 'HettPro', 'HC-Soft', 'Set of 12', 'Nickel', 'Cabinet Doors', 'AED 180-320/set'],
    ['Undermount Sink', 'AquaForge', 'UF-760', '760mm', 'Gunmetal', 'Kitchen', 'AED 450-760/unit'],
  ],
  curtains: [
    ['Blackout Curtain', 'DrapeLab', 'BLK-90', 'Custom size', 'Linen Grey', 'Bedroom', 'AED 160-280/m'],
    ['Sheer Curtain', 'SoftDrape', 'SH-Flow', 'Custom size', 'Warm White', 'Living Room', 'AED 90-170/m'],
    ['Motorized Track', 'CurtainTech', 'MT-2.0', 'Per meter', 'White', 'All Rooms', 'AED 240-420/m'],
  ],
  paint: [
    ['Low-VOC Emulsion', 'ColorWise', 'Eco Silk', '18L', 'Off White', 'Walls', 'AED 280-450/bucket'],
    ['Decorative Texture Coat', 'ArtePlaster', 'AT-Cloud', '20kg', 'Stone Beige', 'Accent Wall', 'AED 320-520/bucket'],
    ['Moisture Guard Primer', 'PrimeSeal', 'MGP', '18L', 'Transparent', 'Wet Areas', 'AED 180-320/bucket'],
  ],
  hardware: [
    ['Smart Door Lock', 'SecureHome', 'SL-X7', 'Mortise', 'Matte Black', 'Main Door', 'AED 900-1600/unit'],
    ['Cabinet Pull Set', 'MetalMode', 'MP-12', '12 pcs', 'Brushed Brass', 'Cabinetry', 'AED 220-420/set'],
    ['Sliding Door Rail', 'RailPro', 'SR-80', '2m set', 'Satin Silver', 'Partitions', 'AED 260-480/set'],
  ],
  other: [
    ['Acoustic Panel', 'QuietSpace', 'QP-Wood', '600x2400', 'Walnut', 'Media Wall', 'AED 240-420/panel'],
    ['Decor Mirror Set', 'Reflecto', 'RM-Set', '3 pcs', 'Bronze Tint', 'Feature Wall', 'AED 380-680/set'],
    ['Wall Art Frame', 'ArtHive', 'AH-Canvas', '1200x800', 'Abstract', 'Living Room', 'AED 450-900/piece'],
  ],
};

const IMG = {
  heroA: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1400&q=80',
  heroB: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1400&q=80',
  heroC: 'https://images.unsplash.com/photo-1616594039964-3f5df2be0f0b?w=1400&q=80',
  heroD: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400&q=80',
  heroE: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1400&q=80',
  matA: 'https://picsum.photos/seed/mat-interior-a/1000/750',
  matB: 'https://picsum.photos/seed/mat-interior-b/1000/750',
  matC: 'https://picsum.photos/seed/mat-interior-c/1000/750',
  matD: 'https://picsum.photos/seed/mat-interior-d/1000/750',
  matE: 'https://picsum.photos/seed/mat-interior-e/1000/750',
  matF: 'https://picsum.photos/seed/mat-interior-f/1000/750',
};

const SUPPLIERS = [
  { slug: 'jadeform-studio', name: 'JadeForm Studio', origin: 'china', type: 'design_studio', categories: ['furniture', 'lighting', 'curtains'] },
  { slug: 'atelier-dune', name: 'Atelier Dune', origin: 'dubai', type: 'design_studio', categories: ['stone', 'lighting', 'paint'] },
  { slug: 'harbor-fitout-works', name: 'Harbor Fitout Works', origin: 'dubai', type: 'renovation_company', categories: ['flooring', 'lighting', 'hardware'] },
  { slug: 'eastbridge-fitout', name: 'EastBridge Fitout', origin: 'china', type: 'renovation_company', categories: ['kitchen', 'flooring', 'paint'] },
  { slug: 'skyline-build-co', name: 'Skyline Build Co.', origin: 'dubai', type: 'general_contractor', categories: ['stone', 'hardware', 'other'] },
  { slug: 'greatwall-contracting', name: 'GreatWall Contracting', origin: 'china', type: 'general_contractor', categories: ['paint', 'flooring', 'hardware'] },
  { slug: 'voltflow-mep', name: 'VoltFlow MEP', origin: 'dubai', type: 'mep_contractor', categories: ['lighting', 'hardware', 'other'] },
  { slug: 'dragon-mep-systems', name: 'Dragon MEP Systems', origin: 'china', type: 'mep_contractor', categories: ['lighting', 'kitchen', 'hardware'] },
  { slug: 'carenest-services', name: 'CareNest Services', origin: 'dubai', type: 'maintenance_company', categories: ['paint', 'hardware', 'kitchen'] },
  { slug: 'primefix-facility', name: 'PrimeFix Facility', origin: 'dubai', type: 'maintenance_company', categories: ['flooring', 'paint', 'lighting'] },
  { slug: 'stonecraft-pro', name: 'StoneCraft Pro', origin: 'china', type: 'specialty_trade', categories: ['stone', 'kitchen', 'other'] },
  { slug: 'glowline-lighting', name: 'GlowLine Lighting', origin: 'china', type: 'specialty_trade', categories: ['lighting', 'hardware', 'other'] },
  { slug: 'oasisscape', name: 'OasisScape', origin: 'dubai', type: 'landscaping', categories: ['plants', 'lighting', 'stone'] },
  { slug: 'palmgreen-outdoors', name: 'PalmGreen Outdoors', origin: 'dubai', type: 'landscaping', categories: ['plants', 'flooring', 'other'] },
  { slug: 'urbanfurni-house', name: 'UrbanFurni House', origin: 'china', type: 'furnishing', categories: ['furniture', 'curtains', 'other'] },
];

const PROJECT_TEMPLATES = [
  { title: 'Modern Apartment Living Upgrade', location: 'Dubai Marina', year: '2026', hero: IMG.heroA, gallery: [IMG.heroA, IMG.heroB, IMG.heroC] },
  { title: 'Villa Suite Premium Refresh', location: 'Palm Jumeirah', year: '2026', hero: IMG.heroD, gallery: [IMG.heroD, IMG.heroE, IMG.heroB] },
  { title: 'Family Home Material Harmonization', location: 'Jumeirah Village Circle', year: '2025', hero: IMG.heroC, gallery: [IMG.heroC, IMG.heroA, IMG.heroE] },
  { title: 'Boutique Office Fit-out Enhancement', location: 'Business Bay', year: '2025', hero: IMG.heroB, gallery: [IMG.heroB, IMG.heroD, IMG.heroA] },
];

function uniqueByKey(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMaterials(categoryKeys, seedIndex) {
  const picked = [];
  for (const c of categoryKeys) {
    const items = CATEGORY_POOL[c] || CATEGORY_POOL.other;
    picked.push(items[seedIndex % items.length], items[(seedIndex + 1) % items.length]);
  }
  return picked.slice(0, 6).map((m, idx) => ({
    title: m[0],
    brand: m[1],
    series: m[2],
    spec: m[3],
    color: m[4],
    usage: m[5],
    priceBand: m[6],
    category: categoryKeys[idx % categoryKeys.length] || 'other',
    image: [IMG.matA, IMG.matB, IMG.matC, IMG.matD, IMG.matE, IMG.matF][idx % 6],
  }));
}

function buildProjects(supplier, seedIndex) {
  const t1 = PROJECT_TEMPLATES[seedIndex % PROJECT_TEMPLATES.length];
  const t2 = PROJECT_TEMPLATES[(seedIndex + 1) % PROJECT_TEMPLATES.length];
  const m1 = buildMaterials(supplier.categories, seedIndex);
  const m2 = buildMaterials([...supplier.categories].reverse(), seedIndex + 2);
  return [
    { ...t1, title: `${supplier.name} - ${t1.title}`, materials: m1 },
    { ...t2, title: `${supplier.name} - ${t2.title}`, materials: m2 },
  ];
}

async function ensureShowcaseTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS supplier_projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_profile_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      location VARCHAR(255),
      year VARCHAR(20),
      images JSON,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supplier (supplier_profile_id)
    )
  `);

  const [categoryCol] = await pool.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'supplier_products' AND column_name = 'category'
     LIMIT 1`
  );
  if (!Array.isArray(categoryCol) || categoryCol.length === 0) {
    await pool.execute(`ALTER TABLE supplier_products ADD COLUMN category VARCHAR(100) NULL AFTER description`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS supplier_project_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplier_project_id INT NOT NULL,
      supplier_product_id INT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_project (supplier_project_id),
      INDEX idx_product (supplier_product_id)
    )
  `);
}

async function cleanSeedData() {
  const slugs = SUPPLIERS.map((s) => s.slug);
  const placeholders = slugs.map(() => '?').join(',');

  const [profiles] = await pool.execute(
    `SELECT id, supplier_user_id FROM supplier_profiles WHERE slug IN (${placeholders})`,
    slugs
  );
  const profileIds = (profiles || []).map((p) => p.id);
  const userIds = (profiles || []).map((p) => p.supplier_user_id);

  if (profileIds.length > 0) {
    const pMarks = profileIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM supplier_project_materials WHERE supplier_project_id IN (SELECT id FROM supplier_projects WHERE supplier_profile_id IN (${pMarks}))`, profileIds);
    await pool.execute(`DELETE FROM supplier_projects WHERE supplier_profile_id IN (${pMarks})`, profileIds);
    await pool.execute(`DELETE FROM supplier_products WHERE supplier_profile_id IN (${pMarks})`, profileIds);
    await pool.execute(`DELETE FROM supplier_catalogs WHERE supplier_profile_id IN (${pMarks})`, profileIds);
    await pool.execute(`DELETE FROM supplier_profiles WHERE id IN (${pMarks})`, profileIds);
  }

  if (userIds.length > 0) {
    const uMarks = userIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM supplier_users WHERE id IN (${uMarks})`, userIds);
  }

  await pool.execute(`DELETE FROM supplier_users WHERE email LIKE ?`, [`%${SEED_DOMAIN}`]);
}

async function upsertSupplier(base, index, passwordHash) {
  const email = `${base.slug}${SEED_DOMAIN}`;
  const fullName = `${base.name} Team`;
  const phone = base.origin === 'china' ? '+86 13900001234' : '+971 50 123 4567';
  const maps = base.origin === 'china'
    ? 'https://maps.google.com/?q=Yiwu+International+Trade+City'
    : 'https://maps.google.com/?q=Business+Bay+Dubai';
  const website = `https://www.${base.slug.replace(/[^a-z0-9-]/g, '')}.example.com`;

  let userId = null;
  const [users] = await pool.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
  if (Array.isArray(users) && users.length > 0) {
    userId = users[0].id;
    await pool.execute(
      'UPDATE supplier_users SET full_name = ?, phone = ?, password = ?, email_verified = 1 WHERE id = ?',
      [fullName, phone, passwordHash, userId]
    );
  } else {
    const [u] = await pool.execute(
      `INSERT INTO supplier_users (email, password, full_name, phone, email_verified)
       VALUES (?, ?, ?, ?, 1)`,
      [email, passwordHash, fullName, phone]
    );
    userId = u.insertId;
  }

  const profileDesc = [
    `${base.name} is a showcase supplier profile generated for materials discovery UX.`,
    `Company Type: ${COMPANY_TYPES[base.type]}.`,
    'Focus: project-driven materials with clear specs, use-cases, and visual references.',
  ].join(' ');

  let profileId = null;
  const [profiles] = await pool.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [userId]);
  if (Array.isArray(profiles) && profiles.length > 0) {
    profileId = profiles[0].id;
    await pool.execute(
      `UPDATE supplier_profiles
         SET company_name = ?, slug = ?, description = ?, logo_url = ?, cover_image_url = ?,
             origin = ?, categories = ?, has_physical_store = 1, store_address = ?,
             google_maps_url = ?, contact_phone = ?, whatsapp = ?, website = ?, status = 'approved'
       WHERE id = ?`,
      [
        base.name, base.slug, profileDesc, PROJECT_TEMPLATES[index % 4].hero, PROJECT_TEMPLATES[(index + 1) % 4].hero,
        base.origin, JSON.stringify(base.categories),
        base.origin === 'china' ? 'Yiwu, Zhejiang, China' : 'Business Bay, Dubai, UAE',
        maps, phone, phone, website, profileId,
      ]
    );
  } else {
    const [p] = await pool.execute(
      `INSERT INTO supplier_profiles
        (supplier_user_id, company_name, slug, description, logo_url, cover_image_url, origin, categories,
         has_physical_store, store_address, google_maps_url, contact_phone, whatsapp, website, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'approved')`,
      [
        userId, base.name, base.slug, profileDesc, PROJECT_TEMPLATES[index % 4].hero, PROJECT_TEMPLATES[(index + 1) % 4].hero,
        base.origin, JSON.stringify(base.categories),
        base.origin === 'china' ? 'Yiwu, Zhejiang, China' : 'Business Bay, Dubai, UAE',
        maps, phone, phone, website,
      ]
    );
    profileId = p.insertId;
  }

  await pool.execute('DELETE FROM supplier_project_materials WHERE supplier_project_id IN (SELECT id FROM supplier_projects WHERE supplier_profile_id = ?)', [profileId]);
  await pool.execute('DELETE FROM supplier_projects WHERE supplier_profile_id = ?', [profileId]);
  await pool.execute('DELETE FROM supplier_products WHERE supplier_profile_id = ?', [profileId]);
  await pool.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id = ?', [profileId]);

  const projects = buildProjects(base, index);
  let productCount = 0;
  let projectCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    const materialsText = proj.materials
      .map((m) => `${m.title} (${m.brand}, ${m.spec}, ${m.priceBand})`)
      .join('; ');

    const [projectInsert] = await pool.execute(
      `INSERT INTO supplier_projects
         (supplier_profile_id, title, description, location, year, images, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        proj.title,
        `Design-led case with curated materials. Materials used: ${materialsText}`,
        proj.location,
        proj.year,
        JSON.stringify(proj.gallery),
        i,
      ]
    );
    projectCount += 1;
    const projectId = projectInsert.insertId;

    const productIds = [];
    for (let mIndex = 0; mIndex < proj.materials.length; mIndex++) {
      const m = proj.materials[mIndex];
      const [productInsert] = await pool.execute(
        `INSERT INTO supplier_products
          (supplier_profile_id, title, description, image_url, category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          m.title,
          `Brand: ${m.brand} | Series: ${m.series} | Spec: ${m.spec} | Color: ${m.color} | Usage: ${m.usage} | Price: ${m.priceBand}`,
          m.image,
          m.category,
          (i * 10) + mIndex,
        ]
      );
      productIds.push(productInsert.insertId);
      productCount += 1;
    }

    for (let pIndex = 0; pIndex < productIds.length; pIndex++) {
      await pool.execute(
        `INSERT INTO supplier_project_materials (supplier_project_id, supplier_product_id, sort_order)
         VALUES (?, ?, ?)`,
        [projectId, productIds[pIndex], pIndex]
      );
    }
  }

  await pool.execute(
    `INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size)
     VALUES
      (?, ?, ?, ?),
      (?, ?, ?, ?)`,
    [
      profileId, `${base.name} Material Catalog 2026`, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 1_048_576,
      profileId, `${base.name} Project Specification Book`, 'https://www.africau.edu/images/default/sample.pdf', 1_572_864,
    ]
  );

  return { slug: base.slug, email, profileId, projectCount, productCount };
}

async function main() {
  console.log('\n══ Supplier Showcase Seed ══');
  console.log(`DB: ${process.env.DB_NAME || 'tarmeer'} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
  console.log(`Mode: ${RESET ? 'reset + seed' : 'seed (upsert)'}`);

  await ensureShowcaseTables();
  if (RESET) {
    console.log('Cleaning previous showcase seed data...');
    await cleanSeedData();
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const report = [];
  for (let i = 0; i < SUPPLIERS.length; i++) {
    const result = await upsertSupplier(SUPPLIERS[i], i, passwordHash);
    report.push(result);
    console.log(`✔ ${result.slug}: projects=${result.projectCount}, materials=${result.productCount}, email=${result.email}`);
  }

  console.log('\nSeed completed.');
  console.log(`Suppliers: ${report.length}`);
  console.log(`Default password: ${DEFAULT_PASSWORD}`);
  console.log('Test login email example:', report[0]?.email || `example${SEED_DOMAIN}`);
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
