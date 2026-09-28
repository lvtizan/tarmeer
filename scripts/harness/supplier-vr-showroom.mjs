#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [detail, showroom] = await Promise.all([
  readFile('src/components/materials/SupplierDetailClient.tsx', 'utf8'),
  readFile('src/components/materials/SupplierVrShowroom.tsx', 'utf8'),
]);

const checks = [
  ['VR is scoped to supplier-1127', detail.includes("'supplier-1127': 'https://realsee.ai/lq22JMMX'")],
  ['VR is restricted to the AE site', detail.includes("country.code === 'ae' ? SUPPLIER_VR_SHOWROOMS[slug] : undefined")],
  ['other suppliers render no empty VR section', detail.includes('{vrShowroomUrl && (')],
  ['VR navigation appears only when configured', detail.includes("label: 'VR Showroom'") && detail.includes('count: vrShowroomUrl ? 1 : 0')],
  ['VR tab is wired to the VR section ref', /\{ key: 'vr' as const,[^}]*ref: vrShowroomRef \}/.test(detail)],
  ['trusted Realsee URL is embedded', showroom.includes('src={url}')],
  ['iframe has an accessible title', showroom.includes('title="Supplier VR showroom"')],
  ['iframe is lazy loaded', showroom.includes('loading="lazy"')],
  ['iframe supports full screen', showroom.includes('allowFullScreen') && showroom.includes('fullscreen; accelerometer; gyroscope')],
  ['iframe has an explicit sandbox without popup escape', showroom.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"') && !showroom.includes('allow-popups-to-escape-sandbox')],
  ['iframe uses a strict referrer policy', showroom.includes('referrerPolicy="strict-origin-when-cross-origin"')],
  ['mobile and desktop aspect ratios are responsive', showroom.includes('aspect-[4/5]') && showroom.includes('sm:aspect-video')],
  ['coarse-pointer iframe starts with page scrolling enabled', showroom.includes('@media (hover: none) and (pointer: coarse)') && showroom.includes(".vr-frame[data-vr-active='false'] { pointer-events: none; }")],
  ['mobile users can activate and exit VR interaction', showroom.includes('Tap to explore VR') && showroom.includes('Resume scrolling')],
  ['full-screen fallback is safe', showroom.includes('target="_blank"') && showroom.includes('rel="noopener noreferrer"')],
];

for (const [label, passed] of checks) assert.ok(passed, label);

const response = await fetch('https://realsee.ai/lq22JMMX', {
  redirect: 'follow',
  signal: AbortSignal.timeout(10_000),
});
assert.equal(response.status, 200, 'Realsee VR destination is reachable');

console.log(`${checks.length + 1}/${checks.length + 1} PASS — supplier-specific VR scope, responsive embed, security and destination`);
