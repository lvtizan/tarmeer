// 作品集页文案。房间/风格 chip 标签复用 rooms / styles（见 spaces.ts），此处只放页面级文字。
export const portfolio = {
  en: {
    title: 'Portfolio',
    subtitle: (country: string) => `Explore interior design projects from ${country}'s top professionals`,
    byRoom: 'By Room',
    byStyle: 'By Style',
    clear: 'Clear',
    empty: 'No portfolio projects available yet.',
    moreProjects: 'More projects',
    allLoaded: 'All projects loaded',
  },
  vi: {
    title: 'Tác Phẩm',
    subtitle: (country: string) => `Khám phá các dự án thiết kế nội thất từ các chuyên gia hàng đầu tại ${country}`,
    byRoom: 'Theo Phòng',
    byStyle: 'Theo Phong Cách',
    clear: 'Xóa',
    empty: 'Chưa có dự án nào.',
    moreProjects: 'Dự án khác',
    allLoaded: 'Đã tải hết dự án',
  },
} as const;
