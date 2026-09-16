'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { getDroppedFiles } from '@/lib/dropFiles';
import { resolveImageUrl } from '@/lib/imageUrl';
import { prepareImageForUpload } from '@/lib/uploadImageCompression';

// All mounted zones share one paste owner. A page can contain a hidden product
// form behind a project dialog, so per-instance booleans are not sufficient.
let activePasteZone: symbol | null = null;

interface ImageUploadZoneProps {
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
}

function isPdf(url: string) { return url.toLowerCase().includes('.pdf'); }

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk

function xhrPost(url: string, headers: Record<string, string>, formData: FormData, onProgress?: (p: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.keys(headers).forEach(k => xhr.setRequestHeader(k, headers[k]));
    if (onProgress) xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(res);
        else reject(new Error((res as { error?: string }).error || 'Upload failed'));
      } catch {
        reject(new Error(xhr.status === 413
          ? '图片文件过大，正在自动压缩失败，请换一张图片后重试。'
          : `上传服务返回异常（HTTP ${xhr.status || '未知'}）。`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

export default function ImageUploadZone({
  value,
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
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  // Keep the latest committed value so batched uploads append without clobbering
  // each other (fixes lost images when many files/a folder are dropped at once).
  const valueRef = useRef(value);
  valueRef.current = value;
  const uploadManyRef = useRef<(files: File[]) => void>(() => {});
  const uploadingRef = useRef(false); // 供 paste 判断,避免与进行中的上传并发导致状态错乱
  // 页面上可以同时存在产品、项目等多个上传区。粘贴只交给最后操作过的一个，
  // 不能让每个 document 监听器并发上传同一张截图。
  const zoneIdRef = useRef(Symbol('image-upload-zone'));
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

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

  const uploadOne = async (sourceFile: File): Promise<{ url: string; original_name?: string }> => {
    const prepared = await prepareImageForUpload(sourceFile);
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
        setProgress(Math.round((i + 1) / totalChunks * 100));
      }
      return data;
    }
    // Single upload
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('original_name', prepared.originalName);
    return await xhrPost(uploadUrl, getHeaders(), fd, setProgress) as { url: string; original_name?: string };
  };

  const uploadMany = async (files: File[]) => {
    if (disabledRef.current || uploadingRef.current) return; // 上传进行中/父表单保存中不接受新文件
    const valid = files.filter(matchesAccept);
    const rejected = files.filter(file => !matchesAccept(file));
    if (valid.length === 0) {
      if (files.length > 0) setErr('不支持该文件类型。');
      return;
    }
    uploadingRef.current = true;
    setUploading(true);
    onUploadStateChange?.(true);
    setProgress(0);
    setErr('');
    try {
      // 顺序上传且逐项容错：一张失败不阻断文件夹中其余图片。
      const failures: string[] = rejected.map(file => `${file.name}（类型不支持）`);
      for (const file of valid) {
        setProgress(0);
        try {
          const data = await uploadOne(file);
          if (!data.url) throw new Error('Upload failed');
          const merged = [...valueRef.current, data.url];
          valueRef.current = merged;
          onUpload(merged);
          if (onFileMeta) onFileMeta({ original_name: data.original_name || file.name });
        } catch (error) {
          failures.push(`${file.name}（${error instanceof Error ? error.message : '上传失败'}）`);
        }
      }
      if (failures.length > 0) setErr(`以下文件未上传：${failures.join('、')}`);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onUploadStateChange?.(false);
      setProgress(0);
    }
  };

  uploadManyRef.current = (files: File[]) => uploadMany(files);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (disabledRef.current || activePasteZone !== zoneIdRef.current) return;
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) uploadManyRef.current([file]);
      }
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
    };
  }, []);

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
                <img src={resolveImageUrl(url)} alt="" className="w-20 h-20 object-cover rounded-xl border border-stone-200" />
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
            <span className="text-xs text-stone-400">{progress}%</span>
          </div>
        ) : (
          <>
            <Paperclip className="w-5 h-5" />
            <span>{label}</span>
            <span className="text-xs">{sublabel}</span>
          </>
        )}
      </button>

      {err && <p className="text-xs text-red-500">{err}</p>}
      <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={handleChange} />
    </div>
  );
}
