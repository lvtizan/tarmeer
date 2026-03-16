export const MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_ESTIMATED_PAYLOAD_BYTES = 18 * 1024 * 1024;
export const IMAGE_COMPRESSION_THRESHOLD_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 1800;
export const IMAGE_OUTPUT_QUALITY = 0.82;

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${bytes}B`;
}

export function estimateDataUrlBytes(dataUrl: string) {
  const [, payload = ''] = dataUrl.split(',', 2);
  return Math.floor((payload.length * 3) / 4);
}

export function buildUploadSizeMessage(totalBytes: number) {
  return `Please keep the total selected files under ${formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}. Current selection: ${formatFileSize(totalBytes)}.`;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to read image "${file.name}".`));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to optimize image.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert image for upload.'));
    reader.readAsDataURL(blob);
  });
}

async function optimizeImage(file: File) {
  const image = await loadImageFromFile(file);
  const longestEdge = Math.max(image.width, image.height);
  const scale = longestEdge > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / longestEdge : 1;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image optimization is not supported in this browser.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = outputType === 'image/png' ? undefined : IMAGE_OUTPUT_QUALITY;
  const blob = await canvasToBlob(canvas, outputType, quality ?? IMAGE_OUTPUT_QUALITY);

  if (blob.size >= file.size && scale === 1) {
    return blobToDataUrl(file);
  }

  return blobToDataUrl(blob);
}

export async function convertProjectImagesForUpload(files: File[]) {
  const images = files.filter((file) => file.type.startsWith('image/'));
  const totalBytes = images.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    throw new Error(buildUploadSizeMessage(totalBytes));
  }

  const dataUrls = await Promise.all(
    images.map((file) => {
      if (file.size >= IMAGE_COMPRESSION_THRESHOLD_BYTES) {
        return optimizeImage(file);
      }

      return blobToDataUrl(file);
    }),
  );

  const estimatedPayloadBytes = dataUrls.reduce((sum, dataUrl) => sum + estimateDataUrlBytes(dataUrl), 0);
  if (estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) {
    throw new Error(
      `Optimized images are still too large for upload. Please reduce image count or choose smaller files. Current estimate: ${formatFileSize(estimatedPayloadBytes)}.`,
    );
  }

  return {
    dataUrls,
    originalBytes: totalBytes,
    estimatedPayloadBytes,
    compressed: images.some((file) => file.size >= IMAGE_COMPRESSION_THRESHOLD_BYTES),
  };
}
