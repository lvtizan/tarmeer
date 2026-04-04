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

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed; // base64 — pass through

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

  if (normalized.startsWith('/') && UPLOADS_BASE) {
    return `${UPLOADS_BASE}${normalized}`;
  }
  return normalized;
}
