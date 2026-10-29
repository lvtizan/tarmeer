/* CPU-only worker: receives files, never credentials or upload destinations. */
self.onmessage = async ({ data }) => {
  let bitmap;
  try {
    const { file, attempts, limit } = data;
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (!bitmap.width || !bitmap.height) throw Error('Invalid image dimensions');
    let smallest;
    for (const { maxDimension, quality } of attempts) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const sample = new OffscreenCanvas(64, 64);
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      if (!sampleContext) throw Error('Canvas unavailable');
      sampleContext.drawImage(canvas, 0, 0, 64, 64);
      const pixels = sampleContext.getImageData(0, 0, 64, 64).data;
      let transparent = false;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) { transparent = true; break; }
      const blob = await canvas.convertToBlob({ type: transparent ? 'image/webp' : 'image/jpeg', quality });
      canvas.width = canvas.height = 1;
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= limit) break;
    }
    if (!smallest?.size) throw Error('Encoding failed');
    self.postMessage({ blob: smallest });
  } catch {
    self.postMessage({ error: 'Worker compression unavailable' });
  } finally {
    bitmap?.close();
  }
};
