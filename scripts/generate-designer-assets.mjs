import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'public', 'images', 'designers');
const avatarDir = path.join(outDir, 'avatars');
const projectDir = path.join(outDir, 'projects');

const designers = [
  {
    slug: 'salma-nasser',
    name: 'Salma Nasser',
    palette: ['#D8B36A', '#F6EFE2', '#8C5A3C', '#2C211A'],
    scenes: ['Palm Villa', 'Majlis Suite', 'Marina Kitchen', 'Gallery Hall', 'Stone Ensuite', 'Terrace Lounge'],
  },
  {
    slug: 'omar-al-fayed',
    name: 'Omar Al Fayed',
    palette: ['#567C73', '#EDF3EF', '#C4934F', '#213432'],
    scenes: ['Creek Loft', 'Oak Kitchen', 'Family Salon', 'Calm Bedroom', 'Library Study', 'Roof Garden'],
  },
  {
    slug: 'hana-idris',
    name: 'Hana Idris',
    palette: ['#7A5C91', '#F5F0FA', '#D2A26D', '#2F2340'],
    scenes: ['Pearl Foyer', 'Skyline Dining', 'Spa Bath', 'Dressing Room', 'Reading Corner', 'Kids Lounge'],
  },
  {
    slug: 'daniel-kovac',
    name: 'Daniel Kovac',
    palette: ['#4B6482', '#EEF3F8', '#C9A25C', '#1E2835'],
    scenes: ['Minimal Living', 'Walnut Kitchen', 'Atrium Stair', 'Cinema Room', 'Guest Suite', 'Outdoor Deck'],
  },
  {
    slug: 'mariam-kassem',
    name: 'Mariam Kassem',
    palette: ['#B66E5A', '#FBF0EC', '#7A8D63', '#331E19'],
    scenes: ['Desert Villa', 'Warm Dining', 'Studio Office', 'Powder Room', 'Courtyard Tea', 'Master Suite'],
  },
];

function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarSvg(name, colors) {
  const [accent, base, mid, text] = colors;
  const badge = initials(name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="960" height="960" viewBox="0 0 960 960" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="960" fill="${base}"/>
  <circle cx="480" cy="480" r="400" fill="url(#bg)"/>
  <circle cx="480" cy="360" r="170" fill="${accent}" opacity="0.95"/>
  <path d="M225 760C250 610 350 540 480 540C610 540 710 610 735 760" fill="${mid}"/>
  <circle cx="420" cy="340" r="14" fill="${text}"/>
  <circle cx="540" cy="340" r="14" fill="${text}"/>
  <path d="M410 420C435 442 460 452 480 452C500 452 525 442 550 420" stroke="${text}" stroke-width="18" stroke-linecap="round"/>
  <circle cx="690" cy="220" r="92" fill="${text}" opacity="0.1"/>
  <circle cx="270" cy="720" r="58" fill="${accent}" opacity="0.18"/>
  <rect x="82" y="96" width="164" height="72" rx="36" fill="${text}" opacity="0.12"/>
  <text x="164" y="142" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="${text}">TARMEER</text>
  <text x="480" y="840" text-anchor="middle" font-family="Georgia, serif" font-size="76" fill="${text}">${name}</text>
  <text x="480" y="905" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" letter-spacing="8" fill="${text}" opacity="0.78">INTERIOR DESIGNER</text>
  <circle cx="770" cy="760" r="74" fill="${accent}"/>
  <text x="770" y="785" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="${base}">${badge}</text>
  <defs>
    <linearGradient id="bg" x1="140" y1="140" x2="780" y2="820" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accent}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>
  </defs>
</svg>`;
}

function projectSvg(name, scene, order, colors) {
  const [accent, base, mid, text] = colors;
  const panel = order % 2 === 0 ? accent : mid;
  const support = order % 2 === 0 ? mid : accent;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="1000" viewBox="0 0 1600 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="1000" fill="${base}"/>
  <rect x="0" y="0" width="1600" height="620" fill="url(#wall)"/>
  <rect x="0" y="620" width="1600" height="380" fill="${panel}" opacity="0.18"/>
  <rect x="120" y="150" width="980" height="430" rx="32" fill="${base}" opacity="0.92"/>
  <rect x="170" y="210" width="320" height="250" rx="18" fill="${support}" opacity="0.82"/>
  <rect x="540" y="210" width="500" height="36" rx="18" fill="${text}" opacity="0.14"/>
  <rect x="540" y="278" width="420" height="24" rx="12" fill="${text}" opacity="0.12"/>
  <rect x="540" y="332" width="360" height="24" rx="12" fill="${text}" opacity="0.1"/>
  <rect x="540" y="386" width="390" height="24" rx="12" fill="${text}" opacity="0.1"/>
  <rect x="1240" y="160" width="220" height="280" rx="110" fill="${accent}" opacity="0.18"/>
  <rect x="180" y="680" width="460" height="200" rx="26" fill="${panel}" opacity="0.88"/>
  <rect x="700" y="700" width="240" height="140" rx="22" fill="${support}" opacity="0.72"/>
  <rect x="980" y="650" width="420" height="230" rx="28" fill="${text}" opacity="0.08"/>
  <rect x="1040" y="708" width="210" height="26" rx="13" fill="${text}" opacity="0.16"/>
  <rect x="1040" y="758" width="280" height="18" rx="9" fill="${text}" opacity="0.12"/>
  <rect x="1040" y="800" width="240" height="18" rx="9" fill="${text}" opacity="0.12"/>
  <text x="180" y="785" font-family="Georgia, serif" font-size="64" fill="${base}">${scene}</text>
  <text x="180" y="842" font-family="Arial, sans-serif" font-size="28" letter-spacing="5" fill="${base}" opacity="0.85">DESIGN STUDY ${String(order).padStart(2, '0')}</text>
  <text x="120" y="92" font-family="Arial, sans-serif" font-size="26" letter-spacing="6" fill="${text}" opacity="0.65">TARMEER CASE IMAGE</text>
  <text x="120" y="950" font-family="Arial, sans-serif" font-size="26" letter-spacing="4" fill="${text}" opacity="0.8">${name.toUpperCase()}</text>
  <defs>
    <linearGradient id="wall" x1="1600" y1="0" x2="0" y2="620" gradientUnits="userSpaceOnUse">
      <stop stop-color="${accent}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${base}"/>
    </linearGradient>
  </defs>
</svg>`;
}

await ensureDir(avatarDir);
await ensureDir(projectDir);

for (const designer of designers) {
  await fs.writeFile(
    path.join(avatarDir, `${designer.slug}.svg`),
    avatarSvg(designer.name, designer.palette),
    'utf8'
  );

  for (let i = 0; i < designer.scenes.length; i++) {
    await fs.writeFile(
      path.join(projectDir, `${designer.slug}-${String(i + 1).padStart(2, '0')}.svg`),
      projectSvg(designer.name, designer.scenes[i], i + 1, designer.palette),
      'utf8'
    );
  }
}

console.log(`Generated ${designers.length} avatars and ${designers.length * 6} project images in ${outDir}`);
