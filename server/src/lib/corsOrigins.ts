/**
 * CORS 配置管理
 * 提供安全的跨域资源共享策略
 */

interface CorsConfig {
  development: string[];
  production: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
}

// 安全的CORS配置
const CORS_CONFIG: CorsConfig = {
  // 开发环境允许的来源
  development: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5179',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5179',
    'http://localhost:4175',
    'http://127.0.0.1:4175',
  ],

  // 生产环境允许的来源（需要明确配置）
  production: [
    // 主域名
    'https://www.tarmeer.com',
    'https://tarmeer.com',
    // 设计师后台
    'https://designer.tarmeer.com',
    // 如果有其他域名，请在这里添加
    // 'https://your-domain.com',
  ],

  // 允许的HTTP方法
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  // 允许的请求头
  allowedHeaders: ['Content-Type', 'Authorization'],

  // 是否允许发送凭据
  credentials: true,

  // 预检请求缓存时间（秒）
  maxAge: 86400, // 24小时
};

/**
 * 验证来源URL是否安全
 */
function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    // 只允许http和https协议
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * 构建CORS允许的来源列表
 */
export function buildCorsOrigins(frontendUrl?: string | null): string[] {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 始终保留本地开发来源，避免在非 development NODE_ENV 下阻塞本地联调
  let origins: string[] = [...CORS_CONFIG.development];
  if (!isDevelopment) {
    origins = [...origins, ...CORS_CONFIG.production];
  }

  // 添加配置的前端URL（如果提供且有效）
  if (frontendUrl && isValidOrigin(frontendUrl)) {
    // 确保没有重复
    if (!origins.includes(frontendUrl)) {
      origins.push(frontendUrl);
    }
  }

  // 在生产环境中，如果提供了具体的IP地址，添加到允许列表
  if (!isDevelopment) {
    const productionIPs = [
      'http://47.91.108.104',
      'https://47.91.108.104',
    ];

    for (const ip of productionIPs) {
      if (!origins.includes(ip)) {
        origins.push(ip);
      }
    }
  }

  // 验证所有来源
  origins = origins.filter(isValidOrigin);

  return origins;
}

/**
 * 获取CORS配置对象
 */
export function getCorsConfig(frontendUrl?: string | null) {
  return {
    origin: buildCorsOrigins(frontendUrl),
    methods: CORS_CONFIG.allowedMethods,
    allowedHeaders: CORS_CONFIG.allowedHeaders,
    credentials: CORS_CONFIG.credentials,
    maxAge: CORS_CONFIG.maxAge,
    // 添加额外的安全头
    exposedHeaders: ['Content-Length', 'Content-Type'],
    // 预检请求成功缓存
    optionsSuccessStatus: 204,
  };
}

/**
 * 验证请求来源是否被允许
 */
export function isOriginAllowed(origin: string, frontendUrl?: string | null): boolean {
  const allowedOrigins = buildCorsOrigins(frontendUrl);
  return allowedOrigins.includes(origin);
}

/**
 * 自定义CORS错误处理
 */
export class CorsError extends Error {
  constructor(message: string, public origin?: string) {
    super(message);
    this.name = 'CorsError';
  }
}

/**
 * 记录CORS违规尝试
 */
export function logCorsViolation(origin: string, path: string): void {
  console.warn(`[CORS] Blocked unauthorized origin: ${origin} trying to access ${path}`);
}
