import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PortfolioCategories, PortfolioItem } from '../lib/companyData';
import { resolveImageUrl, resolveVariantUrl } from '../lib/imageUrl';
import { getImageFallbackCandidates } from '../lib/imageCleanup';

const ITEMS_PER_PAGE = 12;
const THUMB_SIZE = 16; // canvas thumbnail size for fingerprinting
const DARK_THRESHOLD = 45; // average brightness below this = too dark
const SIMILARITY_THRESHOLD = 0.92; // above this = duplicate
const MAX_ASPECT_RATIO = 3.5; // width/height above this = banner → hide
const MIN_ASPECT_RATIO = 0.25; // width/height below this = narrow strip → hide

/** Downscale image to tiny canvas and return pixel data + average brightness */
function getImageFingerprint(img: HTMLImageElement): { pixels: number[]; brightness: number } | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
    const data = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE).data;
    const pixels: number[] = [];
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      pixels.push(gray);
      totalBrightness += gray;
    }
    return { pixels, brightness: totalBrightness / pixels.length };
  } catch {
    return null; // CORS or other error
  }
}

/** Compare two fingerprints, return similarity 0-1 */
function compareFingerprints(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += 1 - Math.abs(a[i] - b[i]) / 255;
  }
  return sum / a.length;
}

interface MasonryGalleryProps {
  categories: PortfolioCategories;
  onImageClick: (url: string, categoryName: string, indexInCategory: number) => void;
  /** If set, clicking images opens this URL instead of triggering onImageClick */
  externalWebsite?: string;
}

interface FlatItem extends PortfolioItem {
  categoryName: string;
  indexInCategory: number;
}

