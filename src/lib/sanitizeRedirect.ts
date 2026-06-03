/**
 * Validate a redirect URL to prevent open-redirect attacks.
 * Only allows relative paths (starting with `/`) and rejects protocol-relative
 * URLs (`//`), `javascript:` schemes, and any absolute URL pointing to an
 * external origin.
 */
export function sanitizeRedirectUrl(
  url: string | null | undefined,
  fallback: string,
): string {
  if (!url || typeof url !== 'string') return fallback;

  const trimmed = url.trim();

  // Block protocol-relative URLs, data URIs, and javascript: schemes
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:')
  ) {
    return fallback;
  }

  // Allow relative paths only
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Block anything that looks like an absolute URL (has a scheme)
  try {
    const parsed = new URL(trimmed);
    if (typeof window !== 'undefined') {
      if (parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    }
  } catch {
    // not a valid URL — fall through
  }

  return fallback;
}
