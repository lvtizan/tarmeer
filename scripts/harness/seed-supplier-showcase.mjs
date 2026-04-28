#!/usr/bin/env node
/**
 * Supplier showcase seed — 5 China + 5 Dubai suppliers.
 * Product images are category-specific Unsplash photos (not random picsum).
 *
 * Usage:
 *   node scripts/harness/seed-supplier-showcase.mjs            # upsert
 *   node scripts/harness/seed-supplier-showcase.mjs --reset    # wipe & re-seed
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

// ── Category-specific Unsplash images (no random picsum) ──────────────────────
// Each category maps to 3 relevant photo URLs
const CAT_IMAGES = {
  furniture: [
    'https://images.unsplash.com/photo-1555041469-d7f5cc9d0b67?w=800&q=80', // modern sofa
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80', // armchair set
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80', // dining table
  ],
  office: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80', // conference room
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80', // open plan office
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80', // executive desk set
  ],
  stone: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // marble countertop
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80', // marble slab
    'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&q=80', // stone tile wall
  ],
  lighting: [
    'https://images.unsplash.com/photo-1513506003901-1e6a35087a4d?w=800&q=80', // pendant light
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80', // track lighting
    'https://images.unsplash.com/photo-1565814329452-e4c0e68c0b45?w=800&q=80', // modern lamp
  ],
  flooring: [
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80', // hardwood floor
    'https://images.unsplash.com/photo-1558618047-f4e60d9c2c89?w=800&q=80', // tile floor close-up
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&q=80', // herringbone floor
  ],
  kitchen: [
    'https://images.unsplash.com/photo-1556909170-afec1aa70b87?w=800&q=80', // white kitchen cabinets
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80', // kitchen island
    'https://images.unsplash.com/photo-1556909190-8f6ef5d2e69f?w=800&q=80', // undermount sink
  ],
  curtains: [
    'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80', // linen curtains
    'https://images.unsplash.com/photo-1585559604959-e91b4aae673f?w=800&q=80', // sheer drape
    'https://images.unsplash.com/photo-1618220179862-0f7a92c8d62f?w=800&q=80', // motorized blind
  ],
  hardware: [
    'https://images.unsplash.com/photo-1558618147-83a1c07a964b?w=800&q=80', // brass door handle
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80', // cabinet pull set
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // sliding rail
  ],
  plants: [
    'https://images.unsplash.com/photo-1502759683299-cdcd6974244f?w=800&q=80', // palm tree silhouettes at sunset
    'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=800&q=80', // indoor tropical plants
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80', // garden path with hedges
  ],
  paint: [
    'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&q=80', // paint bucket & roller
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80', // freshly painted wall
    'https://images.unsplash.com/photo-1618220048045-10a6dbdf83e0?w=800&q=80', // colour swatches
  ],
  other: [
    'https://images.unsplash.com/photo-1586023492125-27264946c5e6?w=800&q=80', // acoustic panel
    'https://images.unsplash.com/photo-1555041469-d7f5cc9d0b67?w=800&q=80', // decor piece
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80', // wall art
  ],
  wardrobe: [
    'https://images.unsplash.com/photo-1558618047-f4e60d9c2c89?w=800&q=80', // walk-in closet
    'https://images.unsplash.com/photo-1594222082006-77e8fff5ead9?w=800&q=80', // fitted wardrobe
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80', // wardrobe system
  ],
  doors_windows: [
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80', // pivot door
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // sliding door
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&q=80', // window light
  ],
};

// Hero (project cover) images — confirmed interior design photos
const HERO = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1400&q=80', // living room A
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1400&q=80', // bedroom
  'https://images.unsplash.com/photo-1616594039964-3f5df2be0f0b?w=1400&q=80', // kitchen
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400&q=80', // bedroom B
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1400&q=80', // living room B
];

// ── Product catalog per category ─────────────────────────────────────────────
const PRODUCTS = {
  furniture: [
    ['Modular Sofa Set',    'CasaLinea', 'Urban Cloud', '3200×950mm', 'Sand Beige',   'Living Room', 'AED 8k–12k'],
    ['Walnut Coffee Table', 'NordicForm', 'W-01',        '1200×700mm', 'Walnut',        'Living Room', 'AED 1.8k–3k'],
    ['Dining Chair Set',    'StudioOak',  'Dine-6',      '6-seat',     'Oatmeal',       'Dining',      'AED 2.5k–4k'],
  ],
  office: [
    ['Executive Conference Table', '华盛家具', 'HWS-CT2400', '3600×1200mm', 'Walnut Veneer', 'Board Room',         'AED 4k–12k/set'],
    ['Open-plan Workstation',      '华盛家具', 'HWS-WS',     'Custom',      'White/Grey',    'Staff Office Area',  'AED 800–2k/unit'],
    ['Government Reception Desk',  '华盛家具', 'HWS-RD',     'Custom',      'Champagne Oak', 'Public Service Hall','AED 6k–18k/set'],
  ],
  stone: [
    ['Calacatta Marble Slab',  'StoneCraft', 'Calacatta Gold', '20mm',      'White/Gold',   'Feature Wall', 'AED 550–850/m²'],
    ['Travertine Tile',         'AsterStone', 'T-Prime',        '600×1200mm','Cream',         'Flooring',     'AED 220–380/m²'],
    ['Quartz Countertop',       'QZ Home',    'Q-Polar',        '30mm',      'Snow White',    'Kitchen',      'AED 900–1300/lfm'],
  ],
  lighting: [
    ['Magnetic Track Light', 'GlowLine',   'M-Track',   '12W',      'Matte Black',  'Ceiling',      'AED 220–360/unit'],
    ['Linear Pendant',        'LumaWorks',  'Line-120',  '1200mm',   'Champagne',    'Dining',       'AED 480–780/unit'],
    ['Wall Washer',           'ArcLight',   'WW-24',     '24W',      'Warm 3000K',   'Feature Wall', 'AED 180–300/unit'],
  ],
  flooring: [
    ['SPC Floor Board',    'FloorPro',   'SPC-Luxe',   '5.5mm',    'Natural Oak',    'Bedroom',      'AED 120–220/m²'],
    ['Engineered Wood',    'TimberNest', 'EN-Classic',  '14mm',     'Smoked Oak',     'Living Room',  'AED 260–420/m²'],
    ['Porcelain Floor Tile','Ceramix',   'P-Urban',     '800×800mm','Concrete Grey',  'Hallway',      'AED 90–160/m²'],
  ],
  kitchen: [
    ['Sintered Stone Top',  'KraftTop',  'ST-Prime',  '12mm',      'Ivory',        'Kitchen Counter', 'AED 700–1100/lfm'],
    ['Soft-close Hinge Kit','HettPro',   'HC-Soft',   'Set of 12', 'Nickel',       'Cabinet Doors',   'AED 180–320/set'],
    ['Undermount Sink',     'AquaForge', 'UF-760',    '760mm',     'Gunmetal',     'Kitchen',          'AED 450–760/unit'],
  ],
  curtains: [
    ['Blackout Curtain',  'DrapeLab',    'BLK-90',   'Custom', 'Linen Grey',  'Bedroom',     'AED 160–280/m'],
    ['Sheer Curtain',     'SoftDrape',   'SH-Flow',  'Custom', 'Warm White',  'Living Room', 'AED 90–170/m'],
    ['Motorized Track',   'CurtainTech', 'MT-2.0',   'Per m',  'White',       'All Rooms',   'AED 240–420/m'],
  ],
  hardware: [
    ['Smart Door Lock',    'SecureHome', 'SL-X7',   'Mortise',   'Matte Black',   'Main Door',   'AED 900–1600/unit'],
    ['Cabinet Pull Set',   'MetalMode',  'MP-12',   '12 pcs',    'Brushed Brass', 'Cabinetry',   'AED 220–420/set'],
    ['Sliding Door Rail',  'RailPro',    'SR-80',   '2m set',    'Satin Silver',  'Partitions',  'AED 260–480/set'],
  ],
  plants: [
    ['Artificial King Coconut Palm (大王椰)', '春蕾绿茵', '大王椰系列', 'H:6–10m (custom)', 'Natural Green', 'Hotel Lobby / Outdoor',   'AED 3k–8k/unit'],
    ['Artificial Cherry Blossom Tree',        '春蕾绿茵', '樱花树系列', 'H:3–4.5m (custom)','Pink/White',    'Commercial Atrium',        'AED 1.8k–4k/unit'],
    ['Artificial Bamboo Screen',              '春蕾绿茵', '仿真竹系列', 'H:1–3m (custom)',  'Natural',       'Interior Divider / Patio', 'AED 800–2k/section'],
  ],
  paint: [
    ['Low-VOC Emulsion',       'ColorWise',   'Eco Silk',  '18L',  'Off White',    'Walls',      'AED 280–450/bucket'],
    ['Decorative Texture Coat','ArtePlaster', 'AT-Cloud',  '20kg', 'Stone Beige',  'Accent Wall','AED 320–520/bucket'],
    ['Moisture Guard Primer',  'PrimeSeal',   'MGP',       '18L',  'Transparent',  'Wet Areas',  'AED 180–320/bucket'],
  ],
  other: [
    ['Acoustic Panel',   'QuietSpace', 'QP-Wood',   '600×2400mm', 'Walnut',       'Media Wall',   'AED 240–420/panel'],
    ['Decor Mirror Set', 'Reflecto',   'RM-Set',    '3 pcs',      'Bronze Tint',  'Feature Wall', 'AED 380–680/set'],
    ['Wall Art Frame',   'ArtHive',    'AH-Canvas', '1200×800mm', 'Abstract',     'Living Room',  'AED 450–900/piece'],
  ],
  wardrobe: [
    ['Walk-in Wardrobe System', '索菲亚', 'SF-WIC', 'Custom size', 'Pearl White',    'Master Bedroom', 'AED 8k–20k/set'],
    ['Sliding Door Wardrobe',   '索菲亚', 'SF-SLD', 'Custom size', 'Champagne Gold', 'Bedroom',        'AED 3.5k–8k'],
    ['Full-wall Dressing Unit',  '索菲亚', 'SF-DRS', 'Custom size', 'Ash Grey',       'Walk-in Closet', 'AED 5k–12k'],
  ],
  doors_windows: [
    ['Thermal Break Casement Window', '怡发', 'YF-CW70', 'Custom', 'White/Champagne',  'Living Room',   'AED 280–480/m²'],
    ['Aluminum Sliding Door',          '怡发', 'YF-SD90', 'Custom', 'Matte Black',      'Balcony',       'AED 650–1100/m²'],
    ['French Pivot Entry Door',        '怡发', 'YF-PD',   '2400mm', 'Bronze',           'Main Entrance', 'AED 2.5k–4.5k/set'],
  ],
};

// ── 5 China + 5 Dubai suppliers ───────────────────────────────────────────────
const SUPPLIERS = [
  // China — 4 companies
  {
    slug: 'huasheng-furniture',
    name: '华盛家具集团',
    origin: 'china',
    type: 'furnishing',
    categories: ['office', 'other'],
    desc: '广东华盛家具集团专注高品质工程办公家具二十余年，服务对象涵盖政府机关、金融机构及文化艺术中心等大型公共空间。标杆项目包括苏州市政务中心、招商证券深圳总部、成都天府文化艺术中心等，支持定制规格与工程批量采购，可对接 UAE 工程项目需求。',
    phone: '+86 755 8800 1234',
    address: 'Shenzhen, Guangdong, China',
    maps: 'https://maps.google.com/?q=Guangdong+Huasheng+Furniture+Group',
    logo:  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80',
    cover: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    projectImages: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80', // conference room
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1400&q=80', // glass-wall meeting room
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1400&q=80', // open plan office
      'https://images.unsplash.com/photo-1541746972996-4e0b0f43e02a?w=1400&q=80', // glass meeting room dark
    ],
    projectTemplates: [
      { title: '苏州市政务中心办公家具配套', location: '江苏省苏州市', year: '2018' },
      { title: '招商证券深圳总部工程家具',   location: '广东省深圳市', year: '2018' },
      { title: '成都天府文化艺术中心',       location: '四川省成都市', year: '2021' },
      { title: '甘南文旅会展中心',           location: '甘肃省甘南藏族自治州', year: '2018' },
    ],
  },
  {
    slug: 'chunlei-plants',
    name: '春蕾绿化工程',
    origin: 'china',
    type: 'landscaping',
    categories: ['plants', 'other'],
    desc: '春蕾绿化工程（绿茵品牌）专注仿真植物工程化定制，产品涵盖仿真棕榈树、大王椰、樱花树、银杏树、竹子等百余个品种，高度可达10米，适用于酒店大堂、主题乐园、商业中庭及别墅景观。已为北京蟹岛度假村、西安乐华欢乐世界等知名项目提供仿真绿化整体解决方案。',
    phone: '+86 571 8800 5678',
    address: 'Hangzhou, Zhejiang, China',
    maps: 'https://maps.google.com/?q=Hangzhou+Artificial+Plants',
    logo:  'https://images.unsplash.com/photo-1502759683299-cdcd6974244f?w=800&q=80',  // palm sunset silhouettes
    cover: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80',  // garden path with hedges
    projectImages: [
      'https://images.unsplash.com/photo-1502759683299-cdcd6974244f?w=1400&q=80', // palm sunset silhouettes
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1400&q=80', // garden path with hedges
      'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=1400&q=80', // indoor tropical plants
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=1400&q=80', // green plant
    ],
    projectTemplates: [
      { title: '北京朝阳区蟹岛度假村仿真棕榈工程', location: '北京市朝阳区', year: '2023' },
      { title: '西安乐华欢乐世界大王椰景观',       location: '陕西省西安市',   year: '2022' },
      { title: '马来西亚度假酒店棕榈树装置',       location: 'Malaysia',        year: '2021' },
      { title: '河北邯郸文化产业园仿真竹林',       location: '河北省邯郸市',   year: '2020' },
    ],
  },
  {
    slug: 'sophia-custom',
    name: '索菲亚',
    origin: 'china',
    type: 'furnishing',
    categories: ['wardrobe', 'kitchen', 'hardware'],
    desc: '索菲亚定制家居（Suofeiya），中国领先全屋定制品牌，专注衣柜、橱柜、书柜及全屋系统定制，提供从量尺设计、工厂生产到现场安装的全流程服务，已进驻 UAE 多个高端社区项目。',
    phone: '+86 20 3900 8888',
    address: 'Guangzhou, Guangdong, China',
    maps: 'https://maps.google.com/?q=Suofeiya+Guangzhou',
    logo:  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
    cover: 'https://images.unsplash.com/photo-1594222082006-77e8fff5ead9?w=800&q=80',
    projectImages: [
      'https://images.unsplash.com/photo-1594222082006-77e8fff5ead9?w=1400&q=80',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1400&q=80',
      'https://images.unsplash.com/photo-1558618047-f4e60d9c2c89?w=1400&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1400&q=80',
    ],
  },
  {
    slug: 'yifa-windows-doors',
    name: '怡发门窗',
    origin: 'china',
    type: 'specialty_trade',
    categories: ['doors_windows', 'hardware', 'other'],
    desc: '怡发门窗专注高性能断桥铝合金门窗系统，产品线覆盖系统窗、推拉门、折叠门、大旋转门，符合 UAE ESMA 建筑标准，支持 RAL 色卡定制及工程项目整批供货。',
    phone: '+86 757 8800 9999',
    address: 'Foshan, Guangdong, China',
    maps: 'https://maps.google.com/?q=Foshan+Aluminum+Windows+Doors',
    logo:  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80',  // modern house exterior with large windows
    cover: 'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=800&q=80',  // tall windows in living room
    projectImages: [
      'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1400&q=80', // modern house exterior with large windows
      'https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=1400&q=80', // tall windows in living room
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1400&q=80', // dark house exterior wooden door
      'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=1400&q=80', // interior hallway sliding door
    ],
  },

  // Dubai
  {
    slug: 'skyline-build-co',
    name: 'Skyline Build Co.',
    origin: 'dubai',
    type: 'general_contractor',
    categories: ['stone', 'hardware', 'flooring'],
    desc: 'Dubai-based general contractor specialising in luxury villa and apartment fit-outs. We source and supply premium stone, hardware, and engineered flooring direct to site.',
  },
  {
    slug: 'harbor-fitout-works',
    name: 'Harbor Fitout Works',
    origin: 'dubai',
    type: 'renovation_company',
    categories: ['flooring', 'lighting', 'hardware'],
    desc: 'Full-service renovation contractor covering JBR, Marina, and Downtown Dubai. Supplying SPC flooring, track lighting, and door hardware for residential and commercial projects.',
  },
  {
    slug: 'atelier-dune',
    name: 'Atelier Dune',
    origin: 'dubai',
    type: 'design_studio',
    categories: ['stone', 'lighting', 'paint'],
    desc: 'Award-winning Dubai design studio curating materials for high-end interiors. Our showcase features Calacatta marble, bespoke lighting, and low-VOC architectural paint collections.',
  },
  {
    slug: 'voltflow-mep',
    name: 'VoltFlow MEP',
    origin: 'dubai',
    type: 'mep_contractor',
    categories: ['lighting', 'hardware', 'kitchen'],
    desc: 'MEP contractor and electrical materials distributor serving Dubai and Abu Dhabi. Supplying smart lighting systems, cabinet hardware, and kitchen electrical fittings.',
  },
  {
    slug: 'oasisscape',
    name: 'OasisScape',
    origin: 'dubai',
    type: 'landscaping',
    categories: ['plants', 'stone', 'other'],
    desc: 'Dubai landscaping and biophilic design studio. We bring indoor greenery, natural stone planters, and vertical garden systems to residential and hospitality interiors.',
  },
];

const PROJECT_TEMPLATES = [
  { title: 'Modern Apartment Living Upgrade',      location: 'Dubai Marina',         year: '2026' },
  { title: 'Villa Suite Premium Refresh',           location: 'Palm Jumeirah',        year: '2026' },
  { title: 'Family Home Material Harmonization',   location: 'Jumeirah Village Circle', year: '2025' },
  { title: 'Boutique Office Fit-out Enhancement',  location: 'Business Bay',         year: '2025' },
];

function pickHero(i) { return HERO[i % HERO.length]; }

function buildProducts(categoryKeys, seedIndex) {
  const picked = [];
  for (const c of categoryKeys) {
    const items = PRODUCTS[c] || PRODUCTS.other;
    for (let j = 0; j < 2; j++) {
      picked.push({ ...{ cat: c }, data: items[(seedIndex + j) % items.length] });
    }
  }
  return picked.slice(0, 6).map(({ cat, data: m }, idx) => ({
    title: m[0], brand: m[1], series: m[2], spec: m[3], color: m[4], usage: m[5], priceBand: m[6],
    category: cat,
    image: (CAT_IMAGES[cat] || CAT_IMAGES.other)[idx % 3],
  }));
}

function buildProjects(supplier, seedIndex) {
  const templates = supplier.projectTemplates || PROJECT_TEMPLATES;
  const imgs = supplier.projectImages || HERO;
  const t1 = templates[seedIndex % templates.length];
  const t2 = templates[(seedIndex + 1) % templates.length];
  const h1 = imgs[seedIndex % imgs.length];
  const h2 = imgs[(seedIndex + 1) % imgs.length];
  const g1 = [h1, imgs[(seedIndex + 2) % imgs.length], imgs[(seedIndex + 3) % imgs.length]];
  const g2 = [h2, imgs[(seedIndex + 1) % imgs.length], imgs[(seedIndex + 2) % imgs.length]];
  return [
    { title: `${supplier.name} – ${t1.title}`, location: t1.location, year: t1.year, hero: h1, gallery: g1, products: buildProducts(supplier.categories, seedIndex) },
    { title: `${supplier.name} – ${t2.title}`, location: t2.location, year: t2.year, hero: h2, gallery: g2, products: buildProducts([...supplier.categories].reverse(), seedIndex + 2) },
  ];
}

async function ensureTables() {
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
  const [col] = await pool.execute(
    `SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='supplier_products' AND column_name='category' LIMIT 1`
  );
  if (!Array.isArray(col) || col.length === 0) {
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
  const slugs = SUPPLIERS.map(s => s.slug);
  const ph = slugs.map(() => '?').join(',');
  const [profiles] = await pool.execute(`SELECT id, supplier_user_id FROM supplier_profiles WHERE slug IN (${ph})`, slugs);
  const pIds = (profiles || []).map(p => p.id);
  const uIds = (profiles || []).map(p => p.supplier_user_id);
  if (pIds.length) {
    const pm = pIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM supplier_project_materials WHERE supplier_project_id IN (SELECT id FROM supplier_projects WHERE supplier_profile_id IN (${pm}))`, pIds);
    await pool.execute(`DELETE FROM supplier_projects WHERE supplier_profile_id IN (${pm})`, pIds);
    await pool.execute(`DELETE FROM supplier_products WHERE supplier_profile_id IN (${pm})`, pIds);
    await pool.execute(`DELETE FROM supplier_catalogs WHERE supplier_profile_id IN (${pm})`, pIds);
    await pool.execute(`DELETE FROM supplier_profiles WHERE id IN (${pm})`, pIds);
  }
  if (uIds.length) {
    const um = uIds.map(() => '?').join(',');
    await pool.execute(`DELETE FROM supplier_users WHERE id IN (${um})`, uIds);
  }
  await pool.execute(`DELETE FROM supplier_users WHERE email LIKE ?`, [`%${SEED_DOMAIN}`]);
}

async function upsertSupplier(base, index, passwordHash) {
  const email = `${base.slug}${SEED_DOMAIN}`;
  const phone = base.phone || (base.origin === 'china' ? '+86 139 0000 1234' : '+971 50 123 4567');
  const maps = base.maps || (base.origin === 'china'
    ? 'https://maps.google.com/?q=Yiwu+International+Trade+City'
    : 'https://maps.google.com/?q=Business+Bay+Dubai');

  let userId;
  const [users] = await pool.execute('SELECT id FROM supplier_users WHERE email=? LIMIT 1', [email]);
  if (Array.isArray(users) && users.length) {
    userId = users[0].id;
    await pool.execute('UPDATE supplier_users SET full_name=?, phone=?, password=?, email_verified=1 WHERE id=?',
      [`${base.name} Team`, phone, passwordHash, userId]);
  } else {
    const [u] = await pool.execute(
      'INSERT INTO supplier_users (email, password, full_name, phone, email_verified) VALUES (?,?,?,?,1)',
      [email, passwordHash, `${base.name} Team`, phone]);
    userId = u.insertId;
  }

  const heroLogo = base.logo || pickHero(index);
  const heroCover = base.cover || pickHero(index + 1);

  let profileId;
  const [profiles] = await pool.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id=? LIMIT 1', [userId]);
  if (Array.isArray(profiles) && profiles.length) {
    profileId = profiles[0].id;
    await pool.execute(
      `UPDATE supplier_profiles SET company_name=?, slug=?, description=?, logo_url=?, cover_image_url=?,
         origin=?, categories=?, has_physical_store=1, store_address=?,
         google_maps_url=?, contact_phone=?, whatsapp=?, website=?, status='approved' WHERE id=?`,
      [base.name, base.slug, base.desc, heroLogo, heroCover,
       base.origin, JSON.stringify(base.categories),
       base.address || (base.origin === 'china' ? 'Yiwu, Zhejiang, China' : 'Business Bay, Dubai, UAE'),
       maps, phone, phone, `https://www.${base.slug}.example.com`, profileId]);
  } else {
    const [p] = await pool.execute(
      `INSERT INTO supplier_profiles
        (supplier_user_id, company_name, slug, description, logo_url, cover_image_url,
         origin, categories, has_physical_store, store_address, google_maps_url,
         contact_phone, whatsapp, website, status)
       VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,'approved')`,
      [userId, base.name, base.slug, base.desc, heroLogo, heroCover,
       base.origin, JSON.stringify(base.categories),
       base.address || (base.origin === 'china' ? 'Yiwu, Zhejiang, China' : 'Business Bay, Dubai, UAE'),
       maps, phone, phone, `https://www.${base.slug}.example.com`]);
    profileId = p.insertId;
  }

  // Wipe & re-insert projects + products
  await pool.execute(`DELETE FROM supplier_project_materials WHERE supplier_project_id IN (SELECT id FROM supplier_projects WHERE supplier_profile_id=?)`, [profileId]);
  await pool.execute('DELETE FROM supplier_projects WHERE supplier_profile_id=?', [profileId]);
  await pool.execute('DELETE FROM supplier_products WHERE supplier_profile_id=?', [profileId]);
  await pool.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id=?', [profileId]);

  const projects = buildProjects(base, index);
  let productTotal = 0;

  for (let pi = 0; pi < projects.length; pi++) {
    const proj = projects[pi];
    const matText = proj.products.map(m => `${m.title} (${m.brand}, ${m.spec}, ${m.priceBand})`).join('; ');
    const [ins] = await pool.execute(
      'INSERT INTO supplier_projects (supplier_profile_id, title, description, location, year, images, sort_order) VALUES (?,?,?,?,?,?,?)',
      [profileId, proj.title, `Curated material case. Products: ${matText}`, proj.location, proj.year, JSON.stringify(proj.gallery), pi]);
    const projectId = ins.insertId;

    const productIds = [];
    for (let mi = 0; mi < proj.products.length; mi++) {
      const m = proj.products[mi];
      const [pi2] = await pool.execute(
        'INSERT INTO supplier_products (supplier_profile_id, title, description, image_url, category, sort_order) VALUES (?,?,?,?,?,?)',
        [profileId, m.title,
         `Brand: ${m.brand} | Series: ${m.series} | Spec: ${m.spec} | Color: ${m.color} | Usage: ${m.usage} | Price: ${m.priceBand}`,
         m.image, m.category, pi * 10 + mi]);
      productIds.push(pi2.insertId);
      productTotal++;
    }
    for (let k = 0; k < productIds.length; k++) {
      await pool.execute(
        'INSERT INTO supplier_project_materials (supplier_project_id, supplier_product_id, sort_order) VALUES (?,?,?)',
        [projectId, productIds[k], k]);
    }
  }

  await pool.execute(
    `INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size) VALUES (?,?,?,?),(?,?,?,?)`,
    [profileId, `${base.name} Material Catalog 2026`, 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 1048576,
     profileId, `${base.name} Project Specification Book`, 'https://www.africau.edu/images/default/sample.pdf', 1572864]);

  return { slug: base.slug, email, profileId, products: productTotal };
}

async function main() {
  console.log('\n══ Supplier Showcase Seed (4 China + 5 Dubai) ══');
  console.log(`DB: ${process.env.DB_NAME || 'tarmeer'} @ ${process.env.DB_HOST || '127.0.0.1'}`);
  await ensureTables();
  if (RESET) {
    console.log('Resetting seed data...');
    await cleanSeedData();
  }
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (let i = 0; i < SUPPLIERS.length; i++) {
    const r = await upsertSupplier(SUPPLIERS[i], i, hash);
    console.log(`✔ [${SUPPLIERS[i].origin}] ${r.slug} — ${r.products} products`);
  }
  console.log('\nDone. Default password:', DEFAULT_PASSWORD);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
