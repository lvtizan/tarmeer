'use client';

import { useState } from 'react';
import { ExternalLink, Maximize2 } from 'lucide-react';

interface SupplierVrShowroomProps {
  url: string;
}

export default function SupplierVrShowroom({ url }: SupplierVrShowroomProps) {
  const [mobileVrActive, setMobileVrActive] = useState(false);

  return (
    <section className="border-t border-stone-200 bg-[#171513] py-12 text-white sm:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d2aa73]">
              Immersive digital showroom
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
              Step inside the VR showroom
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              Walk through the manufacturer&apos;s showroom online and inspect the material displays from every angle.
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition hover:border-[#d2aa73] hover:text-[#d2aa73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa73] sm:self-auto"
          >
            Open full screen <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.35)] sm:aspect-video sm:rounded-[30px]">
          <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 backdrop-blur-md">
            <Maximize2 className="h-3.5 w-3.5 text-[#d2aa73]" aria-hidden="true" />
            Live VR experience
          </div>
          <iframe
            src={url}
            title="Supplier VR showroom"
            loading="lazy"
            allow="fullscreen; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            data-vr-active={mobileVrActive}
            className="vr-frame h-full w-full border-0"
          />
          {!mobileVrActive ? (
            <button
              type="button"
              onClick={() => setMobileVrActive(true)}
              className="vr-touch-activate absolute inset-0 z-20 hidden items-center justify-center bg-black/10"
              aria-label="Activate interactive VR showroom"
            >
              <span className="rounded-full border border-white/30 bg-black/70 px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-md">
                Tap to explore VR
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMobileVrActive(false)}
              className="vr-touch-resume absolute right-3 top-3 z-20 hidden rounded-full border border-white/25 bg-black/75 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
            >
              Resume scrolling
            </button>
          )}
        </div>
      </div>
      <style jsx>{`
        @media (hover: none) and (pointer: coarse) {
          .vr-frame[data-vr-active='false'] { pointer-events: none; }
          .vr-touch-activate { display: flex; }
          .vr-touch-resume { display: block; }
        }
      `}</style>
    </section>
  );
}
