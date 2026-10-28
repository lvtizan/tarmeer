import { getUploadResponseError } from './uploadResponseError.js';

const IDLE_TIMEOUT_MS = 90_000;

/** Allow concurrent cross-border transfers to make progress at 8 KiB/s per file. */
export function uploadRequestTimeout(bytes: number): number {
  return Math.min(600_000, Math.max(120_000, 60_000 + Math.ceil(bytes / 8192) * 1000));
}

export function xhrPost(url: string, headers: Record<string, string>, formData: FormData, onProgress?: (p: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bytes = Array.from(formData.values()).reduce((sum, value) => sum + (value instanceof Blob ? value.size : value.length), 0);
    let idleTimer: ReturnType<typeof setTimeout>;
    let settled = false;
    let uploaded = 0;
    let downloaded = 0;
    function finish(error?: Error, value?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      if (error) reject(error); else resolve(value);
    }
    function resetIdle() {
      if (settled) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        finish(new Error('上传长时间没有进展，请检查网络后重试失败文件。'));
        xhr.abort();
      }, IDLE_TIMEOUT_MS);
    }
    xhr.open('POST', url);
    xhr.timeout = uploadRequestTimeout(bytes);
    Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]));
    xhr.upload.onprogress = event => {
      if (settled) return;
      if (event.loaded > uploaded) { uploaded = event.loaded; resetIdle(); }
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    // Once all bytes are sent, give the server its own bounded processing window.
    xhr.upload.onload = () => resetIdle();
    xhr.onprogress = event => {
      if (event.loaded > downloaded) { downloaded = event.loaded; resetIdle(); }
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(getUploadResponseError(xhr.status, xhr.responseText));
        (error as { status?: number }).status = xhr.status;
        finish(error);
        return;
      }
      try { finish(undefined, JSON.parse(xhr.responseText)); }
      catch { finish(new Error('上传成功响应格式异常，未能读取文件地址，请重新上传。')); }
    };
    xhr.ontimeout = () => finish(new Error('上传耗时超过上限，请重试失败文件，或使用更稳定的网络。'));
    xhr.onerror = () => finish(new Error('网络连接失败，文件未上传，请检查网络后重试。'));
    xhr.onabort = () => finish(new Error('上传已中断，请重试失败文件。'));
    try { resetIdle(); xhr.send(formData); }
    catch (error) { finish(error instanceof Error ? error : new Error('无法发送上传请求。')); }
  });
}
