import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

export interface VariantConfig {
  suffix: string;
  maxLongEdge: number;
  quality: number;
}

const VARIANTS: VariantConfig[] = [
  { suffix: '-blur', maxLongEdge: 40, quality: 20 },
  { suffix: '-thumb', maxLongEdge: 400, quality: 75 },
  { suffix: '-medium', maxLongEdge: 800, quality: 80 },
];

/**
 * Generate blur, thumb, and medium WebP variants for a single image.
 * Skips variants that already exist on disk.
 * Returns the list of generated file paths.
 */
export async function generateVariants(imagePath: string): Promise<string[]> {
  const ext = path.extname(imagePath);
  const base = imagePath.slice(0, -ext.length);
  const generated: string[] = [];

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(imagePath).metadata();
  } catch {
    return generated;
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width === 0 || height === 0) return generated;

  for (const variant of VARIANTS) {
    const outPath = `${base}${variant.suffix}.webp`;

    try {
      await fs.access(outPath);
      continue;
    } catch {
      // does not exist, proceed
    }

    const longEdge = Math.max(width, height);
    const scale = longEdge > variant.maxLongEdge ? variant.maxLongEdge / longEdge : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    try {
      await sharp(imagePath)
        .resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(outPath);
      generated.push(outPath);
    } catch {
      // skip this variant on error
    }
  }

  return generated;
}

/**
 * Check if all 3 variants already exist for an image.
 */
export async function hasAllVariants(imagePath: string): Promise<boolean> {
  const ext = path.extname(imagePath);
  const base = imagePath.slice(0, -ext.length);

  for (const variant of VARIANTS) {
    try {
      await fs.access(`${base}${variant.suffix}.webp`);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Build the variant URL from an original image URL.
 */
export function variantUrl(originalUrl: string, variant: 'blur' | 'thumb' | 'medium'): string {
  const dotIndex = originalUrl.lastIndexOf('.');
  if (dotIndex === -1) return originalUrl;
  return `${originalUrl.slice(0, dotIndex)}-${variant}.webp`;
}
