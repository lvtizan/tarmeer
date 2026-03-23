import { Request } from 'express';

const UNKNOWN_IP = 'unknown';

function normalizeIp(ip: string): string {
  if (!ip) return UNKNOWN_IP;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

export function extractClientIp(req: Request): string {
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return normalizeIp(cfConnectingIp.trim());
  }

  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim());
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return normalizeIp(forwarded.split(',')[0].trim());
  }

  return normalizeIp(req.socket?.remoteAddress || UNKNOWN_IP);
}

export function formatVisitorLocation(req: Request): string {
  const country =
    (typeof req.headers['cf-ipcountry'] === 'string' && req.headers['cf-ipcountry']) ||
    (typeof req.headers['x-vercel-ip-country'] === 'string' && req.headers['x-vercel-ip-country']) ||
    (typeof req.headers['x-country-code'] === 'string' && req.headers['x-country-code']) ||
    (typeof req.headers['x-geo-country'] === 'string' && req.headers['x-geo-country']) ||
    '';

  const region =
    (typeof req.headers['x-vercel-ip-country-region'] === 'string' && req.headers['x-vercel-ip-country-region']) ||
    (typeof req.headers['x-region'] === 'string' && req.headers['x-region']) ||
    '';

  const city =
    (typeof req.headers['x-vercel-ip-city'] === 'string' && req.headers['x-vercel-ip-city']) ||
    (typeof req.headers['x-city'] === 'string' && req.headers['x-city']) ||
    '';

  const parts = [country, region, city].map((part) => part.trim()).filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' / ');
  }

  return 'Unknown';
}

export function sanitizePagePath(rawPath: unknown): string {
  if (typeof rawPath !== 'string') return '/';
  const trimmed = rawPath.trim();
  if (!trimmed) return '/';
  if (trimmed.length > 255) return trimmed.slice(0, 255);
  return trimmed;
}
