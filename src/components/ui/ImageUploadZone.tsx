'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';

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
  const uploadFnRef = useRef<(file: File) => void>(() => {});

  const upload = async (file: File) => {
    const acceptsAny = accept.split(',').map(s => s.trim());
    const allowed = acceptsAny.some(a => {
      if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
      return file.type === a;
    });
    if (!allowed) { setErr('不支持该文件类型。'); return; }
    setUploading(true);
    setProgress(0);
    setErr('');
    try {
      let data: { url: string; original_name?: string };
      if (chunkUploadUrl && file.size > 4 * 1024 * 1024) {
        // Chunked upload for large files
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = Array.from(crypto.getRandomValues(new Uint8Array(8)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
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
      } else {
        // Single upload
        const fd = new FormData();
        fd.append('file', file);
        fd.append('original_name', file.name);
        data = await xhrPost(uploadUrl, getHeaders(), fd, setProgress) as typeof data;
      }
      onUpload([...value, data!.url]);
      if (onFileMeta && data!.original_name) onFileMeta({ original_name: data!.original_name });
    } catch (e: unknown) {
      setErr((e instanceof Error ? e.message : null) || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  uploadFnRef.current = (file: File) => upload(file);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) uploadFnRef.current(file);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(f => uploadFnRef.current(f));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(f => upload(f));
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
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-stone-200" />
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
