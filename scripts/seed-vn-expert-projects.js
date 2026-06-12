// 为 10 个越南虚拟专家造项目作品（封面用现有 portfolio 图）
// 运行：cd server && NODE_PATH="$(pwd)/node_modules" node ../scripts/seed-vn-expert-projects.js
//   - 幂等：专家已有 project 则跳过
//   - 项目 status='published'，expert_profile_id 关联专家
//   - 列表卡片封面 = 专家首个项目首图（见 listPublicExperts cover_image）
// 生产执行：在 /tarmeer/tarmeer_api 下用生产 .env 跑

require('dotenv').config();
const mysql = require('mysql2/promise');

const IMG = (dir, ...ns) => ns.map(n => `/images/vn-companies/portfolio/${dir}/${String(n).padStart(2, '0')}.jpg`);

// 专家 slug → 项目（按行业配图 + 越南文标题）
const PROJECTS = {
  'nguyen-van-an': [
    { title: 'Căn hộ cao cấp Vinhomes', style: 'Interior Design', location: 'TP. Hồ Chí Minh', area: '120m²', year: 2024, images: IMG('vn-atz-luxury', 1, 2, 3, 4) },
    { title: 'Biệt thự hiện đại Thảo Điền', style: 'Interior Design', location: 'TP. Hồ Chí Minh', area: '320m²', year: 2023, images: IMG('vn-atz-luxury', 5, 6, 7) },
  ],
  'tran-thi-bich': [
    { title: 'Cải tạo căn hộ chung cư', style: 'Renovation', location: 'Hà Nội', area: '95m²', year: 2024, images: IMG('vn-25-nm-thiet-ke-noi-that-chung-cu-biet-thu-nha-pho-vn-phong', 1, 2, 3, 4) },
    { title: 'Hoàn thiện nhà phố', style: 'Fit-Out', location: 'Hà Nội', area: '150m²', year: 2023, images: IMG('vn-25-nm-thiet-ke-noi-that-chung-cu-biet-thu-nha-pho-vn-phong', 5, 6, 7) },
  ],
  'le-hoang-nam': [
    { title: 'Tủ bếp gỗ tự nhiên', style: 'Carpentry', location: 'Đà Nẵng', area: '—', year: 2024, images: IMG('vn-an-cuong', 1, 2, 3, 4) },
    { title: 'Nội thất gỗ phòng khách', style: 'Furniture', location: 'Đà Nẵng', area: '—', year: 2023, images: IMG('vn-an-cuong', 5, 6, 7) },
  ],
  'pham-minh-tuan': [
    { title: 'Hệ thống nhà thông minh', style: 'Smart Home', location: 'TP. Hồ Chí Minh', area: '110m²', year: 2024, images: IMG('vn-adecor-interior', 1, 2, 3, 4) },
  ],
  'vu-quoc-khanh': [
    { title: 'Chống thấm tầng hầm & sân thượng', style: 'Waterproofing', location: 'Hải Phòng', area: '—', year: 2024, images: IMG('vn-betaviet', 1, 2, 3, 4) },
  ],
  'dang-thi-huong': [
    { title: 'Sơn hiệu ứng & hoàn thiện', style: 'Painting', location: 'Hà Nội', area: '85m²', year: 2024, images: IMG('vn-binhminhpaintcom', 1, 2, 3, 4) },
  ],
  'bui-thanh-son': [
    { title: 'Ốp đá cẩm thạch sảnh & bếp', style: 'Stone & Marble', location: 'Biên Hòa', area: '—', year: 2024, images: IMG('vn-cong-ty-saigon-grand-homes', 1, 2, 3, 4) },
  ],
  'hoang-van-dung': [
    { title: 'Vách kính & cửa nhôm', style: 'Glass & Aluminium', location: 'TP. Hồ Chí Minh', area: '—', year: 2024, images: IMG('vn-ap-design-vn', 1, 2, 3, 4) },
  ],
  'ngo-thi-lan': [
    { title: 'Thiết kế chiếu sáng căn hộ', style: 'Lighting Design', location: 'Nha Trang', area: '90m²', year: 2024, images: IMG('vn-best-design-vn', 1, 2, 3, 4) },
  ],
  'do-huu-phuoc': [
    { title: 'Cảnh quan sân vườn biệt thự', style: 'Landscape', location: 'Cần Thơ', area: '450m²', year: 2024, images: IMG('vn-cong-ty-thiet-ke-nha', 1, 2, 3, 4) },
  ],
};

function slugifyProj(title, i) {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'project'}-${i}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  console.log(`[seed-expert-projects] DB=${process.env.DB_HOST}/${process.env.DB_NAME}`);

  // 确认 projects 表有 expert_profile_id 列
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'expert_profile_id'`
  );
  if (cols.length === 0) {
    console.error('[seed-expert-projects] projects.expert_profile_id 列不存在，先访问一次 /api/experts 触发建列或检查后端');
    await conn.end(); process.exit(1);
  }

  let created = 0, skipped = 0;
  for (const [slug, projects] of Object.entries(PROJECTS)) {
    const [erows] = await conn.execute(`SELECT id FROM expert_profiles WHERE slug = ? AND country = 'vn' LIMIT 1`, [slug]);
    if (erows.length === 0) { console.log(`  ! expert not found: ${slug}`); continue; }
    const expertId = erows[0].id;
    const [exist] = await conn.execute(`SELECT id FROM projects WHERE expert_profile_id = ? LIMIT 1`, [expertId]);
    if (exist.length > 0) { console.log(`  skip (has projects): ${slug}`); skipped++; continue; }

    let i = 1;
    for (const p of projects) {
      const pslug = slugifyProj(p.title, i++);
      await conn.execute(
        `INSERT INTO projects (expert_profile_id, title, description, style, location, area, year, images, tags, status, slug)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
        [expertId, p.title, p.description || '', p.style, p.location, p.area || null, p.year || null,
         JSON.stringify(p.images), JSON.stringify([p.style]), pslug]
      );
      created++;
    }
    console.log(`  + ${slug}: ${projects.length} project(s)`);
  }

  const [[cnt]] = await conn.query(
    "SELECT COUNT(*) AS n FROM projects p JOIN expert_profiles e ON e.id = p.expert_profile_id WHERE e.country='vn'"
  );
  console.log(`[seed-expert-projects] done. created=${created} skipped=${skipped} | VN expert projects total=${cnt.n}`);
  await conn.end();
}

main().catch(e => { console.error('[seed-expert-projects] error:', e.message); process.exit(1); });
