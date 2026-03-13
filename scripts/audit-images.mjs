import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'server/src', 'public'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif']);
const URL_PATTERN = /(https?:\/\/[^\s"'`)>]+|\/[^\s"'`)>]+\.(?:png|jpe?g|gif|webp|svg|ico|avif))/gi;
const SEED_AVATAR_IDS = [
  'photo-1472099645785-5658abf4ff4e',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1494790108377-be9c29b29330',
  'photo-1519085360753-af0119f7cbe7',
  'photo-1500648767791-00dcc994a43e',
  'photo-1573496359142-b8d87734a5a2',
];

function imageDedupKey(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  try {
    if (trimmed.startsWith('/')) {
      return trimmed.split('?')[0];
    }
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed.split('?')[0];
  }
}

function isSeedAvatar(url) {
  const key = imageDedupKey(url);
  return SEED_AVATAR_IDS.some((id) => key.includes(id));
}

function isImageLikeUrl(url) {
  if (!url) return false;
  if (url.startsWith('/')) return IMAGE_EXTENSIONS.has(path.extname(url.split('?')[0]).toLowerCase());

  try {
    const parsed = new URL(url);
    if (['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
    if (['wa.me', 'www.google.com', 'instagram.com', 'www.instagram.com', 'fonts.gstatic.com'].includes(parsed.hostname)) {
      return false;
    }

    return parsed.hostname === 'images.unsplash.com'
      || IMAGE_EXTENSIONS.has(path.extname(parsed.pathname).toLowerCase());
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(absolutePath));
      continue;
    }
    if (entry.name.includes('.test.')) continue;
    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(absolutePath);
    }
  }

  return out;
}

async function collectReferences() {
  const refs = [];
  for (const dir of SCAN_DIRS) {
    const absDir = path.join(ROOT, dir);
    const files = await walk(absDir);
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const matches = content.match(URL_PATTERN) || [];
      for (const rawUrl of matches) {
        const url = rawUrl.replace(/[),;]+$/, '');
        if (!isImageLikeUrl(url)) continue;
        refs.push({ url, file: path.relative(ROOT, file) });
      }
    }
  }
  return refs;
}

async function checkRemoteUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkLocalUrl(url) {
  const relative = url.startsWith('/') ? url.slice(1) : url;
  const publicPath = path.join(ROOT, 'public', relative);
  try {
    const stat = await fs.stat(publicPath);
    return stat.isFile() && IMAGE_EXTENSIONS.has(path.extname(publicPath).toLowerCase());
  } catch {
    return false;
  }
}

const refs = await collectReferences();
const byKey = new Map();
const seedAvatarRefs = [];

for (const ref of refs) {
  const key = imageDedupKey(ref.url);
  if (!key) continue;
  if (!byKey.has(key)) {
    byKey.set(key, { key, urls: new Set(), files: new Set() });
  }
  byKey.get(key).urls.add(ref.url);
  byKey.get(key).files.add(ref.file);

  if (isSeedAvatar(ref.url)) {
    seedAvatarRefs.push(ref);
  }
}

const duplicates = Array.from(byKey.values())
  .filter((item) => item.files.size > 1 || item.urls.size > 1)
  .sort((a, b) => b.files.size - a.files.size);

const broken = [];
for (const item of byKey.values()) {
  const [sampleUrl] = Array.from(item.urls);
  const ok = sampleUrl.startsWith('http')
    ? await checkRemoteUrl(sampleUrl)
    : await checkLocalUrl(sampleUrl);
  if (!ok) {
    broken.push({
      url: sampleUrl,
      files: Array.from(item.files),
    });
  }
}

console.log('Image audit summary');
console.log(`- References found: ${refs.length}`);
console.log(`- Unique image keys: ${byKey.size}`);
console.log(`- Duplicate image keys: ${duplicates.length}`);
console.log(`- Broken image keys: ${broken.length}`);
console.log(`- Seed avatar refs: ${seedAvatarRefs.length}`);

if (duplicates.length) {
  console.log('\nTop duplicate image keys:');
  for (const item of duplicates.slice(0, 20)) {
    console.log(`- ${item.key}`);
    console.log(`  files: ${Array.from(item.files).join(', ')}`);
  }
}

if (broken.length) {
  console.log('\nBroken image references:');
  for (const item of broken.slice(0, 20)) {
    console.log(`- ${item.url}`);
    console.log(`  files: ${item.files.join(', ')}`);
  }
}

if (seedAvatarRefs.length) {
  console.log('\nSeed avatar references:');
  for (const item of seedAvatarRefs.slice(0, 20)) {
    console.log(`- ${item.url}`);
    console.log(`  file: ${item.file}`);
  }
}
