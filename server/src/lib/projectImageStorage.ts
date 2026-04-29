import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { generateVariants } from './imageVariants';

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;
const PROJECT_UPLOADS_RELATIVE_DIR = '/uploads/projects';
const PROJECT_UPLOADS_ABSOLUTE_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'projects');

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getFileExtensionByMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      return 'bin';
  }
}

function normalizeDesignerId(value: unknown): string {
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) {
    return String(id);
  }
  return 'unknown';
}

function normalizeProjectId(value: unknown): string {
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) {
    return String(id);
  }
  return 'new';
}

function buildProjectImagePathSegments(designerId: unknown, projectId: unknown) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return [normalizeDesignerId(designerId), normalizeProjectId(projectId), year, month];
}

export function isImageDataUrl(value: unknown): boolean {
  const text = toTrimmedString(value);
  return DATA_URL_PATTERN.test(text);
}

async function persistSingleImageDataUrl(dataUrl: string, designerId: unknown, projectId: unknown): Promise<string> {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }

  const mimeType = match[1];
  const base64Payload = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Payload, 'base64');
  if (buffer.length === 0) {
    throw new Error('Image payload is empty.');
  }

  const extension = getFileExtensionByMime(mimeType);
  const subDirs = buildProjectImagePathSegments(designerId, projectId);
  const fileName = `${randomUUID()}.${extension}`;
  const absoluteDir = path.join(PROJECT_UPLOADS_ABSOLUTE_DIR, ...subDirs);
  const absoluteFilePath = path.join(absoluteDir, fileName);
  const relativeUrl = `${PROJECT_UPLOADS_RELATIVE_DIR}/${subDirs.join('/')}/${fileName}`;

  await fs.mkdir(absoluteDir, { recursive: true, mode: 0o755 });
  await fs.writeFile(absoluteFilePath, buffer, { mode: 0o644 });
  // Generate thumbnail variants (blur, thumb, medium)
  generateVariants(absoluteFilePath).catch(() => {});
  return relativeUrl;
}

function isPersistedImageUrl(value: string): boolean {
  return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export async function persistProjectImages(
  rawImages: string[],
  options: { designerId: unknown; projectId?: unknown }
): Promise<string[]> {
  const result: string[] = [];
  const { designerId, projectId } = options;

  for (const image of rawImages) {
    const value = toTrimmedString(image);
    if (!value) continue;

    if (isPersistedImageUrl(value)) {
      result.push(value);
      continue;
    }

    if (isImageDataUrl(value)) {
      const uploadedUrl = await persistSingleImageDataUrl(value, designerId, projectId);
      result.push(uploadedUrl);
    }
  }

  return result;
}
