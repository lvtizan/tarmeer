import { parseJsonField } from './parseJsonField';

/**
 * Normalize a `projects.images` field into a flat `string[]` of image URLs.
 *
 * Two historical shapes exist in the database:
 *   1. Legacy plain strings:        ["/uploads/.../1.jpg", "/uploads/.../2.jpg"]
 *   2. Vision-tagged objects:       [{ url, ai_tags, ai_category, ai_tagged_at }, ...]
 *
 * Public API responses promise `string[]` to the frontend, so all read paths
 * must route through this helper. Writing the tagged shape is done in
 * `services/visionTagging.ts`; without this extractor the frontend receives
 * raw objects and crashes on string operations (e.g. `.trim()`).
 */
export function extractProjectImageUrls(value: unknown): string[] {
  const parsed = parseJsonField(value as any);
  if (!Array.isArray(parsed)) return [];

  const urls: string[] = [];
  for (const item of parsed) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) urls.push(trimmed);
    } else if (item && typeof item === 'object') {
      const candidate = (item as { url?: unknown }).url;
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) urls.push(trimmed);
      }
    }
  }
  return urls;
}
