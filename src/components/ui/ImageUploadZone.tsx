'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { getDroppedFiles } from '@/lib/dropFiles';
import { resolveImageUrl } from '@/lib/imageUrl';

interface ImageUploadZoneProps {
  value: string[];
  onUpload: (urls: string[]) => void;
  uploadUrl: string;
  getHeaders: () => Record<string, string>;
  label?: string;
  sublabel?: string;
  accept?: string;
  onFileMeta?: (meta: { original_name: string }) => void;
  chunkUploadUrl?: string; // if set, files > 4MB are uploaded in 2MB chunks
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
      } catch { reject(new Error('Server error')); }
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
  chunkUploadUrl,
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Keep the latest committed value so batched uploads append without clobbering
  // each other (fixes lost images when many files/a folder are dropped at once).
  const valueRef = useRef(value);
  valueRef.current = value;
  const uploadManyRef = useRef<(files: File[]) => void>(() => {});

  const acceptMatchers = accept.split(',').map(s => s.trim());
  const matchesAccept = (file: File) => acceptMatchers.some(a => {
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
    return file.type === a;
  });

  const uploadOne = async (file: File): Promise<{ url: string; original_name?: string }> => {
    if (chunkUploadUrl && file.size > 4 * 1024 * 1024) {
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
        fd.append('original_name', file.name);
        data = await xhrPost(chunkUploadUrl, getHeaders(), fd) as typeof data;
        setProgress(Math.round((i + 1) / totalChunks * 100));
      }
      return data;
    }
    // Single upload
    const fd = new FormData();
    fd.append('file', file);
    fd.append('original_name', file.name);
    return await xhrPost(uploadUrl, getHeaders(), fd, setProgress) as { url: string; original_name?: string };
  };

  const uploadMany = async (files: File[]) => {
    const valid = files.filter(matchesAccept);
    if (valid.length === 0) {
      if (files.length > 0) setErr('不支持该文件类型。');
      return;
    }
    setUploading(true);
    setProgress(0);
    setErr('');
    const uploaded: string[] = [];
    // original_name per uploaded file, index-aligned with `uploaded`. Consumers
    // (e.g. catalogs) keep a parallel names[] array, so onFileMeta must fire once
    // per file, in order — fall back to file.name so alignment never drifts.
    const names: string[] = [];
    try {
      // Sequential so the progress bar stays meaningful for folder uploads.
      for (const file of valid) {
        setProgress(0);
        const data = await uploadOne(file);
        uploaded.push(data.url);
        names.push(data.original_name || file.name);
      }
    } catch (e: unknown) {
      setErr((e instanceof Error ? e.message : null) || 'Upload failed');
    } finally {
      // Commit whatever succeeded (even on partial failure) in a single update.
      if (uploaded.length > 0) {
        const merged = [...valueRef.current, ...uploaded];
        valueRef.current = merged;
        onUpload(merged);
        if (onFileMeta) names.forEach(original_name => onFileMeta({ original_name }));
      }
      setUploading(false);
      setProgress(0);
    }
  };

  uploadManyRef.current = (files: File[]) => uploadMany(files);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) uploadManyRef.current([file]);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    // Recurse into dropped folders, filtering by this zone's `accept`.
    const { files } = await getDroppedFiles(e, matchesAccept);
    if (files.length > 0) uploadMany(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadMany(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const remove = (idx: number) => onUpload(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {/* Uploaded file previews */}
      {value.length > 0 && (
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
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        disabled={uploading}
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
