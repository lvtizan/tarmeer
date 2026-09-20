export function normalizeMaterialVideoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.includes('..')) return null;
  return /^\/uploads\/suppliers\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._-]+)*\.mp4$/i.test(url) ? url : null;
}
