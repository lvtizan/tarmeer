export const UPLOAD_REQUEST_BODY_LIMIT = '20mb';

export const PAYLOAD_TOO_LARGE_MESSAGE =
  'Uploaded images are too large. Please reduce image size or image count and try again.';

export const isPayloadTooLargeError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { type?: string; status?: number; statusCode?: number };
  return (
    candidate.type === 'entity.too.large' ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
};
