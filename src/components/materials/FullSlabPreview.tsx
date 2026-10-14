import SmartImage from '@/components/ui/SmartImage';

/** Decorative whole-slab reference paired with a cropped texture cover. */
export default function FullSlabPreview({ src }: { src: string }) {
  return <div className="pointer-events-none absolute bottom-2 right-2 flex w-[22%] flex-col overflow-hidden rounded-md border border-white/90 bg-white p-1 shadow-md sm:bottom-3 sm:right-3" aria-hidden="true">
    <div className="aspect-[1/3] overflow-hidden bg-white">
      <SmartImage key={src} src={src} variant="thumb" alt="" loading="lazy" width={200} height={600} className="h-full w-full object-contain" />
    </div>
    <span className="pt-1 text-center text-[8px] font-medium leading-3 text-stone-700 sm:text-[10px]">Full slab</span>
  </div>;
}
