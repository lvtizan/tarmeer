/**
 * Normalizes the `projects.images` JSON blob into a flat array of URL strings.
 *
 * The column historically stored `["/uploads/a.jpg", "/uploads/b.jpg"]`, but
 * after Gemini AI tagging (see services/visionTagging.ts) it is rewritten to
 * `[{ url, ai_tags, ai_category, ai_tagged_at }, ...]`. Any endpoint that
 * exposes project images to the frontend must normalize both shapes, or the
 * frontend receives raw objects where it expects strings and silently drops
 * them.
 */

type RawImagesInput = unknown;

function extractUrl(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const url = (item as { url?: unknown }).url;
    if (typeof url === 'string') return url;
  }
  return '';
}

export function extractImageUrls(raw: RawImagesInput): string[] {
  let parsed: unknown = raw;

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.map(extractUrl).filter((url): url is string => url.length > 0);
}
