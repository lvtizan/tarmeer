#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/kp/Code/tarmeer-4.0-local';
const API_BASE = process.env.BLOG_IMAGE_SOURCE_API || 'https://www.tarmeer.com/api';
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'blog', 'articles');
const MANIFEST_PATH = path.join(ROOT, 'server', 'src', 'data', 'blogImageManifest.json');

function normalizeKey(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function extractMarkdownImageUrls(markdown) {
  return Array.from(markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g), (match) => match[1]);
}

function extFromContentType(contentType) {
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/avif')) return '.avif';
  return '.jpg';
}

async function writeBinaryFile(targetPath, buffer) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o755 });
  await fs.writeFile(targetPath, buffer, { mode: 0o644 });
  await fs.chmod(targetPath, 0o644);
}

async function fetchAllArticles() {
  const firstPage = await fetch(`${API_BASE}/articles/public?page=1&limit=100`).then((res) => res.json());
  return firstPage.articles || [];
}

async function fetchArticle(slug) {
  const payload = await fetch(`${API_BASE}/articles/public/${slug}`).then((res) => res.json());
  return payload.article;
}

async function downloadImage(url, targetBasePath) {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = extFromContentType(response.headers.get('content-type') || '');
  const outputPath = `${targetBasePath}${extension}`;
  await writeBinaryFile(outputPath, buffer);
  return outputPath.slice(path.join(ROOT, 'public').length).replace(/\\/g, '/');
}

async function main() {
  const articles = await fetchAllArticles();
  const manifest = {};

  for (const summary of articles) {
    const article = await fetchArticle(summary.slug);
    if (!article) continue;

    const imageUrls = [];
    if (article.cover_image && /^https?:\/\//i.test(article.cover_image)) {
      imageUrls.push({ url: article.cover_image, name: 'cover' });
    }

    extractMarkdownImageUrls(article.content || '').forEach((url, index) => {
      if (/^https?:\/\//i.test(url)) {
        imageUrls.push({ url, name: `image-${index + 1}` });
      }
    });

    if (!imageUrls.length) continue;

    const slugManifest = { images: {}, missing: [] };
    for (const image of imageUrls) {
      const normalizedKey = normalizeKey(image.url);
      if (slugManifest.images[normalizedKey]) {
        continue;
      }
      const relativePath = await downloadImage(
        image.url,
        path.join(OUTPUT_DIR, article.slug, image.name)
      );
      if (!relativePath) {
        console.warn(`Skipped unavailable image for ${article.slug}: ${image.url}`);
        slugManifest.missing.push(normalizedKey);
        continue;
      }
      slugManifest.images[normalizedKey] = relativePath;
    }

    if (Object.keys(slugManifest.images).length > 0 || slugManifest.missing.length > 0) {
      manifest[article.slug] = slugManifest;
    }
  }

  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true, mode: 0o755 });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o644 });
  await fs.chmod(MANIFEST_PATH, 0o644);

  console.log(`Mirrored ${Object.keys(manifest).length} articles to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
