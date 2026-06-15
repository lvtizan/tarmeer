// 顶层语言模块 · 空间类型 / 房间 / 风格枚举标签。
export const spaces = {
  en: {
    Villa: 'Villa',
    Apartment: 'Apartment',
    Commercial: 'Commercial',
    'Public / Institutional': 'Public / Institutional',
    'Outdoor / Landscape': 'Outdoor / Landscape',
  },
  vi: {
    Villa: 'Biệt Thự',
    Apartment: 'Căn Hộ',
    Commercial: 'Thương Mại',
    'Public / Institutional': 'Công Cộng',
    'Outdoor / Landscape': 'Sân Vườn',
  },
} as const;

export const rooms = {
  en: {
    'Living Room': 'Living Room',
    Bedroom: 'Bedroom',
    Kitchen: 'Kitchen',
    Bathroom: 'Bathroom',
    'Dining Room': 'Dining Room',
    Office: 'Office',
    Hallway: 'Hallway',
    Outdoor: 'Outdoor',
  },
  vi: {
    'Living Room': 'Phòng Khách',
    Bedroom: 'Phòng Ngủ',
    Kitchen: 'Nhà Bếp',
    Bathroom: 'Phòng Tắm',
    'Dining Room': 'Phòng Ăn',
    Office: 'Văn Phòng',
    Hallway: 'Hành Lang',
    Outdoor: 'Ngoài Trời',
  },
} as const;

export const styles = {
  en: {
    Modern: 'Modern',
    Luxury: 'Luxury',
    Minimalist: 'Minimalist',
    Classical: 'Classical',
    Arabic: 'Arabic',
    Industrial: 'Industrial',
    Scandinavian: 'Scandinavian',
    'Art Deco': 'Art Deco',
  },
  vi: {
    Modern: 'Hiện Đại',
    Luxury: 'Sang Trọng',
    Minimalist: 'Tối Giản',
    Classical: 'Cổ Điển',
    Arabic: 'Phong Cách Ả Rập',
    Industrial: 'Công Nghiệp',
    Scandinavian: 'Bắc Âu',
    'Art Deco': 'Art Deco',
  },
} as const;
