/**
 * Client-side image deduplication using perceptual hashing (pHash).
 * Uses canvas to resize images to 8x8 grayscale, then computes a 64-bit hash.
 * Two images with hamming distance <= threshold are considered duplicates.
 * No API calls, runs entirely in the browser.
 */

const HASH_SIZE = 8; // 8x8 = 64 bits

/** Compute a perceptual hash from an image source (data URL or blob URL). */
export function computePHash(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = HASH_SIZE;
      canvas.height = HASH_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }

      // Draw scaled-down grayscale
      ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
      const data = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data;

      // Convert to grayscale values
      const grays: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        grays.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }

      // Average
      const avg = grays.reduce((a, b) => a + b, 0) / grays.length;

      // Build hash: each bit is 1 if pixel > average
      let hash = '';
      for (const g of grays) {
        hash += g >= avg ? '1' : '0';
      }
      resolve(hash);
    };
    img.onerror = () => resolve(''); // Don't block on error
    img.src = src;
  });
}

/** Hamming distance between two binary hash strings. */
function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/**
 * Find duplicate images among new uploads against existing images.
 * Returns indices of new images that are duplicates (should be removed).
 * threshold: max hamming distance to consider as duplicate (default 10 = ~84% similar)
 */
export async function findDuplicates(
  newDataUrls: string[],
  existingDataUrls: string[],
  threshold = 10,
): Promise<{ duplicateIndices: number[]; pairs: Array<{ newIdx: number; existingIdx: number }> }> {
  // Compute hashes for all images
  const [newHashes, existingHashes] = await Promise.all([
    Promise.all(newDataUrls.map(computePHash)),
    Promise.all(existingDataUrls.map(computePHash)),
  ]);

  const duplicateIndices: number[] = [];
  const pairs: Array<{ newIdx: number; existingIdx: number }> = [];

  for (let i = 0; i < newHashes.length; i++) {
    if (!newHashes[i]) continue;

    // Check against existing images
    for (let j = 0; j < existingHashes.length; j++) {
      if (!existingHashes[j]) continue;
      if (hammingDistance(newHashes[i], existingHashes[j]) <= threshold) {
        duplicateIndices.push(i);
        pairs.push({ newIdx: i, existingIdx: j });
        break;
      }
    }
    if (duplicateIndices.includes(i)) continue;

    // Check against other new images (keep the first, mark later ones)
    for (let j = 0; j < i; j++) {
      if (!newHashes[j] || duplicateIndices.includes(j)) continue;
      if (hammingDistance(newHashes[i], newHashes[j]) <= threshold) {
        duplicateIndices.push(i);
        pairs.push({ newIdx: i, existingIdx: -1 });
        break;
      }
    }
  }

  return { duplicateIndices, pairs };
}
