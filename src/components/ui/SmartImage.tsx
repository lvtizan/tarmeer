import { useEffect, useMemo, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { resolveImageUrl, resolveVariantUrl } from '../../lib/imageUrl';
import { getImageFallbackCandidates } from '../../lib/imageCleanup';

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  /** When set, tries the compressed WebP variant first (e.g. -thumb.webp),
   *  falling back to the original image if the variant doesn't exist. */
  variant?: 'blur' | 'thumb' | 'medium';
};

const GLOBAL_FAILED_IMAGE_SRC = new Set<string>();
const EMPTY_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

export default function SmartImage({ src, variant, onError, ...rest }: SmartImageProps) {
  const primary = resolveImageUrl(src || '');
  const variantUrl = useMemo(
    () => (variant ? resolveVariantUrl(src || '', variant) : null),
    [src, variant]
  );
  const candidates = useMemo(() => {
    const base = getImageFallbackCandidates(primary).filter(
      (candidate) => !GLOBAL_FAILED_IMAGE_SRC.has(candidate)
    );
    if (variantUrl && variantUrl !== primary && !GLOBAL_FAILED_IMAGE_SRC.has(variantUrl)) {
      return [variantUrl, ...base];
    }
    return base;
  }, [primary, variantUrl]);
  const [idx, setIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIdx(0);
    setExhausted(false);
  }, [primary, variantUrl]);

  const displaySrc = exhausted ? EMPTY_PIXEL : candidates[idx] || primary || EMPTY_PIXEL;

  return (
    <img
      {...rest}
      src={displaySrc}
      onError={(e) => {
        if (displaySrc) {
          GLOBAL_FAILED_IMAGE_SRC.add(displaySrc);
        }
        if (idx < candidates.length - 1) {
          setIdx((prev) => prev + 1);
          return;
        }
        setExhausted(true);
        onError?.(e);
      }}
    />
  );
}
