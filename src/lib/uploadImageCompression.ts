import {compressInWorker} from './imageCompressionWorker.js';
/**
 * Safe threshold before client-side image compression.
 * Images larger than this (e.g. phone/camera raw photos > 1.5MB) are automatically
 * compressed in browser memory to ensure ultra-fast cross-border uploads
 * and match the server's maximum stored dimension (2400px).
 */
export const IMAGE_UPLOAD_SAFE_BYTES = 1.5 * 1024 * 1024;

export interface CompressionAttempt {
  maxDimension: number;
  quality: number;
}

const COMPRESSION_ATTEMPTS: readonly CompressionAttempt[] = [
  { maxDimension: 2400, quality: 0.88 },
  { maxDimension: 2048, quality: 0.84 },
  { maxDimension: 1600, quality: 0.80 },
];

export function buildCompressionAttempts(profile: ImageUploadProfile = 'default'): readonly CompressionAttempt[] {
  return profile === 'product' ? PRODUCT_ATTEMPTS : COMPRESSION_ATTEMPTS;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif']);

export function isImageUpload(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type.startsWith('image/')) return true;
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return !!extension && IMAGE_EXTENSIONS.has(extension);
}

export function shouldCompressImageBeforeUpload(file: Pick<File, 'name' | 'type' | 'size'>): boolean {
  return isImageUpload(file) && file.size > IMAGE_UPLOAD_SAFE_BYTES;
}

export function outputMimeTypeForImage(_inputType: string, hasTransparency: boolean): 'image/jpeg' | 'image/webp' {
  // JPEG discards alpha. WebP preserves it and is accepted by every upload endpoint.
  return hasTransparency ? 'image/webp' : 'image/jpeg';
}

function inferredImageMimeType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) return file.type;
  return /\.png$/i.test(file.name) ? 'image/png' : '';
}

function extensionForMimeType(type: string): 'jpg' | 'webp' {
  return type === 'image/webp' ? 'webp' : 'jpg';
}

export function replacementFileName(fileName: string, type: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '') || 'image';
  return `${base}-optimized.${extensionForMimeType(type)}`;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取该图片，不能自动压缩。请换一张图片后重试。'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('浏览器无法压缩该图片，请换一张图片后重试。'));
    }, type, quality);
  });
}

function containsTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Inspect a bounded downscaled copy rather than allocating a second full-size bitmap.
  // Sampling the whole frame matters: transparency is often away from the top-left corner.
  const sampleSize = 64;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleContext = sampleCanvas.getContext('2d');
  if (!sampleContext) return false;
  sampleContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, sampleSize, sampleSize);
  const imageData = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  for (let index = 3; index < imageData.length; index += 4) {
    if (imageData[index] < 255) return true;
  }
  return false;
}

function drawScaled(image: HTMLImageElement, maxDimension: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, maxDimension / longestEdge);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片压缩。');
  context.drawImage(image, 0, 0, width, height);
  return { canvas, context };
}

export type ImageUploadProfile = 'default' | 'product';
export const PRODUCT_UPLOAD_SAFE_BYTES = 600 * 1024;
const PRODUCT_ATTEMPTS: readonly CompressionAttempt[] = [{maxDimension:1600,quality:0.8},{maxDimension:1400,quality:0.76},{maxDimension:1200,quality:0.72}];

export interface PreparedImageUpload {
  file: File;
  originalName: string;
  compressed: boolean;
}

/** Compress images exceeding the safe threshold before transmission. */
export async function prepareImageForUpload(file: File, profile: ImageUploadProfile = 'default'): Promise<PreparedImageUpload> {
  const limit = profile === 'product' ? PRODUCT_UPLOAD_SAFE_BYTES : IMAGE_UPLOAD_SAFE_BYTES;
  if (!isImageUpload(file) || file.size <= limit) {
    return { file, originalName: file.name, compressed: false };
  }

  const workerBlob = await compressInWorker(file, buildCompressionAttempts(profile), limit);
  if (workerBlob) return {
    file: new File([workerBlob], replacementFileName(file.name, workerBlob.type), {type:workerBlob.type,lastModified:file.lastModified}),
    originalName:file.name, compressed:true,
  };
  const image = await loadImage(file);
  let smallestBlob: { blob: Blob; type: 'image/jpeg' | 'image/webp' } | null = null;

  for (const attempt of buildCompressionAttempts(profile)) {
    const { canvas, context } = drawScaled(image, attempt.maxDimension);
    const type = outputMimeTypeForImage(inferredImageMimeType(file), containsTransparency(context, canvas.width, canvas.height));
    const blob = await canvasToBlob(canvas, type, attempt.quality);

    if (!smallestBlob || blob.size < smallestBlob.blob.size) {
      smallestBlob = { blob, type };
    }

    if (blob.size <= limit) {
      return {
        file: new File([blob], replacementFileName(file.name, type), { type, lastModified: file.lastModified }),
        originalName: file.name,
        compressed: true,
      };
    }
  }

  if (smallestBlob) {
    return {
      file: new File([smallestBlob.blob], replacementFileName(file.name, smallestBlob.type), { type: smallestBlob.type, lastModified: file.lastModified }),
      originalName: file.name,
      compressed: true,
    };
  }

  throw new Error('图片自动压缩后仍无法处理，请换一张图片后重试。');
}
