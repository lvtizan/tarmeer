'use client';

import { useState } from 'react';
import { Box, MapPin, MousePointer2 } from 'lucide-react';
import MallVisitTrigger from './MallVisitTrigger';

const ROOMS = [
  {
    key: 'main-hall',
    label: 'Main Hall',
    title: 'Enter the material showroom',
    description: 'Look around the exhibition floor and understand the scale, layout and range before speaking with the manufacturer.',
    image: 'vr-showroom-main',
  },
  {
    key: 'backlit-slabs',
    label: 'Backlit Slabs',
    title: 'Inspect colour and translucency',
    description: 'Move closer to illuminated slabs to compare tone, veining and how each surface behaves under light.',
    image: 'vr-showroom-slabs',
  },
  {
    key: 'stone-gallery',
    label: 'Stone Gallery',
    title: 'Compare the full material wall',
    description: 'Review adjacent slabs as a collection, then shortlist the finishes worth sampling or seeing in person.',
    image: 'vr-showroom-gallery',
  },
] as const;

export default function MallDigitalShowroom() {
  const [activeKey, setActiveKey] = useState<(typeof ROOMS)[number]['key']>('main-hall');
  const active = ROOMS.find((room) => room.key === activeKey) ?? ROOMS[0];

  return (
    <section id="digital-showroom" className="scroll-mt-20 bg-[#171513] py-16 text-white sm:py-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d2aa73]">Real VR Showroom Preview</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-[46px]">
              Preview the showroom before you travel
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/65 sm:text-base">
              These are real views from a Chinese manufacturer&apos;s immersive VR showroom. Preview three areas here, then ask our team for the full VR experience or a physical sample.
            </p>
          </div>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[24px] border border-white/10 bg-black sm:rounded-[32px]">
          <div className="relative aspect-[4/3] sm:aspect-[16/9]">
            <img
              key={active.image}
              src={`/images/mall/${active.image}-medium.webp`}
              srcSet={`/images/mall/${active.image}-thumb.webp 600w, /images/mall/${active.image}-medium.webp 1200w, /images/mall/${active.image}.webp 2000w`}
              sizes="100vw"
              alt={`${active.title} inside a Chinese stone manufacturer's VR showroom`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                backgroundImage: `url(/images/mall/${active.image}-blur.webp)`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,13,12,0.82)_0%,rgba(15,13,12,0.40)_45%,rgba(15,13,12,0.06)_75%)]" />

            <div className="absolute inset-x-0 bottom-0 p-5 sm:inset-y-0 sm:left-0 sm:right-auto sm:flex sm:w-[46%] sm:items-end sm:p-10 lg:p-14">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
                  <MousePointer2 className="h-3.5 w-3.5 text-[#d2aa73]" /> VR preview viewpoint
                </span>
                <h3 className="mt-4 font-serif text-2xl font-semibold sm:text-3xl">{active.title}</h3>
                <p className="mt-2 hidden max-w-md text-sm leading-6 text-white/65 sm:block">{active.description}</p>
                <MallVisitTrigger
                  label="Ask about the full VR showroom"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#171513] transition hover:bg-[#f1e7d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa73]"
                />
              </div>
            </div>

            <div className="absolute right-4 top-4 hidden items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 text-xs text-white/70 backdrop-blur-md sm:flex">
              <Box className="h-4 w-4 text-[#d2aa73]" /> Real showroom · China
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="VR showroom preview viewpoints">
          {ROOMS.map((room, index) => (
            <button
              key={room.key}
              type="button"
              onClick={() => setActiveKey(room.key)}
              aria-pressed={active.key === room.key}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2aa73] ${
                active.key === room.key
                  ? 'border-[#d2aa73]/70 bg-white/10 text-white'
                  : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-[#d2aa73]">
                {index + 1}
              </span>
              <span>
                <span className="block text-[10px] uppercase tracking-[0.16em] text-white/40">Viewpoint</span>
                <span className="mt-0.5 block text-sm font-medium">{room.label}</span>
              </span>
              <MapPin className="ml-auto h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
