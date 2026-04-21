import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

const VARIANTS = [
  { suffix: '-blur', maxLongEdge: 40, quality: 20 },
  { suffix: '-thumb', maxLongEdge: 600, quality: 78 },    // mobile cards
  { suffix: '-medium', maxLongEdge: 1200, quality: 85 },  // desktop grid / masonry
];

/**
 * Generate blur, thumb, and medium WebP variants for a single image.
 * Skips variants that already exist on disk.
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
