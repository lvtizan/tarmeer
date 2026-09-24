export const PAYLOAD_TOO_LARGE_UPLOAD_MESSAGE = '文件超过服务器允许的大小，请压缩或拆分文件后重试。';

export function getUploadResponseError(status, responseText) {
  if (status === 413) return PAYLOAD_TOO_LARGE_UPLOAD_MESSAGE;
  try {
    const parsed = JSON.parse(responseText);
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
  } catch {
    // The status-specific fallback below is clearer than exposing HTML/proxy text.
  }
  return status
    ? `上传服务返回异常（HTTP ${status}），文件未上传，请稍后重试。`
    : '上传服务未返回有效状态，文件未上传，请检查网络后重试。';
}
