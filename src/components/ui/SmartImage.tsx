import { useEffect, useMemo, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { resolveImageUrl } from '../../lib/imageUrl';
import { getImageFallbackCandidates } from '../../lib/imageCleanup';

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

export default function SmartImage({ src, onError, ...rest }: SmartImageProps) {
  const primary = resolveImageUrl(src || '');
  const candidates = useMemo(() => getImageFallbackCandidates(primary), [primary]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [primary]);

  const displaySrc = candidates[idx] || primary;

  return (
    <img
      {...rest}
      src={displaySrc}
      onError={(e) => {
        if (idx < candidates.length - 1) {
          setIdx((prev) => prev + 1);
          return;
        }
        onError?.(e);
      }}
    />
  );
}
