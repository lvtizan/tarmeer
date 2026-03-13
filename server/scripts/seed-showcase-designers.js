#!/usr/bin/env node

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const START_ID = 2001;
const SHOWCASE_EMAIL_DOMAIN = '@showcase.tarmeer.com';
const SHOWCASE_ASSET_BASE = 'https://www.tarmeer.com/images/showcase';

const DESIGNERS = [
  { name: 'Amira Al Mansoori', title: 'Luxury Residential Designer', city: 'Dubai', address: 'Palm Jumeirah', style: 'Modern Luxury', expertise: ['Villa', 'Luxury', 'Residential'] },
  { name: 'Zayd Al Harbi', title: 'Contemporary Villa Specialist', city: 'Abu Dhabi', address: 'Saadiyat Island', style: 'Contemporary', expertise: ['Villa', 'Contemporary', 'Turnkey'] },
  { name: 'Layla Nasser', title: 'Soft Furnishing Curator', city: 'Sharjah', address: 'Aljada', style: 'Soft Minimal', expertise: ['Soft Decoration', 'Styling', 'Residential'] },
  { name: 'Omar Al Suwaidi', title: 'Modern Family Home Designer', city: 'Dubai', address: 'Dubai Hills', style: 'Modern Arabic', expertise: ['Family Homes', 'Residential', 'Planning'] },
  { name: 'Mariam Haddad', title: 'Boutique Hospitality Designer', city: 'Dubai', address: 'Jumeirah', style: 'Boutique Luxury', expertise: ['Hospitality', 'Boutique', 'Commercial'] },
  { name: 'Karim Al Farsi', title: 'Minimalist Apartment Planner', city: 'Dubai', address: 'Business Bay', style: 'Minimalist', expertise: ['Apartment', 'Minimalist', 'Residential'] },
  { name: 'Noor Al Mazrouei', title: 'Coastal Villa Designer', city: 'Ras Al Khaimah', address: 'Al Hamra', style: 'Coastal', expertise: ['Coastal', 'Villa', 'Outdoor'] },
  { name: 'Hassan El Sayed', title: 'Smart Home Interior Expert', city: 'Dubai', address: 'Arabian Ranches', style: 'Smart Contemporary', expertise: ['Smart Home', 'Residential', 'Lighting'] },
  { name: 'Rania Khoury', title: 'High-End Penthouse Designer', city: 'Dubai', address: 'Downtown Dubai', style: 'Luxury Modern', expertise: ['Penthouse', 'Luxury', 'Joinery'] },
  { name: 'Yousef Al Kaabi', title: 'Commercial Space Designer', city: 'Abu Dhabi', address: 'Al Reem Island', style: 'Commercial Contemporary', expertise: ['Commercial', 'Office', 'Retail'] },
  { name: 'Dalia Farouk', title: 'Scandinavian Living Specialist', city: 'Sharjah', address: 'Muwaileh', style: 'Scandinavian', expertise: ['Scandinavian', 'Residential', 'Styling'] },
  { name: 'Tariq Al Nuaimi', title: 'Turnkey Renovation Consultant', city: 'Ajman', address: 'Al Zorah', style: 'Modern Renovation', expertise: ['Renovation', 'Turnkey', 'Residential'] },
  { name: 'Salma Al Hashmi', title: 'Warm Contemporary Designer', city: 'Dubai', address: 'JVC', style: 'Warm Modern', expertise: ['Residential', 'Warm Modern', 'Procurement'] },
  { name: 'Khaled Mansour', title: 'Industrial Loft Designer', city: 'Dubai', address: 'Dubai Design District', style: 'Industrial', expertise: ['Industrial', 'Loft', 'Residential'] },
  { name: 'Nadine Saab', title: 'Elegant Family Villa Stylist', city: 'Dubai', address: 'Mirdif', style: 'Elegant Contemporary', expertise: ['Villa', 'Family Homes', 'Luxury'] },
  { name: 'Ibrahim Al Hammadi', title: 'Modern Majlis Designer', city: 'Abu Dhabi', address: 'Khalifa City', style: 'Modern Arabic', expertise: ['Majlis', 'Residential', 'Cultural'] },
  { name: 'Jana Rizk', title: 'Lifestyle Apartment Designer', city: 'Dubai', address: 'Dubai Marina', style: 'Lifestyle Modern', expertise: ['Apartment', 'Lifestyle', 'Residential'] },
  { name: 'Faisal Al Marri', title: 'Resort-Style Outdoor Designer', city: 'Fujairah', address: 'Al Aqah', style: 'Resort Coastal', expertise: ['Outdoor', 'Resort', 'Landscape'] },
  { name: 'Huda Rahman', title: 'Luxury Joinery Specialist', city: 'Dubai', address: 'Emirates Hills', style: 'Luxury Craft', expertise: ['Luxury', 'Joinery', 'Villa'] },
  { name: 'Adel Mostafa', title: 'Budget Smart Space Planner', city: 'Sharjah', address: 'Al Khan', style: 'Budget Modern', expertise: ['Budget', 'Apartment', 'Planning'] },
  { name: 'Mona Al Dossari', title: 'Classic Contemporary Designer', city: 'Dubai', address: 'Town Square', style: 'Classic Contemporary', expertise: ['Contemporary', 'Residential', 'Villa'] },
  { name: 'Sameer Qureshi', title: 'Workspace Interior Strategist', city: 'Dubai', address: 'DIFC', style: 'Workplace Modern', expertise: ['Office', 'Commercial', 'Branding'] },
  { name: 'Reem Al Falasi', title: 'Calm Neutral Home Designer', city: 'Abu Dhabi', address: 'Yas Island', style: 'Calm Minimal', expertise: ['Minimal', 'Residential', 'Family Homes'] },
  { name: 'Bilal Hamed', title: 'Urban Duplex Specialist', city: 'Dubai', address: 'Creek Harbour', style: 'Urban Modern', expertise: ['Duplex', 'Urban', 'Residential'] },
  { name: 'Yara Soliman', title: 'Soft Decoration Expert', city: 'Sharjah', address: 'Maryam Island', style: 'Soft Decoration', expertise: ['Soft Decoration', 'Accessories', 'Curtains'] },
  { name: 'Majed Al Shamsi', title: 'Signature Villa Designer', city: 'Dubai', address: 'Tilal Al Ghaf', style: 'Signature Luxury', expertise: ['Villa', 'Luxury', 'Signature'] },
];

