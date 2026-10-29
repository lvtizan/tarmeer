'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { getDroppedFiles } from '@/lib/dropFiles';
import { resolveImageUrl } from '@/lib/imageUrl';
import { prepareImageForUpload, type PreparedImageUpload, type ImageUploadProfile } from '@/lib/uploadImageCompression';
import { createPasteZoneRegistry, getPasteFiles, isWithinFileLimit } from '@/lib/uploadPasteRouting';
import { createUploadPreparation, imageUploadConcurrency } from '@/lib/uploadPreparation';
import { xhrPost } from '@/lib/uploadRequest';

// A page can contain a product form behind a project dialog. Pasting must still
// work without first focusing a zone, but exactly one (the latest mounted) zone
// may consume an image clipboard event.
let activePasteZone: symbol | null = null;
const pasteZoneRegistry = createPasteZoneRegistry();

interface ImageUploadZoneProps {
  imageProfile?: ImageUploadProfile;
  value: string[];
  onUpload: (urls: string[]) => void;
  uploadUrl: string;
  getHeaders: () => Record<string, string>;
  label?: string;
  sublabel?: string;
  accept?: string;
  onFileMeta?: (meta: { original_name: string }) => void;
  /** 删除第 idx 个已上传文件时通知父组件(用于同步平行的 names[] 等,避免错位) */
  onRemove?: (idx: number) => void;
  chunkUploadUrl?: string; // if set, files > 4MB are uploaded in 2MB chunks
  /** 外层已经有图库预览时，只复用上传交互，避免重复展示缩略图。 */
  showPreviews?: boolean;
  disabled?: boolean;
  onUploadStateChange?: (uploading: boolean) => void;
  /** Optional client-side ceiling for endpoints with a stricter file limit. */
  maxFileBytes?: number;
  /** Use when a page has one unambiguous upload target that should accept clipboard files immediately. */
  activatePasteOnMount?: boolean;
  /** Opt in to non-image clipboard files; defaults retain image-only paste handling. */
  acceptClipboardFiles?: boolean;
}

function isPdf(url: string) { return url.toLowerCase().includes('.pdf'); }

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk

