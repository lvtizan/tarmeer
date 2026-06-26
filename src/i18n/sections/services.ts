// 服务分类 / 子服务 的越南语显示映射。
// 英文名是 DB(company_service_categories / company_services)的规范值，也是 `?service=` 筛选 key —— 不可改。
// 这里只做"显示翻译"：VN 站把英文名映射成越南语展示，AE 站仍用英文。缺映射则回退英文。
// 数据源：GET /api/public/service-categories（导航/公司筛选/专家筛选共用）。
export const serviceLabelsVi: Record<string, string> = {
  // ── 8 个分类 ──
  'Design Only': 'Chỉ Thiết Kế',
  'Build Only': 'Chỉ Thi Công',
  'Design & Build': 'Thiết Kế & Thi Công',
  'Renovation': 'Cải Tạo',
  'Extension': 'Mở Rộng',
  'Outdoor & Pools': 'Sân Vườn & Hồ Bơi',
  'Home Systems': 'Hệ Thống Nhà',
  'Other Services': 'Dịch Vụ Khác',

  // ── Design Only ──
  'Architecture Design': 'Thiết Kế Kiến Trúc',
  'Interior Design': 'Thiết Kế Nội Thất',
  'Architecture & Interior Design': 'Thiết Kế Kiến Trúc & Nội Thất',
  'Landscape & Outdoor Design': 'Thiết Kế Cảnh Quan & Sân Vườn',
  'MEP & Technical Drawings': 'Cơ Điện (MEP) & Bản Vẽ Kỹ Thuật',

  // ── Build Only ──
  'General Contracting': 'Tổng Thầu Xây Dựng',
  'Civil & Structural Works': 'Xây Dựng & Kết Cấu',
  'Interior Fit-out Execution': 'Thi Công Hoàn Thiện Nội Thất',
  'Commercial Fit-out Execution': 'Thi Công Hoàn Thiện Thương Mại',

  // ── Design & Build ──
  'Interior Design & Build': 'Thiết Kế & Thi Công Nội Thất',
  'Full Turnkey (Architecture + Interior)': 'Trọn Gói (Kiến Trúc + Nội Thất)',

  // ── Renovation ──
  'Full Renovation': 'Cải Tạo Toàn Bộ',
  'Kitchen Remodeling': 'Cải Tạo Nhà Bếp',
  'Bathroom Remodeling': 'Cải Tạo Phòng Tắm',
  'Ceiling & Lighting': 'Trần & Chiếu Sáng',
  'Flooring & Wall': 'Sàn & Tường',
  'Internal Doors & Windows': 'Cửa & Cửa Sổ Nội Thất',
  'Other Partial Renovation': 'Cải Tạo Từng Phần Khác',
  'Partial Renovation': 'Cải Tạo Từng Phần',

  // ── Extension ──
  'Majlis Construction': 'Xây Dựng Majlis',
  'Villa Extension': 'Mở Rộng Biệt Thự',
  'Sunroom & Canopy': 'Phòng Kính & Mái Che',
  'Loft / Mezzanine Floor': 'Gác Xép / Tầng Lửng',
  'Structural Works': 'Thi Công Kết Cấu',
  'Boundary Wall & Gate': 'Tường Rào & Cổng',

  // ── Outdoor & Pools ──
  'Pool & Water Features': 'Hồ Bơi & Tiểu Cảnh Nước',
  'Pergola & Gazebo': 'Pergola & Chòi Nghỉ',
  'Landscaping & Irrigation': 'Cảnh Quan & Tưới Tiêu',
  'Outdoor Kitchen & BBQ': 'Bếp Ngoài Trời & BBQ',
  'Fence & Driveway': 'Hàng Rào & Lối Xe',
  'Outdoor Lighting': 'Chiếu Sáng Ngoài Trời',

  // ── Home Systems ──
  'HVAC Upgrade': 'Nâng Cấp Điều Hòa (HVAC)',
  'Smart Home & Automation': 'Nhà Thông Minh & Tự Động Hóa',
  'Security & Networking': 'An Ninh & Mạng',
  'Water Purification': 'Lọc Nước',
  'Solar Systems': 'Hệ Thống Điện Mặt Trời',
  'Waterproofing & Insulation': 'Chống Thấm & Cách Nhiệt',

  // ── Other Services ──
  'Commercial Fixtures & Exhibitions': 'Nội Thất Thương Mại & Triển Lãm',
};

/** 服务分类/子服务显示名：VN 站翻译，其他国家用英文原值；缺映射回退原值。 */
export function translateServiceLabel(name: string, lang: string): string {
  if (lang === 'vi') return serviceLabelsVi[name] ?? name;
  return name;
}
