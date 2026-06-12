// 造 10 个越南装修行业虚拟专家（country='vn'）
// 运行：cd server && node ../scripts/seed-vn-experts.js
//   - 读 server/.env 的 DB 配置（本地 localhost / 生产 RDS 由所在机器 .env 决定）
//   - 幂等：邮箱已存在则跳过
//   - 每个专家：建 users(role=expert,+84) + expert_profiles(country=vn,status=approved)
// 生产执行：scp 到服务器，在 /tarmeer/tarmeer_api 下 node 跑（用生产 .env）

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// 越南文 → ASCII（slug/email 用）
function foldVi(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function slugify(name) {
  return foldVi(name).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// 10 个不同装修行业的越南专家
const EXPERTS = [
  { name: 'Nguyễn Văn An', city: 'TP. Hồ Chí Minh', years: 12, phone: '+84901000101',
    services: ['Interior Design', 'Renovation'], skills: ['Bố trí không gian', 'Phối màu', 'Thiết kế 3D'],
    bio: 'Chuyên gia thiết kế nội thất với hơn 12 năm kinh nghiệm cho căn hộ và biệt thự cao cấp tại TP.HCM.',
    certified: 1, signed: 1 },
  { name: 'Trần Thị Bích', city: 'Hà Nội', years: 9, phone: '+84901000102',
    services: ['Renovation & Fit-Out'], skills: ['Cải tạo căn hộ', 'Quản lý thi công', 'Hoàn thiện'],
    bio: 'Chuyên cải tạo và hoàn thiện căn hộ, nhà phố tại Hà Nội, cam kết tiến độ và ngân sách rõ ràng.',
    certified: 1, signed: 0 },
  { name: 'Lê Hoàng Nam', city: 'Đà Nẵng', years: 15, phone: '+84901000103',
    services: ['Carpentry & Joinery', 'Furniture'], skills: ['Mộc nội thất', 'Tủ bếp gỗ', 'Gỗ tự nhiên'],
    bio: 'Thợ mộc và nhà thiết kế nội thất gỗ với 15 năm kinh nghiệm, chuyên tủ bếp và đồ gỗ theo yêu cầu.',
    certified: 1, signed: 0 },
  { name: 'Phạm Minh Tuấn', city: 'TP. Hồ Chí Minh', years: 8, phone: '+84901000104',
    services: ['Smart Home & IT', 'Electrical'], skills: ['Nhà thông minh', 'Hệ thống điện', 'Tự động hóa'],
    bio: 'Kỹ sư hệ thống điện và nhà thông minh, lắp đặt giải pháp tự động hóa cho nhà ở và văn phòng.',
    certified: 0, signed: 0 },
  { name: 'Vũ Quốc Khánh', city: 'Hải Phòng', years: 11, phone: '+84901000105',
    services: ['Plumbing & Waterproofing'], skills: ['Chống thấm', 'Cấp thoát nước', 'Xử lý ẩm mốc'],
    bio: 'Chuyên gia chống thấm và hệ thống cấp thoát nước, xử lý triệt để thấm dột cho công trình dân dụng.',
    certified: 1, signed: 0 },
  { name: 'Đặng Thị Hương', city: 'Hà Nội', years: 7, phone: '+84901000106',
    services: ['Painting & Finishing'], skills: ['Sơn nghệ thuật', 'Hoàn thiện bề mặt', 'Sơn hiệu ứng'],
    bio: 'Chuyên sơn và hoàn thiện bề mặt, mang đến lớp hoàn thiện tinh tế cho không gian sống.',
    certified: 0, signed: 0 },
  { name: 'Bùi Thanh Sơn', city: 'Biên Hòa', years: 13, phone: '+84901000107',
    services: ['Stone, Marble & Tile'], skills: ['Đá tự nhiên', 'Ốp lát', 'Cẩm thạch'],
    bio: 'Chuyên thi công đá, cẩm thạch và gạch ốp lát cao cấp cho sảnh, phòng tắm và mặt bếp.',
    certified: 1, signed: 0 },
  { name: 'Hoàng Văn Dũng', city: 'TP. Hồ Chí Minh', years: 10, phone: '+84901000108',
    services: ['Glass & Aluminium'], skills: ['Kính cường lực', 'Cửa nhôm', 'Vách kính'],
    bio: 'Chuyên gia kính và nhôm: cửa nhôm kính, vách ngăn và mặt dựng cho nhà ở và thương mại.',
    certified: 0, signed: 0 },
  { name: 'Ngô Thị Lan', city: 'Nha Trang', years: 6, phone: '+84901000109',
    services: ['Lighting Design', 'Interior Design'], skills: ['Thiết kế chiếu sáng', 'Ánh sáng kiến trúc', 'Đèn trang trí'],
    bio: 'Nhà thiết kế chiếu sáng, tạo nên không gian ấm áp và sang trọng bằng giải pháp ánh sáng tinh tế.',
    certified: 0, signed: 1 },
  { name: 'Đỗ Hữu Phước', city: 'Cần Thơ', years: 14, phone: '+84901000110',
    services: ['Landscape & Exterior'], skills: ['Cảnh quan sân vườn', 'Ngoại thất', 'Hồ bơi'],
    bio: 'Chuyên gia cảnh quan và ngoại thất, thiết kế sân vườn, hồ bơi và không gian ngoài trời.',
    certified: 1, signed: 0 },
];

async function uniqueSlug(conn, name, userId) {
  let base = slugify(name) || `expert-${userId}`;
  let slug = base, i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await conn.execute('SELECT id FROM expert_profiles WHERE slug = ?', [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${i++}`;
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  console.log(`[seed-vn-experts] DB=${process.env.DB_HOST}/${process.env.DB_NAME}`);
  const pw = await bcrypt.hash(`vn-expert-${Date.now()}`, 10);
  let created = 0, skipped = 0;

  for (const e of EXPERTS) {
    const handle = slugify(e.name);
    const email = `expert.${handle}@tarmeer-vn.local`;
    const [exist] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length > 0) { console.log(`  skip (exists): ${e.name}`); skipped++; continue; }

    const [ures] = await conn.execute(
      `INSERT INTO users (email, password, full_name, phone, city, email_verified, role, active_role, onboarding_completed, status)
       VALUES (?, ?, ?, ?, ?, TRUE, 'expert', 'expert', 1, 'active')`,
      [email, pw, e.name, e.phone, e.city]
    );
    const userId = ures.insertId;
    const slug = await uniqueSlug(conn, e.name, userId);

    await conn.execute(
      `INSERT INTO expert_profiles
         (user_id, full_name, avatar_url, services, experience_years, city, bio, skills, phone, slug, status, country, is_certified, is_signed)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'approved', 'vn', ?, ?)`,
      [userId, e.name, JSON.stringify(e.services), e.years, e.city, e.bio,
       JSON.stringify(e.skills), e.phone, slug, e.certified, e.signed]
    );
    console.log(`  + ${e.name} (${e.services[0]}) /experts/${slug}`);
    created++;
  }

  const [[cnt]] = await conn.query("SELECT COUNT(*) AS n FROM expert_profiles WHERE country='vn'");
  console.log(`[seed-vn-experts] done. created=${created} skipped=${skipped} | VN experts total=${cnt.n}`);
  await conn.end();
}

main().catch(e => { console.error('[seed-vn-experts] error:', e.message); process.exit(1); });