const PROJECT_NAME_SETS = [
  ['Skyline Residence', 'Garden Villa Retreat', 'Marina Apartment Refresh', 'Desert Pearl Majlis', 'Private Family Lounge', 'Signature Bedroom Suite', 'Open Kitchen Transformation', 'Poolside Sunset Deck'],
  ['Executive Office Lounge', 'Palm View Penthouse', 'Weekend Villa Escape', 'Minimal Family Apartment', 'Courtyard Entrance Upgrade', 'Boutique Reception Design', 'Gallery Hall Styling', 'Modern Dining Pavilion'],
  ['Seaside Living Room', 'Textured Neutral Villa', 'Statement Stair Hall', 'Guest Suite Makeover', 'Art-Led Dining Space', 'Contemporary Kids Room', 'Elegant Master Bath', 'Outdoor Tea Terrace'],
  ['Urban Loft Residence', 'Townhouse Social Hub', 'Luxury Majlis Edit', 'Calm Bedroom Story', 'Villa Media Room', 'Designer Walk-In Closet', 'Panoramic Dining Room', 'Resort Entry Sequence'],
  ['Floating Marble Kitchen', 'Warm Oak Apartment', 'Clubhouse Lobby Upgrade', 'Sky Villa Living Area', 'Soft Linen Bedroom', 'Curated Family Library', 'Coastal Powder Room', 'Show Kitchen Feature'],
];

const PROJECT_LOCATIONS = [
  'Dubai Marina',
  'Palm Jumeirah',
  'Downtown Dubai',
  'Dubai Hills',
  'Arabian Ranches',
  'Saadiyat Island',
  'Jumeirah Golf Estates',
  'Business Bay',
  'JVC',
  'Sharjah Waterfront',
  'Yas Island',
  'Aljada',
  'Creek Harbour',
  'Tilal Al Ghaf',
  'Al Hamra',
];

// 使用本地图片资源（已从无版权图库下载）
// 头像：DiceBear 生成的唯一人物头像
// 项目图：Picsum 高质量随机图片
const SHOWCASE_COVER_URLS = Array.from({ length: 60 }, (_, index) =>
  `${SHOWCASE_ASSET_BASE}/project-${String(index + 1).padStart(2, '0')}.jpg`
);

const SHOWCASE_AVATAR_URLS = Array.from({ length: 26 }, (_, index) =>
  `${SHOWCASE_ASSET_BASE}/avatar-${String(index + 1).padStart(2, '0')}.png`
);

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '');
}

