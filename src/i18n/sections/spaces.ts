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
    'Home Office': 'Home Office',
    Majlis: 'Majlis',
    Hallway: 'Hallway',
    Nursery: 'Nursery',
    Outdoor: 'Outdoor',
  },
  vi: {
    'Living Room': 'Phòng Khách',
    Bedroom: 'Phòng Ngủ',
    Kitchen: 'Nhà Bếp',
    Bathroom: 'Phòng Tắm',
    'Dining Room': 'Phòng Ăn',
    Office: 'Văn Phòng',
    'Home Office': 'Phòng Làm Việc',
    Majlis: 'Majlis',
    Hallway: 'Hành Lang',
    Nursery: 'Phòng Trẻ Em',
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
    Coastal: 'Coastal',
    'Art Deco': 'Art Deco',
    Bohemian: 'Bohemian',
  },
  vi: {
    Modern: 'Hiện Đại',
    Luxury: 'Sang Trọng',
    Minimalist: 'Tối Giản',
    Classical: 'Cổ Điển',
    Arabic: 'Phong Cách Ả Rập',
    Industrial: 'Công Nghiệp',
    Scandinavian: 'Bắc Âu',
    Coastal: 'Ven Biển',
    'Art Deco': 'Art Deco',
    Bohemian: 'Bohemian',
  },
} as const;
