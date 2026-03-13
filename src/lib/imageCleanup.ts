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

export function imageDedupKey(url: string): string {
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

export function sanitizeImageUrl(value: unknown): string {
  const url = toTrimmedString(value);
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return '';
}

export function sanitizeImageUrls(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const url = sanitizeImageUrl(value);
    if (!url) continue;

    const key = imageDedupKey(url);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(url);
  }

  return out;
}

export function sanitizeAvatarUrl(value: unknown): string {
  const url = sanitizeImageUrl(value);
  if (!url) return '';

  const key = imageDedupKey(url);
  for (const avatarId of SEED_AVATAR_IDS) {
    if (key.includes(avatarId)) {
      return '';
    }
  }

  return url;
}

export function dedupeImageEntries<T extends { image?: string }>(items: T[]): Array<T & { image: string }> {
  const out: Array<T & { image: string }> = [];
  const seen = new Set<string>();

  for (const item of items) {
    const image = sanitizeImageUrl(item.image);
    const key = imageDedupKey(image);
    if (!image || !key || seen.has(key)) continue;

    seen.add(key);
    out.push({
      ...item,
      image,
    });
  }

  return out;
}

export function getNextRenderableImageIndex(
  images: string[],
  currentIndex: number,
  failedIndices: Iterable<number>
): number {
  const failed = new Set(failedIndices);
  if (images.length === 0) return -1;

  for (let offset = 0; offset < images.length; offset++) {
    const index = (currentIndex + offset) % images.length;
    if (!failed.has(index) && images[index]) {
      return index;
    }
  }

  return -1;
}

function moveImageToFront(images: string[], targetIndex: number): string[] {
  if (targetIndex <= 0) return images;
  return [images[targetIndex], ...images.slice(0, targetIndex), ...images.slice(targetIndex + 1)];
}

export function dedupeProjectCards<T extends { coverImage?: string; images?: string[] }>(projects: T[]): Array<T & { coverImage: string; images: string[] }> {
  const usedCoverKeys = new Set<string>();
  const out: Array<T & { coverImage: string; images: string[] }> = [];

  for (const project of projects) {
    const images = sanitizeImageUrls([project.coverImage, ...(project.images || [])]);
    if (images.length === 0) continue;

    const coverIndex = images.findIndex((image) => !usedCoverKeys.has(imageDedupKey(image)));
    if (coverIndex === -1) continue;

    const orderedImages = moveImageToFront(images, coverIndex);
    usedCoverKeys.add(imageDedupKey(orderedImages[0]));

    out.push({
      ...project,
      coverImage: orderedImages[0],
      images: orderedImages,
    });
  }

  return out;
}

export function dedupeDesignerCardImages<T extends { avatar?: string; projectImages: string[] }>(designers: T[]): Array<T & { avatar: string; projectImages: string[] }> {
  const usedImageKeys = new Set<string>();
  const out: Array<T & { avatar: string; projectImages: string[] }> = [];

  for (const designer of designers) {
    const uniqueImages = sanitizeImageUrls(designer.projectImages).filter((image) => {
      const key = imageDedupKey(image);
      if (!key || usedImageKeys.has(key)) {
        return false;
      }
      usedImageKeys.add(key);
      return true;
    });

    out.push({
      ...designer,
      avatar: sanitizeAvatarUrl(designer.avatar),
      projectImages: uniqueImages,
    });
  }

  return out;
}
