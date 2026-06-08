export const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Al+Tameer+United+Building+Materials+Trading+L.L.C/@25.3009785,55.629547,17z/data=!4m6!3m5!1s0x3e5f59cee2235cd5:0xa305167fd1075aa8!8m2!3d25.3006521!4d55.629911!16s%2Fg%2F11xzfmy5zx?entry=ttu&g_ep=EgoyMDI2MDMzMS4wIKXMDSoASAFQAw%3D%3D';
export const ADDRESS =
  '1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates';
export const WHATSAPP_NUMBER = '971588388922';
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;
export const INSTAGRAM_URL = 'https://www.instagram.com/tarmeermall';

// Vietnam site
export const VN_ADDRESS = 'Tòa nhà Viva Riverside, Số 1472 Võ Văn Kiệt, Phường Bình Tiên, Thành Phố Hồ Chí Minh, Việt Nam';
export const VN_GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/Tòa+nhà+Viva+Riverside,+Số+1472+Võ+Văn+Kiệt,+Phường+Bình+Tiên,+Thành+Phố+Hồ+Chí+Minh';
export const VN_WHATSAPP_NUMBERS = [
  { label: '+84 886 770 218', link: 'https://wa.me/84886770218' },
  { label: '+84 888 175 938', link: 'https://wa.me/84888175938' },
];

// Time intervals (in milliseconds)
export const STORAGE_SYNC_INTERVAL_MS = 1000;
export const SCROLL_TIMEOUT_MS = 80;
export const IMAGE_ERROR_RETRY_DELAY_BASE_MS = 1000;
export const IMAGE_ERROR_RETRY_MAX_DELAY_MS = 12000;
export const UPLOAD_MAX_RETRY_ATTEMPTS = 8;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_DESIGNERS_ON_HOME = 8;
export const ADMIN_ANALYTICS_PAGE_SIZE = 50;

// Validation
export const MAX_NAME_LENGTH = 50;
export const MIN_PASSWORD_LENGTH = 6;

// Storage keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  ADMIN_TOKEN: 'admin_token',
  DESIGNER: 'designer',
  PHONE_COUNTRY: 'tarmeer_phone_country',
} as const;

// Status values
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  UPLOADING: 'uploading',
  UPLOAD_FAILED: 'upload_failed',
} as const;

export const DESIGNER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
