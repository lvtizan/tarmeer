'use client';

// 可复用全屏图廊弹层：大图 + 左右箭头(固定屏幕垂直中央) + 底部缩略图条(常显可点切换) + 键盘(←/→/Esc) + 锁滚动。
// 画廊(FlooringGallery)与产品卡(FloorCard)共用，保证放大交互全站一致。
import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FloorShot } from '@/lib/flooring';

export default function Lightbox({
  shots,
  alt,
  index,
  setIndex,
  onClose,
}: {
  shots: FloorShot[];
  alt: string;
  index: number;
  setIndex: (updater: (i: number) => number) => void;
  onClose: () => void;
}) {
  const go = useCallback(
    (dir: number) => setIndex((i) => (i + dir + shots.length) % shots.length),
    [shots.length, setIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  const cur = shots[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} gallery`}
    >
      {/* 关闭 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 左右箭头：固定在屏幕垂直中央（绑最外层，不随图片大小上下跳） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(-1);
        }}
        aria-label="Previous"
        className="absolute left-3 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          go(1);
        }}
        aria-label="Next"
        className="absolute right-3 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* 大图区（min-h-0 保证底部缩略图条不被挤掉） */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center px-16 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.src}
          alt={cur.alt}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>

      {/* 底部：计数 + 缩略图条（常显，点击切换） */}
      <div className="shrink-0 px-4 pb-6 pt-2" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-center text-[13px] text-white/70">
          {cur.label} · {index + 1} / {shots.length}
        </p>
        <div className="flex justify-center gap-2">
          {shots.map((s, i) => (
            <button
              key={s.kind}
              type="button"
              onClick={() => setIndex(() => i)}
              aria-label={s.label}
              className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition sm:h-20 sm:w-20 ${
                i === index ? 'border-[#b8864a]' : 'border-white/25 opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