export default function MasonryGallery({ categories, onImageClick, externalWebsite }: MasonryGalleryProps) {
  const fingerprintsRef = useRef<number[][]>([]);
  // Filter out empty categories up front
  const nonEmptyCategories = useMemo(
    () =>
      Object.entries(categories).filter(
        ([, items]) => Array.isArray(items) && items.length > 0
      ),
    [categories]
  );

  const categoryNames = useMemo(
    () => nonEmptyCategories.map(([name]) => name),
    [nonEmptyCategories]
  );

  const showAllTab = categoryNames.length > 1;

  const [activeTab, setActiveTab] = useState<string>(
    showAllTab ? 'All' : (categoryNames[0] ?? '')
  );
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset tab and pagination when categories change (e.g. navigating to a different company)
  useEffect(() => {
    setActiveTab(showAllTab ? 'All' : (categoryNames[0] ?? ''));
    setVisibleCount(ITEMS_PER_PAGE);
    fingerprintsRef.current = [];
  }, [categories]);

  // Return null if no non-empty categories
  if (nonEmptyCategories.length === 0) return null;

  // Build flat list for the active tab
  const allItems: FlatItem[] = nonEmptyCategories.flatMap(([catName, items]) =>
    items.map((item, idx) => ({
      ...item,
      categoryName: catName,
      indexInCategory: idx,
    }))
  );

  const filteredItems: FlatItem[] =
    activeTab === 'All'
      ? allItems
      : nonEmptyCategories
          .find(([name]) => name === activeTab)?.[1]
          .map((item, idx) => ({
            ...item,
            categoryName: activeTab,
            indexInCategory: idx,
          })) ?? [];

  const visibleItems = filteredItems.slice(0, visibleCount);
  const remaining = filteredItems.length - visibleCount;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setVisibleCount(ITEMS_PER_PAGE);
    fingerprintsRef.current = []; // reset fingerprints on tab switch
  };

  const tabs = showAllTab ? ['All', ...categoryNames] : categoryNames;

  const activeCount =
    activeTab === 'All' ? allItems.length : (nonEmptyCategories.find(([n]) => n === activeTab)?.[1].length ?? 0);

  return (
    <section className="py-10 lg:py-14 bg-white">
      <div>
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#1c1917]">Portfolio</h2>
          <span className="text-sm text-[#6b6b6b] tabular-nums">
            {activeCount} {activeCount === 1 ? 'image' : 'images'}
          </span>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-8">
          <div className="flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === 'All'
                  ? allItems.length
                  : nonEmptyCategories.find(([n]) => n === tab)?.[1].length ?? 0;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-[#1c1917] text-white'
                      : 'text-[#6b6b6b] hover:text-[#1c1917] hover:bg-stone-100'
                  }`}
                >
                  {tab}
                  {isActive && (
                    <span className="ml-1.5 text-xs opacity-70">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Masonry Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {visibleItems.map((item, i) => {
              const delay = Math.min(i * 0.04, 0.5);
              const primarySrc = resolveImageUrl(item.url);
              const fallbackCandidates = getImageFallbackCandidates(primarySrc);
              return (
                <motion.div
                  key={`${item.categoryName}-${item.indexInCategory}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay, ease: 'easeOut' }}
                  className="rounded-xl overflow-hidden group relative cursor-pointer"
                  onClick={() => {
                    if (externalWebsite) {
                      window.open(externalWebsite, '_blank', 'noopener,noreferrer');
                    } else {
                      onImageClick(item.url, item.categoryName, item.indexInCategory);
                    }
                  }}
                >
                  {/* Blur placeholder */}
                  <img
                    src={resolveVariantUrl(item.url, 'blur')}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg"
                  />
                  {/* Thumb image */}
                  <img
                    src={resolveVariantUrl(item.url, 'thumb')}
                    alt={item.title || `${item.categoryName} project`}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover transition-all duration-500 group-hover:scale-105 relative z-10"
                    onLoad={(e) => {
                      // Hide blur placeholder once thumb loads
                      const blurEl = e.currentTarget.previousElementSibling as HTMLElement | null;
                      if (blurEl) blurEl.style.display = 'none';

                      const img = e.currentTarget;
                      const w = img.naturalWidth;
                      const h = img.naturalHeight;
                      const container = img.closest('.rounded-xl.group') as HTMLElement | null;
                      if (!container) return;

                      // Filter extreme aspect ratios (banners / narrow strips)
                      const aspectRatio = w / h;
                      if (aspectRatio > MAX_ASPECT_RATIO || aspectRatio < MIN_ASPECT_RATIO) {
                        container.classList.add('hidden');
                        return;
                      }

                      if (w < 50 || h < 37) {
                        container.classList.add('hidden');
                        return;
                      }

                      const fp = getImageFingerprint(img);
                      if (fp) {
                        if (fp.brightness < DARK_THRESHOLD) {
                          container.classList.add('hidden');
                          return;
                        }
                        const isDuplicate = fingerprintsRef.current.some(
                          existing => compareFingerprints(existing, fp.pixels) > SIMILARITY_THRESHOLD
                        );
                        if (isDuplicate) {
                          container.classList.add('hidden');
                          return;
                        }
                        fingerprintsRef.current.push(fp.pixels);
                      }
                    }}
                    onError={(e) => {
                      const current = e.currentTarget;
                      // Fall back to original image if thumb doesn't exist
                      if (!current.dataset.fallback) {
                        current.dataset.fallback = '1';
                        current.src = primarySrc;
                        return;
                      }
                      const retryIndex = Number(current.dataset.retryIndex || '0');
                      if (retryIndex < fallbackCandidates.length - 1) {
                        const nextRetry = retryIndex + 1;
                        current.dataset.retryIndex = String(nextRetry);
                        current.src = fallbackCandidates[nextRetry];
                        return;
                      }
                      (current.closest('.rounded-xl.group') as HTMLElement | null)?.classList.add('hidden');
                    }}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors duration-300 rounded-xl" />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {item.title && (
                      <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                        {item.title}
                      </p>
                    )}
                    <p className="text-[#c6a065] text-xs mt-0.5">{item.categoryName}</p>
                    {externalWebsite && (
                      <p className="text-white/60 text-xs mt-1">View on original website &rarr;</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Load More */}
        {remaining > 0 && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
              className="px-8 py-3 rounded-full border border-stone-200 text-sm font-medium text-[#1c1917] hover:border-[#c6a065] hover:text-[#c6a065] transition-colors duration-200"
            >
              Load more ({remaining} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
