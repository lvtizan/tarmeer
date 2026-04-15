import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pool from '../config/database';
import { config } from '../config';
import { parseJsonField } from '../lib/parseJsonField';
import { ALL_PORTFOLIO_TAGS } from '../lib/tagTaxonomy';

interface ImageEntry {
  url: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}

const VALID_CATEGORIES = ALL_PORTFOLIO_TAGS as readonly string[];

let _genAI: GoogleGenerativeAI | null = null;
let _initialized = false;

function getGenAI(): GoogleGenerativeAI | null {
  if (!config.vision.enabled) return null;

  if (!_initialized) {
    _initialized = true;
    const key = config.vision.apiKey;
    if (!key) {
      console.error('[vision-tagging] GEMINI_API_KEY not set');
      return null;
    }
    try {
      _genAI = new GoogleGenerativeAI(key);
    } catch (err) {
      console.error('[vision-tagging] Failed to initialise Gemini client:', err);
    }
  }

  return _genAI;
}

export function normalizeImageEntry(entry: unknown): ImageEntry {
  if (typeof entry === 'string') return { url: entry };
  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    return {
      url: String(obj.url ?? ''),
      ai_tags:      Array.isArray(obj.ai_tags)      ? (obj.ai_tags as string[])     : undefined,
      ai_category:  Array.isArray(obj.ai_category)  ? (obj.ai_category as string[]) : undefined,
      ai_tagged_at: typeof obj.ai_tagged_at === 'string' ? obj.ai_tagged_at          : undefined,
    };
  }
  return { url: '' };
}

export function resolveAbsolutePath(imageUrl: string): string {
  const serverRoot = path.resolve(__dirname, '../../');
  return path.join(serverRoot, 'public', imageUrl);
}

export async function analyzeImage(absolutePath: string): Promise<{ labels: string[]; categories: string[] }> {
  const genAI = getGenAI();
  if (!genAI) return { labels: [], categories: [] };

  const imageData = fs.readFileSync(absolutePath);
  const base64 = imageData.toString('base64');
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const categoriesList = VALID_CATEGORIES.join(', ');
  const prompt = `Analyze this interior design / architecture image. Return ONLY a valid JSON object with no markdown, no code blocks, just raw JSON:
{
  "labels": ["up to 15 descriptive tags: materials, furniture, room features, style keywords"],
  "categories": ["pick only matching ones from: ${categoriesList}"]
}
For categories, identify both the room type (Living Room, Bedroom, Kitchen, etc.) AND the design style (Modern, Luxury, Minimalist, Classical, Arabic, Industrial, Scandinavian, Coastal, Art Deco, Bohemian). Include all that apply.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);

  const text = result.response.text().trim();

  try {
    const parsed = JSON.parse(text);
    const labels: string[] = Array.isArray(parsed.labels) ? parsed.labels.map(String) : [];
    const categories: string[] = Array.isArray(parsed.categories)
      ? parsed.categories.filter((c: string) => VALID_CATEGORIES.includes(c))
      : [];
    return { labels, categories };
  } catch {
    console.error('[vision-tagging] Failed to parse Gemini response:', text.slice(0, 200));
    return { labels: [], categories: [] };
  }
}

export async function tagProjectImages(projectId: number): Promise<void> {
  if (!config.vision.enabled) {
    console.log('[vision-tagging] Vision disabled, skipping project', projectId);
    return;
  }

  let row: Record<string, unknown>;
  try {
    const [rows] = await pool.execute<any[]>(
      'SELECT id, images, tags FROM projects WHERE id = ? LIMIT 1',
      [projectId]
    );
    if (!rows || rows.length === 0) {
      console.warn('[vision-tagging] Project not found:', projectId);
      return;
    }
    row = rows[0];
  } catch (err) {
    console.error('[vision-tagging] DB error loading project', projectId, err);
    return;
  }

  const rawImages = parseJsonField(row.images as string | null);
  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    console.log('[vision-tagging] No images for project', projectId);
    return;
  }

  const entries: ImageEntry[] = rawImages.map(normalizeImageEntry);

  const nowIso = new Date().toISOString();
  const allNewCategories: string[] = [];
  let anyUpdated = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.ai_tagged_at) continue;

    if (!entry.url || !entry.url.startsWith('/uploads/')) {
      console.log('[vision-tagging] Skipping external URL:', entry.url);
      continue;
    }

    const absolutePath = resolveAbsolutePath(entry.url);

    if (!fs.existsSync(absolutePath)) {
      console.warn('[vision-tagging] File not found:', absolutePath);
      continue;
    }

    try {
      console.log(`[vision-tagging] Analysing image ${i + 1}/${entries.length}: ${entry.url}`);
      const { labels, categories } = await analyzeImage(absolutePath);

      entries[i] = {
        ...entry,
        ai_tags:      labels,
        ai_category:  categories,
        ai_tagged_at: nowIso,
      };

      allNewCategories.push(...categories);
      anyUpdated = true;

      console.log(`[vision-tagging] Tagged: labels=${labels.length}, categories=${categories.join(', ')}`);
    } catch (err) {
      console.error('[vision-tagging] Failed to analyse image', entry.url, err);
    }
  }

  if (!anyUpdated) {
    console.log('[vision-tagging] No new images to tag for project', projectId);
    return;
  }

  const existingTags: string[] = parseJsonField(row.tags as string | null) ?? [];
  const mergedTags = Array.from(new Set([...existingTags, ...allNewCategories]));

  try {
    await pool.execute(
      'UPDATE projects SET images = ?, tags = ? WHERE id = ?',
      [JSON.stringify(entries), JSON.stringify(mergedTags), projectId]
    );
    console.log(`[vision-tagging] Project ${projectId} updated — tags: [${mergedTags.join(', ')}]`);
  } catch (err) {
    console.error('[vision-tagging] DB error saving tags for project', projectId, err);
  }
}
