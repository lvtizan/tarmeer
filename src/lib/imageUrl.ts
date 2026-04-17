/**
 * Resolve image URLs for root-relative static paths.
 *
 * On admin.tarmeer.com, nginx static mappings may differ from www.tarmeer.com.
 * We detect admin subdomain at runtime and rewrite "/..." assets to the main domain
 * so /images, /uploads and other root static paths load reliably.
 */
function getUploadsBase(): string {
  if (typeof window === 'undefined') return '';
  const { hostname, protocol } = window.location;
  // admin.tarmeer.com → https://www.tarmeer.com
  if (hostname.startsWith('admin.')) {
    return `${protocol}//www.${hostname.replace(/^admin\./, '')}`;
  }
  return '';
}

const UPLOADS_BASE = getUploadsBase();

function rewriteKnownBrokenPath(path: string): string {
  const HOTFIX_MAP: Record<string, string> = {
    '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png':
      '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.jpg',
    '/images/uae-companies/portfolio/appello-interiors/interior/1.png':
      '/images/uae-companies/portfolio/appello-interiors/interior/1.jpg',
    '/images/uae-companies/portfolio/appello-interiors/cafe/1.png':
      '/images/uae-companies/portfolio/appello-interiors/cafe/1.jpg',
    '/images/uae-companies/portfolio/eminent-interio/office/1.png':
      '/images/uae-companies/portfolio/eminent-interio/office/1.jpg',
  };
  return HOTFIX_MAP[path] || path;
}

function rewriteAdminAbsoluteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.startsWith('admin.')) return url;
    parsed.hostname = `www.${parsed.hostname.replace(/^admin\./, '')}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveImageUrl(url: unknown): string {
  if (!url) return '';
  // Support AI-tagged image objects: {url, ai_tags, ...}
  let raw: string;
  if (typeof url === 'string') {
    raw = url;
  } else if (typeof url === 'object' && typeof (url as any).url === 'string') {
    raw = (url as any).url;
  } else {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed; // base64 — pass through
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return rewriteAdminAbsoluteUrl(trimmed);
  }

  let normalized = trimmed;
  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  } else if (normalized.startsWith('./')) {
    normalized = `/${normalized.replace(/^\.\/+/, '')}`;
  } else if (normalized.startsWith('public/images/')) {
    normalized = `/${normalized.replace(/^public\//, '')}`;
  } else if (normalized.startsWith('public/uploads/')) {
    normalized = `/${normalized.replace(/^public\//, '')}`;
  } else if (normalized.startsWith('images/') || normalized.startsWith('uploads/')) {
    normalized = `/${normalized}`;
  }

  // Ignore legacy seeded avatars that no longer exist in production static files.
  if (/^\/images\/showcase\/avatar-\d+\.(png|jpe?g|webp)$/i.test(normalized)) {
    return '';
  }

  if (normalized.startsWith('/')) {
    const [path, query = ''] = normalized.split('?');
    const rewritten = rewriteKnownBrokenPath(path);
    normalized = query ? `${rewritten}?${query}` : rewritten;
    // Unified uploads source: always read uploaded files via backend static route.
    if (normalized.startsWith('/uploads/')) {
      normalized = `/api${normalized}`;
    }
  }

  if (normalized.startsWith('/') && UPLOADS_BASE) {
    return `${UPLOADS_BASE}${normalized}`;
  }
  return normalized;
}

/**
 * Resolve the URL for a thumbnail variant (blur, thumb, medium).
 * e.g. resolveVariantUrl('/images/.../1.jpg', 'thumb') => '/images/.../1-thumb.webp'
 */
export function resolveVariantUrl(
  url: string | null | undefined,
  variant: 'blur' | 'thumb' | 'medium'
): string {
  const resolved = resolveImageUrl(url);
  if (!resolved) return '';
  if (resolved.startsWith('data:')) return resolved;
  const dotIndex = resolved.lastIndexOf('.');
  const slashIndex = resolved.lastIndexOf('/');
  if (dotIndex === -1 || dotIndex < slashIndex) return resolved;
  return `${resolved.slice(0, dotIndex)}-${variant}.webp`;
}
