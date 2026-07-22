'use client';

// L3 详情图廊：主图 + 缩略图切换（拼花板 / 场景 / 细节纹理）。细节图保原尺，放大看纹理不糊。
import { useState } from 'react';

type Shot = { kind: string; src: string; label: string };

export default function FlooringGallery({ shots, alt }: { shots: Shot[]; alt: string }) {
  const [active, setActive] = useState(0);
  const cur = shots[active];

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.src}
          alt={`${alt} — ${cur.label}`}
          className="h-auto w-full object-cover"
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {shots.map((s, i) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => setActive(i)}
            aria-label={s.label}
            className={`overflow-hidden rounded-xl border-2 bg-stone-100 transition ${
              i === active ? 'border-[#b8864a]' : 'border-transparent hover:border-stone-300'
            }`}
          >
            <div className="aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.label} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
