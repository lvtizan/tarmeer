function isLocalIp(ip?: string | null) {
  if (!ip) return false;
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1';
}

function normalizePath(path?: string | null) {
  if (!path) return '';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function isExemptPath(path?: string | null) {
  const normalized = normalizePath(path);
  const withoutApiPrefix = normalized.startsWith('/api/')
    ? normalizePath(normalized.slice(4))
    : normalized;

  const candidates = new Set([normalized, withoutApiPrefix]);
  const exactExemptPaths = new Set([
    '/health',
    '/auth/me',
    '/auth/select-role',
    '/auth/switch-role',
    '/auth/google',
    '/auth/callback/google',
    '/auth/google/one-tap',
    '/auth/facebook',
    '/auth/callback/facebook',
    '/admin/check-installation',
    '/admin/install',
    '/admin/forgot-password',
    '/admin/reset-password',
  ]);

  for (const candidate of candidates) {
    if (exactExemptPaths.has(candidate)) {
      return true;
    }
  }

  return false;
}

export function shouldSkipApiRateLimit(input: {
  nodeEnv: string;
  method?: string | null;
  path?: string | null;
  ip?: string | null;
}) {
  if (input.method === 'OPTIONS') {
    return true;
  }

  if (isExemptPath(input.path)) {
    return true;
  }

  if (input.nodeEnv !== 'production' && isLocalIp(input.ip)) {
    return true;
  }

  return false;
}