export default function ImageUploadZone({
  value,
  imageProfile = 'default',
  onUpload,
  uploadUrl,
  getHeaders,
  label = '点击、拖放或粘贴截图上传',
  sublabel = 'JPG · PNG · WebP',
  accept = 'image/*',
  onFileMeta,
  onRemove,
  chunkUploadUrl,
  showPreviews = true,
  disabled = false,
  onUploadStateChange,
  maxFileBytes,
  activatePasteOnMount = false,
  acceptClipboardFiles = false,
}: ImageUploadZoneProps) {
  const localPreviews = useRef(new Map<string,string>());
  useEffect(() => () => { for (const url of localPreviews.current.values()) URL.revokeObjectURL(url); localPreviews.current.clear(); }, []);
  useEffect(() => { if (uploadingRef.current) return; for (const [key,url] of localPreviews.current) if (!value.includes(key)) { URL.revokeObjectURL(url); localPreviews.current.delete(key); } }, [value]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [err, setErr] = useState('');
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const failedUploadsRef = useRef(new Map<File, string>());
  const uploadTarget = `${uploadUrl}\n${chunkUploadUrl || ''}`;
  const targetRef = useRef({ key: uploadTarget, generation: 0 });
  if (targetRef.current.key !== uploadTarget) {
    targetRef.current = { key: uploadTarget, generation: targetRef.current.generation + 1 };
  }
  const targetGeneration = targetRef.current.generation;
  useEffect(() => {
    failedUploadsRef.current.clear();
    setFailedFiles([]);
    setErr('');
  }, [targetGeneration]);
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const uploadingRef = useRef(false); // 供 paste/并发判断,避免与进行中的上传并发导致状态错乱
  // Keep the latest committed value so batched uploads append without clobbering
  // each other (fixes lost images when many files/a folder are dropped at once).
  // 仅在非上传中同步外部 value prop，上传进行中由内部累积真源推进，防止 re-render 时被旧 prop 覆盖丢图
  const valueRef = useRef(value);
  if (!uploadingRef.current) {
    valueRef.current = value;
  }
  const uploadManyRef = useRef<(files: File[]) => void>(() => {});
  // 页面上可以同时存在产品、项目等多个上传区。粘贴只交给最后操作过的一个，
  // 不能让每个 document 监听器并发上传同一张截图。
  const zoneIdRef = useRef(Symbol('image-upload-zone'));
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const maxFileBytesRef = useRef(maxFileBytes);
  maxFileBytesRef.current = maxFileBytes;

  const acceptMatchers = accept.split(',').map(s => s.trim());
  const fileExt = (name: string) => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
  const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif'];
  // MIME 不匹配时(空 / octet-stream / 其它不可信值)一律按扩展名兜底,避免误判"不支持"。
  const matchesAccept = (file: File) => acceptMatchers.some(a => {
    if (a.endsWith('/*')) {
      const prefix = a.slice(0, -1); // 如 'image/'
      if (file.type.startsWith(prefix)) return true;
      return prefix === 'image/' && IMG_EXTS.includes(fileExt(file.name));
    }
    if (file.type === a) return true;
    return a === 'application/pdf' && fileExt(file.name) === 'pdf';
  });

  const uploadOne = async (prepared: PreparedImageUpload, onProgressCb?: (p: number) => void): Promise<{ url: string; original_name?: string }> => {
    const file = prepared.file;
    // A compressed image is already kept below the safe single-request budget.
    // Send it normally so the server infers its extension from the actual WebP/JPEG
    // filename rather than from the original PNG/JPEG display name.
    if (chunkUploadUrl && !prepared.compressed && file.size > 4 * 1024 * 1024) {
      // Chunked upload for large files
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      let data: { url: string; original_name?: string } = { url: '' };
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const fd = new FormData();
        fd.append('file', chunk, file.name);
        fd.append('upload_id', uploadId);
        fd.append('chunk_index', String(i));
        fd.append('total_chunks', String(totalChunks));
        fd.append('original_name', prepared.originalName);
        data = await xhrPost(chunkUploadUrl, getHeaders(), fd) as typeof data;
        onProgressCb?.(Math.round((i + 1) / totalChunks * 100));
      }
      return data;
    }
    // Single upload
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('original_name', prepared.originalName);
    return await xhrPost(uploadUrl, getHeaders(), fd, onProgressCb) as { url: string; original_name?: string };
  };

  const uploadOneWithRetry = async (sourceFile: File, onProgressCb?: (p: number) => void, ready?: PreparedImageUpload): Promise<{ url: string; original_name?: string; previewFile?: File }> => {
    const prepared = ready || await prepareImageForUpload(sourceFile, imageProfile);
    try {
      return { ...await uploadOne(prepared, onProgressCb), previewFile: prepared.file };
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const message = err instanceof Error ? err.message : String(err);
      if ((status !== undefined && status >= 400 && status < 500) || /HTTP 4\d\d|不支持|格式异常|无法处理/.test(message)) {
        throw err;
      }
      // 网络抖动/超时等瞬态错误，延迟 1 秒后自动重试一次
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { ...await uploadOne(prepared, onProgressCb), previewFile: prepared.file };
    }
  };

  const browser = typeof navigator==='undefined'?undefined:navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}};
  const UPLOAD_CONCURRENCY = imageUploadConcurrency(imageProfile,browser?.connection,browser?.hardwareConcurrency);

  const uploadMany = async (files: File[]) => {
    if (disabledRef.current || uploadingRef.current) return; // 上传进行中/父表单保存中不接受新文件
    const valid = files.filter(file => matchesAccept(file) && isWithinFileLimit(file, maxFileBytesRef.current));
    const rejected = files.filter(file => !matchesAccept(file) || !isWithinFileLimit(file, maxFileBytesRef.current));
    if (valid.length === 0) {
      const oversized = files.find(file => maxFileBytesRef.current !== undefined && file.size > maxFileBytesRef.current);
      if (oversized && maxFileBytesRef.current !== undefined) {
        setErr(`${oversized.name}（超过 ${Math.floor(maxFileBytesRef.current / 1024 / 1024)} MB 限制，请压缩或拆分文件后重试）`);
      } else if (files.length > 0) {
        setErr('不支持该文件类型。');
      }
      return;
    }
    const generation = targetRef.current.generation;
    uploadingRef.current = true;
    setUploading(true);
    onUploadStateChange?.(true);
    setProgress(0);
    setStatusText('');
    setErr('');
    try {
      const failures: string[] = rejected.map(file => {
        if (maxFileBytesRef.current !== undefined && file.size > maxFileBytesRef.current) {
          return `${file.name}（超过 ${Math.floor(maxFileBytesRef.current / 1024 / 1024)} MB 限制，请压缩或拆分文件后重试）`;
        }
        return `${file.name}（类型不支持）`;
      });

      const fileProgresses = new Array(valid.length).fill(0);
      let completedCount = 0;
      const initialValue = valueRef.current;
      const uploadedUrls: (string | null)[] = new Array(valid.length).fill(null);

      const updateProgressUI = () => {
        const sum = fileProgresses.reduce((a, b) => a + b, 0);
        const overall = Math.round(sum / valid.length);
        setProgress(overall);
        if (valid.length > 1) {
          setStatusText(`正在上传 (${Math.min(completedCount + 1, valid.length)}/${valid.length}) ${overall}%`);
        } else {
          setStatusText(`${overall}%`);
        }
      };

      const workerCount = chunkUploadUrl ? 1 : Math.min(UPLOAD_CONCURRENCY, valid.length);
      const preparation = createUploadPreparation(valid, file=>prepareImageForUpload(file,imageProfile), workerCount+2);
      let nextIndex = 0;
      const runWorker = async () => {
        while (nextIndex < valid.length && targetRef.current.generation === generation) {
          const idx = nextIndex++;
          const file = valid[idx];
          try {
            const prepared = await preparation.take(idx);
            if(targetRef.current.generation!==generation)return;
            const data = await uploadOneWithRetry(file, (p) => {
              if (targetRef.current.generation !== generation) return;
              fileProgresses[idx] = Math.min(p, 99);
              updateProgressUI();
            }, prepared);
            if (targetRef.current.generation !== generation) return;
            if (!data.url) throw new Error('上传服务未返回文件地址，请重新上传。');
            if(data.previewFile?.type.startsWith('image/') && !localPreviews.current.has(data.url)) localPreviews.current.set(data.url, URL.createObjectURL(data.previewFile));
            failedUploadsRef.current.delete(file);
            uploadedUrls[idx] = data.url;
            const completedUrls = uploadedUrls.filter((u): u is string => Boolean(u));
            const merged = [...initialValue, ...completedUrls];
            valueRef.current = merged;
            onUpload(merged);
            if (onFileMeta) onFileMeta({ original_name: data.original_name || file.name });
          } catch (error) {
            if (targetRef.current.generation === generation) failedUploadsRef.current.set(file, `${file.name}（${error instanceof Error ? error.message : '上传失败'}）`);
          } finally {
            completedCount++;
            fileProgresses[idx] = 100;
            if (targetRef.current.generation === generation) updateProgressUI();
          }
        }
      };

      // 分片/大文件目录上传后端有严格单用户排他限流 (limitCatalogBodyConcurrency)，须保持串行 workerCount=1
      const workers = Array.from({ length: workerCount }, () => runWorker());
      try { await Promise.all(workers); } finally { preparation.stop(); }

      if (targetRef.current.generation !== generation) return;
      failures.push(...failedUploadsRef.current.values());
      setFailedFiles(Array.from(failedUploadsRef.current.keys()));
      if (failures.length > 0) setErr(`以下文件未上传：${failures.join('、')}`);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onUploadStateChange?.(false);
      setProgress(0);
      setStatusText('');
    }
  };

  uploadManyRef.current = (files: File[]) => uploadMany(files);

  useEffect(() => {
    pasteZoneRegistry.mount(zoneIdRef.current);
    if (activatePasteOnMount && !disabledRef.current) activePasteZone = zoneIdRef.current;
    const handler = (e: ClipboardEvent) => {
      if (disabledRef.current) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      // Image paste has historically worked anywhere on a page. Do not require a
      // prior click/focus. The latest mounted zone wins so hidden forms cannot
      // consume the same image as an open dialog.
      if (!acceptClipboardFiles) {
        const files = getPasteFiles(items, { acceptClipboardFiles, isCurrent: pasteZoneRegistry.isCurrent(zoneIdRef.current) });
        if (files.length > 0) uploadManyRef.current(files);
        return;
      }
      // Non-image clipboard files are opt-in. A dedicated one-zone page can opt
      // into immediate handling; otherwise retain the explicit active-zone guard.
      if (!activatePasteOnMount && activePasteZone !== zoneIdRef.current) return;
      const files = getPasteFiles(items, { acceptClipboardFiles, isCurrent: true });
      if (files.length > 0) uploadManyRef.current(files);
    };
    const deactivateOutside = (e: PointerEvent) => {
      if (!zoneRef.current?.contains(e.target as Node) && activePasteZone === zoneIdRef.current) activePasteZone = null;
    };
    document.addEventListener('paste', handler);
    document.addEventListener('pointerdown', deactivateOutside);
    return () => {
      document.removeEventListener('paste', handler);
      document.removeEventListener('pointerdown', deactivateOutside);
      if (activePasteZone === zoneIdRef.current) activePasteZone = null;
      pasteZoneRegistry.unmount(zoneIdRef.current);
    };
  }, [acceptClipboardFiles, activatePasteOnMount]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (disabledRef.current) return;
    activePasteZone = zoneIdRef.current;
    try {
      // Recurse into dropped folders, filtering by this zone's `accept`.
      const { files } = await getDroppedFiles(e, matchesAccept);
      if (files.length > 0) uploadMany(files);
    } catch {
      setErr('读取拖入内容失败,请重试或点击选择文件。');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabledRef.current) uploadMany(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const remove = (idx: number) => {
    if (disabledRef.current || uploadingRef.current) return;
    const next = valueRef.current.filter((_, i) => i !== idx);
    valueRef.current = next;
    onUpload(next);
    onRemove?.(idx);
  };

  return (
    <div ref={zoneRef} className="space-y-3">
      {/* Uploaded file previews */}
      {showPreviews && value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, idx) => (
            <div key={idx} className="relative shrink-0">
              {isPdf(url) ? (
                <div className="w-20 h-20 rounded-xl border border-stone-200 bg-red-50 flex flex-col items-center justify-center gap-1">
                  <FileText className="w-7 h-7 text-red-500" />
                  <span className="text-[10px] text-red-400 font-medium">PDF</span>
                </div>
              ) : (
                <img src={localPreviews.current.get(url) || resolveImageUrl(url)} loading="lazy" decoding="async" alt="" className="w-20 h-20 object-cover rounded-xl border border-stone-200" />
              )}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      <button
        type="button"
        onClick={() => { activePasteZone = zoneIdRef.current; fileRef.current?.click(); }}
        onFocus={() => { activePasteZone = zoneIdRef.current; }}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        disabled={disabled || uploading}
        className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition disabled:opacity-50 text-sm cursor-pointer"
      >
        {uploading ? (
          <div className="w-full px-6 flex flex-col items-center gap-2">
            <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#b8864a] h-1.5 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-stone-400">{statusText || `${progress}%`}</span>
          </div>
        ) : (
          <>
            <Paperclip className="w-5 h-5" />
            <span>{label}</span>
            <span className="text-xs">{sublabel}</span>
          </>
        )}
      </button>

      {err && <p role="alert" className="text-xs text-red-500">{err}</p>}
      {failedFiles.length > 0 && <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => void uploadMany(failedFiles)}
        className="min-h-11 rounded-xl bg-[#b8864a] px-4 py-2 text-sm text-white hover:bg-[#a07640] disabled:opacity-40"
      >重试失败的 {failedFiles.length} 个文件</button>}
      <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={handleChange} />
    </div>
  );
}
