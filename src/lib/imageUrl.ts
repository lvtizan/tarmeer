/**
 * Resolve image URLs — ensures /uploads/ paths are passed through correctly.
 * Nginx already proxies /uploads/ to the backend, so no prefix needed.
 * This function normalizes null/undefined to empty string for safe use in img src.
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url;
}
