export function buildCorsOrigins(frontendUrl?: string | null): string[] {
  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5179',
    'http://localhost:5190',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5179',
    'http://127.0.0.1:5190',
    frontendUrl,
    'http://47.91.108.104',
    'https://47.91.108.104',
    'https://designer.tarmeer.com',
    'http://designer.tarmeer.com',
  ].filter((origin): origin is string => typeof origin === 'string' && origin.length > 0);
}
