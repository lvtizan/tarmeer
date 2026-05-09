/** A single project image — either a plain URL string or an object with url + user-assigned tag */
export type NormalizedImage = string | { url: string; tag?: string };

type ProjectPersistenceInput = {
  title: string;
  description: string;
  style?: string | null;
  location?: string | null;
  area?: string | null;
  year?: string | null;
  cost?: string | number | null;
  images?: unknown;
  tags?: unknown;
  service_tags?: unknown;
  status: string;
};

type ProjectPersistenceValues = {
  title: string;
  description: string;
  style: string | null;
  location: string | null;
  area: string | null;
  year: string | null;
  cost: string | number | null;
  images: string;
  tags: string;
  service_tags: string;
  status: string;
};

export const PROJECT_IMAGES_REQUIRED_ERROR = 'PROJECT_IMAGES_REQUIRED';
export const BASE64_IMAGES_NOT_ALLOWED_ERROR = 'BASE64_IMAGES_NOT_ALLOWED';

/**
 * CRITICAL: Validate that images are NOT stored as base64 in the database.
 * All base64 images MUST be converted to file URLs via persistProjectImages() BEFORE this point.
 *
 * Background: Base64 images cause:
 * - 10-17MB per project in database (comparison: file URLs are <1KB)
 * - MySQL sort_buffer_size overflow errors
 * - API response timeouts
 * - Network bandwidth waste
 */
function validateNoBase64Images(images: unknown): void {
  if (!Array.isArray(images)) {
    return;
  }

  for (const image of images) {
    const url = typeof image === 'string' ? image : (image as any)?.url || '';
    if (url.startsWith('data:')) {
      throw new Error(BASE64_IMAGES_NOT_ALLOWED_ERROR);
    }
  }
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function toNullableCost(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value as string | number;
}

function toJsonArrayString(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export function normalizeProjectImages(value: unknown): NormalizedImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: NormalizedImage[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const url = item.trim();
      if (url) result.push(url);
    } else if (item && typeof item === 'object' && 'url' in item) {
      const url = String((item as any).url).trim();
      if (!url) continue;
      const tag = (item as any).tag;
      result.push(typeof tag === 'string' && tag.trim() ? { url, tag: tag.trim() } : url);
    }
  }
  return result;
}

export function assertProjectHasImages(value: unknown): NormalizedImage[] {
  const normalizedImages = normalizeProjectImages(value);
  if (normalizedImages.length === 0) {
    throw new Error(PROJECT_IMAGES_REQUIRED_ERROR);
  }
  return normalizedImages;
}

export function buildProjectPersistenceValues(input: ProjectPersistenceInput): ProjectPersistenceValues {
  const normalizedImages: NormalizedImage[] = assertProjectHasImages(input.images);

  // CRITICAL: Prevent base64 images from entering the database
  validateNoBase64Images(normalizedImages);

  return {
    title: input.title,
    description: input.description,
    style: toNullableString(input.style),
    location: toNullableString(input.location),
    area: toNullableString(input.area),
    year: toNullableString(input.year),
    cost: toNullableCost(input.cost),
    images: toJsonArrayString(normalizedImages),
    tags: toJsonArrayString(input.tags),
    service_tags: toJsonArrayString(input.service_tags),
    status: input.status,
  };
}
