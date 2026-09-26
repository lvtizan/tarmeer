#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const files = {
  page: 'src/app/mall/page.tsx',
  showroom: 'src/components/mall/MallDigitalShowroom.tsx',
  drawer: 'src/components/mall/MallVisitDrawer.tsx',
  trigger: 'src/components/mall/MallVisitTrigger.tsx',
  sticky: 'src/components/mall/MallMobileStickyCta.tsx',
};

const [page, showroom, drawer, trigger, sticky] = await Promise.all(
  Object.values(files).map((file) => readFile(file, 'utf8')),
);

const checks = [
  ['AE country gate remains in place', /if \(c\.code !== 'ae'\) notFound\(\)/.test(page)],
  ['online China showroom path is explained', page.includes('Explore China digitally')],
  ['UAE material center path is explained', page.includes('Touch materials locally')],
  ['China factory visit path is explained', page.includes('Visit factories in person')],
  ['sourcing and inspection are included', page.includes('Source & inspect')],
  ['delivery and support are included', page.includes('Deliver & support')],
  ['real VR imagery is used in the hero', page.includes('/images/mall/vr-showroom-main-medium.webp')],
  ['responsive image sources are supplied', page.includes('vr-showroom-main-thumb.webp 600w')],
  ['hero image is eagerly loaded', /loading="eager"[\s\S]*fetchPriority="high"/.test(page)],
  ['mobile has a fixed consultation action', sticky.includes('fixed inset-x-3') && sticky.includes('sm:hidden')],
  ['mobile action clears the footer', sticky.includes("document.querySelector('footer')") && sticky.includes('IntersectionObserver')],
  ['old inline contact form is not rendered', !page.includes('<HomeContactForm')],
  ['VR section is explicitly presented as a preview', showroom.includes('Real VR Showroom Preview') && showroom.includes('immersive VR showroom')],
  ['all three VR images are represented', ['vr-showroom-main', 'vr-showroom-slabs', 'vr-showroom-gallery'].every((name) => showroom.includes(name))],
  ['viewpoint buttons expose selected state', showroom.includes('aria-pressed={active.key === room.key}')],
  ['VR images lazy-load below the fold', showroom.includes('loading="lazy"')],
  ['VR images include blur placeholders', showroom.includes('-blur.webp')],
  ['VR section offers the full experience without claiming it is embedded', showroom.includes('Ask about the full VR showroom')],
  ['drawer is an accessible named modal dialog', /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="mall-visit-title"/.test(drawer)],
  ['drawer supports Escape', drawer.includes("event.key === 'Escape'")],
  ['drawer traps keyboard focus', drawer.includes("event.key !== 'Tab'")],
  ['drawer locks background scrolling', drawer.includes("document.body.style.overflow = 'hidden'")],
  ['drawer restores trigger focus', drawer.includes('returnFocusRef.current?.focus()')],
  ['drawer stays mounted to preserve draft input', drawer.includes("open ? 'visible' : 'pointer-events-none invisible'")],
  ['drawer uses the shared sourcing form', drawer.includes('<SourcingRequestForm') && drawer.includes('variant="sourcing"')],
  ['all CTAs share one open event', trigger.includes("tarmeer:open-mall-visit") && drawer.includes('OPEN_MALL_VISIT_EVENT')],
];

for (const [label, passed] of checks) assert.ok(passed, label);

for (const name of ['main', 'slabs', 'gallery']) {
  for (const suffix of ['-blur', '-thumb', '-medium', '']) {
    await access(`public/images/mall/vr-showroom-${name}${suffix}.webp`);
  }
}

console.log(`${checks.length + 12}/${checks.length + 12} PASS — mall brochure, VR showroom, responsive conversion and image variants`);
