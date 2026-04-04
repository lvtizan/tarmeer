/**
 * Resolve image URLs for /uploads/ paths.
 *
 * On admin.tarmeer.com, nginx has no /uploads/ proxy rule — only www.tarmeer.com does.
 * We detect the admin subdomain at runtime and rewrite /uploads/... to an absolute URL
 * on the main domain so images load correctly from both subdomains.
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
  if (url.startsWith('data:')) return url; // base64 — pass through
  if (url.startsWith('/uploads/') && UPLOADS_BASE) {
    return `${UPLOADS_BASE}${url}`;
  }
  return url;
}