async function buildSeedData() {
  const designers = await Promise.all(DESIGNERS.map(async (designer, index) => {
    const id = START_ID + index;
    const email = `${slugifyName(designer.name)}${SHOWCASE_EMAIL_DOMAIN}`;
    const password = await bcrypt.hash(
      crypto.createHash('sha256').update(`showcase:${email}:${id}`).digest('hex'),
      10
    );
    return {
      id,
      email,
      password,
      full_name: designer.name,
      title: designer.title,
      phone: `+97155${String(100000 + id).slice(-6)}`,
      city: designer.city,
      address: designer.address,
      bio: `${designer.title} based in ${designer.city}, focused on crafted interiors, natural materials, and turnkey delivery for UAE homeowners.`,
      avatar_url: SHOWCASE_AVATAR_URLS[index % SHOWCASE_AVATAR_URLS.length],
      style: designer.style,
      expertise: JSON.stringify(designer.expertise),
      is_approved: 1,
      email_verified: 0,
      display_order: 260 - index,
      status: 'approved',
      created_at_days_ago: 90 - index * 2,
    };
  }));

  const projects = [];
  const stats = [];

  designers.forEach((designer, index) => {
    const projectCount = 6 + (index % 3);
    for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
      const baseName = PROJECT_NAME_SETS[(index + projectIndex) % PROJECT_NAME_SETS.length][projectIndex % 8];
      projects.push({
        designer_id: designer.id,
        title: `${baseName} ${index + 1}`,
        description: `${designer.title} project in ${PROJECT_LOCATIONS[(index + projectIndex) % PROJECT_LOCATIONS.length]} with layered textures, custom detailing, and a polished turnkey finish for modern UAE living.`,
        style: designer.style,
        location: PROJECT_LOCATIONS[(index + projectIndex) % PROJECT_LOCATIONS.length],
        area: `${110 + ((index * 17 + projectIndex * 23) % 420)} sqm`,
        year: String(2022 + ((index + projectIndex) % 4)),
        cost: `AED ${180 + ((index * 37 + projectIndex * 29) % 820)},000`,
        images: JSON.stringify(
          Array.from({ length: 2 + (projectIndex % 2) }, (_, imageIndex) =>
            SHOWCASE_COVER_URLS[(index * 7 + projectIndex * 3 + imageIndex) % SHOWCASE_COVER_URLS.length]
          )
        ),
        tags: JSON.stringify([designer.style, designer.city, projectIndex % 2 === 0 ? 'Residential' : 'Turnkey']),
        status: 'published',
        created_at_days_ago: 80 - index * 2 - projectIndex,
      });
    }

    for (let dayOffset = 2; dayOffset >= 0; dayOffset -= 1) {
      stats.push({
        designer_id: designer.id,
        dayOffset,
        profile_views: 120 + ((index * 19 + dayOffset * 11) % 160),
        project_views: 45 + ((index * 13 + dayOffset * 7) % 90),
        contact_clicks: 6 + ((index + dayOffset) % 9),
        phone_clicks: 3 + ((index * 2 + dayOffset) % 6),
        whatsapp_clicks: 8 + ((index * 3 + dayOffset) % 11),
      });
    }
  });

  return { designers, projects, stats };
}

async function applySeed() {
  const { designers, projects, stats } = await buildSeedData();
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'tarmeer',
    charset: 'utf8mb4',
  });

  try {
    await connection.beginTransaction();

    const showcaseEmails = designers.map((designer) => designer.email);
    const placeholders = showcaseEmails.map(() => '?').join(', ');
    const [existingRows] = await connection.execute(
      `SELECT id FROM designers WHERE email IN (${placeholders})`,
      showcaseEmails
    );
    const existingIds = existingRows.map((row) => row.id);

    if (existingIds.length > 0) {
      const idPlaceholders = existingIds.map(() => '?').join(', ');
      await connection.execute(
        `DELETE FROM designer_stats WHERE designer_id IN (${idPlaceholders})`,
        existingIds
      );
      await connection.execute(
        `DELETE FROM projects WHERE designer_id IN (${idPlaceholders})`,
        existingIds
      );
      await connection.execute(
        `DELETE FROM designers WHERE id IN (${idPlaceholders})`,
        existingIds
      );
    }

    for (const designer of designers) {
      await connection.execute(
        `INSERT INTO designers (
          id, email, password, full_name, title, phone, city, address, bio, avatar_url,
          style, expertise, is_approved, email_verified, display_order, status, rejection_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          designer.id,
          designer.email,
          designer.password,
          designer.full_name,
          designer.title,
          designer.phone,
          designer.city,
          designer.address,
          designer.bio,
          designer.avatar_url,
          designer.style,
          designer.expertise,
          designer.is_approved,
          designer.email_verified,
          designer.display_order,
          designer.status,
          designer.created_at_days_ago,
        ]
      );
    }

    for (const project of projects) {
      await connection.execute(
        `INSERT INTO projects (
          designer_id, title, description, style, location, area, year, cost, images, tags, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          project.designer_id,
          project.title,
          project.description,
          project.style,
          project.location,
          project.area,
          project.year,
          project.cost,
          project.images,
          project.tags,
          project.status,
          project.created_at_days_ago,
        ]
      );
    }

    for (const stat of stats) {
      await connection.execute(
        `INSERT INTO designer_stats (
          designer_id, stat_date, profile_views, project_views, contact_clicks, phone_clicks, whatsapp_clicks
        ) VALUES (?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?)`,
        [
          stat.designer_id,
          stat.dayOffset,
          stat.profile_views,
          stat.project_views,
          stat.contact_clicks,
          stat.phone_clicks,
          stat.whatsapp_clicks,
        ]
      );
    }

    await connection.commit();

    console.log(
      JSON.stringify({
        seeded_designers: designers.length,
        seeded_projects: projects.length,
        seeded_stats: stats.length,
      })
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = {
  buildSeedData,
  SHOWCASE_AVATAR_URLS,
  SHOWCASE_COVER_URLS,
};

if (require.main === module) {
  applySeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
