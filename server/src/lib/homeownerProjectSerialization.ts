import { parseJsonField } from './parseJsonField';
import { sanitizeImageUrls } from './publicImageCleanup';

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseImageList(raw: unknown): string[] {
  const parsed = parseJsonField(raw);
  if (Array.isArray(parsed)) {
    return sanitizeImageUrls(parsed);
  }
  return [];
}

export function normalizeHomeownerRecentProjects(rows: any[]): any[] {
  return rows.map((row) => {
    const images = parseImageList(row.image_urls ?? row.images);
    return {
      ...row,
      title: toString(row.title),
      description: toString(row.description),
      style: toString(row.style),
      images,
    };
  });
}

