'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { resolveImageUrl } from '@/lib/imageUrl';
import type { SupplierCatalog } from '@/lib/materialsApi';
import type CatalogReaderComponent from './CatalogReader';

function CatalogCard({ catalog, index }: { catalog: SupplierCatalog; index: number }) {
  const [open, setOpen] = useState(false);
  const [Reader, setReader] = useState<typeof CatalogReaderComponent | null>(null);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const openReader = async () => {
    if (opening) return;
    if (Reader) { setOpen(true); return; }
    setOpening(true);
    setOpenFailed(false);
    try {
      const module = await import('./CatalogReader');
      if (!mounted.current) return;
      setReader(() => module.default);
      setOpen(true);
    } catch { if (mounted.current) setOpenFailed(true); }
    finally { if (mounted.current) setOpening(false); }
  };
  const [preview, setPreview] = useState<{ pages: number; src: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const base = resolveImageUrl(`/uploads/suppliers/catalogs/pages/${catalog.id}`);
    fetch(`${base}/manifest.json`, { cache: 'no-cache', signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error('Preview unavailable');
      const data = await response.json();
      if (!Number.isInteger(data.pages) || data.pages < 1) throw Error('Preview unavailable');
      const dir = typeof data.dir === 'string' && /^revisions\/[a-f0-9]{64}$/i.test(data.dir) ? `${base}/${data.dir}` : base;
      const extension = data.format === 'jpg' ? 'jpg' : 'webp';
      const revision = data.rev ? `?r=${encodeURIComponent(String(data.rev))}` : '';
      if (!abort.signal.aborted) setPreview({ pages: data.pages, src: `${dir}/1-thumb.${extension}${revision}` });
    }).catch(() => { if (!abort.signal.aborted) setUnavailable(true); });
    return () => abort.abort();
  }, [catalog.id]);
  return <>
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
        {preview && !unavailable ? <SmartImage src={preview.src} alt="" width={56} height={80} loading="lazy" className="h-full w-full object-contain" onError={() => setUnavailable(true)} /> : <BookOpen className="h-6 w-6 text-[#b8864a]" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">Supplier catalog{index > 0 ? ` ${index + 1}` : ''}</p>
        <p className="mt-1 text-xs text-stone-600">{preview ? `PDF · ${preview.pages} pages` : 'PDF catalog'}</p>
        <p className="mt-1 text-xs text-stone-500">{unavailable ? 'Preview unavailable. Open the reader to retry.' : 'Browse the full collection in the reader.'}</p>
        {openFailed && <p role="alert" className="mt-1 text-xs text-red-700">Could not open the reader. Please try again.</p>}
      </div>
      <button type="button" onClick={openReader} aria-busy={opening} aria-disabled={opening} aria-label={`View catalog ${index + 1}`} className="rounded-full bg-[#b8864a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a07640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8864a]">{opening ? 'Opening catalog…' : 'View Catalog'}</button>
    </div>
    {open && Reader && <Reader catalogs={[catalog]} initialFullscreen onClose={() => setOpen(false)} />}
  </>;
}

export default function CatalogEntry({ catalogs }: { catalogs: SupplierCatalog[] }) {
  return <div className="space-y-3">{catalogs.map((catalog, index) => <CatalogCard key={catalog.id} catalog={catalog} index={index} />)}</div>;
}
