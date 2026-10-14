'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, RotateCw } from 'lucide-react';
import { resolveImageUrl, resolveVariantUrl } from '@/lib/imageUrl';

type MaterialImageProps = { src?: string | null; alt: string; eager?: boolean };

/** Keep loading, fallback and retry state scoped to the current product image. */
export default function MaterialImage(props: MaterialImageProps) {
  return <MaterialImageState key={props.src || ''} {...props} />;
}

/** Stable product image with an explicit missing/error state and an original-image retry. */
function MaterialImageState({ src, alt, eager = false }: MaterialImageProps) {
  const original = src ? resolveImageUrl(src) : '';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const variant = src ? resolveVariantUrl(src, 'medium') : '';
  const url = fallback ? original : variant;
  const imgRef = useRef<HTMLImageElement>(null);
  const handleError = useCallback(() => {
    setLoaded(false);
    if (!fallback && url !== original) setFallback(true);
    else setFailed(true);
  }, [fallback, url, original]);

  useEffect(() => {
    // SSR/cache can finish loading before React attaches the event handlers.
    // Reconcile both cached successes and cached errors on every new attempt.
    const image = imgRef.current;
    if (!image?.complete) return;
    if (image.naturalWidth > 0) setLoaded(true);
    else handleError();
  }, [url, attempt, handleError]);
  return <div className="relative h-full w-full bg-white">
    {!original || failed ? <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 px-3 text-center text-xs text-stone-600">
      <ImageOff className="h-6 w-6" aria-hidden="true" />
      <span>{original ? 'Image could not load' : 'Product image pending'}</span>
      {original && <button type="button" aria-label={`Retry image for ${alt}`} onClick={event => { event.preventDefault(); event.stopPropagation(); setFailed(false); setLoaded(false); setFallback(true); setAttempt(n => n + 1); }} className="relative z-10 inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-3 py-1 text-stone-800"><RotateCw className="h-3 w-3" />Retry</button>}
    </div> : <>
      {!loaded && <span className="absolute inset-0 flex items-center justify-center text-xs text-stone-600" role="status">Loading image…</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} key={`${url}:${attempt}`} src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} width={1200} height={900} onLoad={() => setLoaded(true)} onError={handleError} className={`relative h-full w-full object-contain ${loaded ? '' : 'opacity-0'}`} />
    </>}
  </div>;
}
