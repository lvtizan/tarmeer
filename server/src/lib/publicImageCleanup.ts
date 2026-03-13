const SEED_AVATAR_IDS = new Set([
  'photo-1472099645785-5658abf4ff4e',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1494790108377-be9c29b29330',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1500648767791-00dcc994a43e',
  'photo-1573496359142-b8d87734a5a2',
]);

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function imageDedupKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.startsWith('/')) {
      return trimmed.split('?')[0];
    }

    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed.split('?')[0];
  }
}

function isAllowedImageUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
}

export function sanitizeImageUrls(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const url = toTrimmedString(value);
    if (!url || !isAllowedImageUrl(url)) continue;

    const key = imageDedupKey(url);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(url);
  }

  return out;
}

export function sanitizeAvatarUrl(value: unknown): string {
  const url = toTrimmedString(value);
  if (!url || !isAllowedImageUrl(url)) return '';

  const key = imageDedupKey(url);
  for (const avatarId of SEED_AVATAR_IDS) {
    if (key.includes(avatarId)) {
      return '';
    }
  }

  return url;
}
