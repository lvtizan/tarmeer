'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, CheckCircle, X } from 'lucide-react';

interface FileUploadButtonProps {
  value: string; // stored URL — empty means nothing uploaded yet
  onUpload: (url: string) => void;
  uploadUrl: string;
  getHeaders: () => Record<string, string>;
  accept?: string;
  label?: string;
  sublabel?: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FileUploadButton({
  value,
  onUpload,
  uploadUrl,
  getHeaders,
  accept = 'image/*,application/pdf',
  label = 'Click or drag to upload',
  sublabel = 'JPG · PNG · PDF',
}: FileUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [displayName, setDisplayName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Derive display name from stored URL
  useEffect(() => {
    setDisplayName(value ? (value.split('/').pop() ?? 'Uploaded file') : '');
  }, [value]);

  const uploadFnRef = useRef<(file: File) => void>(() => {});

  const upload = async (file: File) => {
    setUploading(true);
    setErr('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ data_url: dataUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      setDisplayName(file.name);
      onUpload(data.url);
    } catch (e: unknown) {
      setErr((e instanceof Error ? e.message : null) || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Keep ref current so paste handler always calls latest upload
  uploadFnRef.current = (file: File) => upload(file);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) uploadFnRef.current?.(file);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  const clear = () => {
    setDisplayName('');
    setErr('');
    onUpload('');
  };

  return (
    <div>
      {value && displayName ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-200 bg-emerald-50">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 truncate">{displayName}</p>
            <p className="text-xs text-emerald-500 mt-0.5">已上传 / Uploaded</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 w-7 h-7 rounded-full hover:bg-emerald-100 flex items-center justify-center transition"
            title="Remove"
          >
            <X className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition disabled:opacity-50 text-sm cursor-pointer"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-[#b8864a]/20 border-t-[#b8864a] rounded-full animate-spin" />
          ) : (
            <>
              <Paperclip className="w-5 h-5" />
              <span>{label}</span>
              <span className="text-xs">{sublabel}</span>
            </>
          )}
        </button>
      )}
      {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}
