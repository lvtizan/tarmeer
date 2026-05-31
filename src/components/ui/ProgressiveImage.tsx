'use client';

import { useState, useRef, useEffect } from 'react';

interface ProgressiveImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  blur?: string;        // inline base64 blur placeholder
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}

/**
 * Progressive image with instant blur placeholder → HD fade-in.
 */
export default function ProgressiveImage({
  src, srcSet, sizes, blur, alt, className = '', loading = 'eager', fetchPriority = 'auto',
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle case where image is already cached (onLoad won't fire)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder — instant, inline base64 */}
      {blur && (
        <img
          src={blur}
          alt=""
          aria-hidden
          className={`absolute inset-0 w-full h-full object-cover scale-110 transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
          style={{ filter: 'blur(20px)' }}
        />
      )}

      {/* Real image — fades in when loaded */}
      <img
        ref={imgRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
