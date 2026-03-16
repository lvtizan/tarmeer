function isLocalIp(ip?: string | null) {
  if (!ip) return false;
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1';
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

  if (input.path === '/api/health') {
    return true;
  }

  if (input.nodeEnv !== 'production' && isLocalIp(input.ip)) {
    return true;
  }

  return false;
}
