import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';

interface ImageUploadZoneProps {
  value: string[];            // list of uploaded URLs
  onUpload: (urls: string[]) => void;
  uploadUrl: string;
  getHeaders: () => Record<string, string>;
  label?: string;
  sublabel?: string;
  accept?: string;            // defaults to 'image/*'
  onFileMeta?: (meta: { original_name: string }) => void; // called with server response metadata
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isPdf(url: string) { return url.toLowerCase().includes('.pdf'); }

export default function ImageUploadZone({
  value,
  onUpload,
  uploadUrl,
  getHeaders,
  label = '点击、拖放或粘贴截图上传',
  sublabel = 'JPG · PNG · WebP',
  accept = 'image/*',
  onFileMeta,
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
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
    setErr('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ data_url: dataUrl, original_name: file.name }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      onUpload([...value, data.url]);
      if (onFileMeta && data.original_name) onFileMeta({ original_name: data.original_name });
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
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
          <div className="w-5 h-5 border-2 border-[#b8864a]/20 border-t-[#b8864a] rounded-full animate-spin" />
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
