import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import pool from '../config/database';
import { config } from '../config';
import { parseJsonField } from '../lib/parseJsonField';

// ============================================================
// Types
// ============================================================

interface ImageEntry {
  url: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}

// ============================================================
// Category map — Vision labels → 14 semantic categories
// ============================================================

const CATEGORY_MAP: Record<string, string[]> = {
  Kitchen:     ['kitchen', 'countertop', 'cabinet', 'sink', 'cooking', 'stove', 'oven'],
  Bathroom:    ['bathroom', 'shower', 'bathtub', 'toilet', 'vanity', 'faucet'],
  Living:      ['living room', 'sofa', 'couch', 'lounge', 'television', 'fireplace'],
  Bedroom:     ['bedroom', 'bed', 'mattress', 'pillow', 'wardrobe', 'nightstand'],
  Villa:       ['villa', 'mansion', 'estate', 'facade', 'exterior', 'house'],
  Apartment:   ['apartment', 'flat', 'condo', 'balcony', 'high-rise'],
  Majlis:      ['majlis', 'arabic', 'traditional', 'cushion'],
  Dining:      ['dining', 'dining room', 'dining table', 'chandelier'],
  Outdoor:     ['outdoor', 'garden', 'pool', 'swimming pool', 'patio', 'terrace', 'landscape'],
  Lighting:    ['lighting', 'lamp', 'chandelier', 'pendant light', 'sconce', 'ceiling light'],
  Storage:     ['storage', 'closet', 'shelf', 'bookcase', 'drawer', 'cabinet'],
  Renovation:  ['renovation', 'construction', 'remodel', 'building'],
  Materials:   ['marble', 'wood', 'tile', 'stone', 'granite', 'ceramic', 'glass', 'concrete'],
  Workspace:   ['office', 'desk', 'workspace', 'study', 'computer', 'monitor'],
};

// ============================================================
// Singleton Vision client
// ============================================================

let _client: ImageAnnotatorClient | null = null;
let _clientInitialized = false;

export function getClient(): ImageAnnotatorClient | null {
  if (!config.vision.enabled) return null;

  if (!_clientInitialized) {
    _clientInitialized = true;
    try {
      const opts = config.vision.credentialsPath
        ? { keyFilename: config.vision.credentialsPath }
        : {};
      _client = new ImageAnnotatorClient(opts);
    } catch (err) {
      console.error('[vision-tagging] Failed to initialise Vision client:', err);
      _client = null;
    }
  }

  return _client;
}

// ============================================================
// Helpers
// ============================================================

export function normalizeImageEntry(entry: unknown): ImageEntry {
  if (typeof entry === 'string') {
    return { url: entry };
  }
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

export function mapToCategories(labels: string[]): string[] {
  const matched = new Set<string>();
  const lowerLabels = labels.map(l => l.toLowerCase());

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (lowerLabels.some(label => label.includes(keyword))) {
        matched.add(category);
        break;
      }
    }
  }

  return Array.from(matched);
}

export function resolveAbsolutePath(imageUrl: string): string {
  // imageUrl is like /uploads/projects/1/2/2026/04/uuid.jpg
  const serverRoot = path.resolve(__dirname, '../../');
  return path.join(serverRoot, 'public', imageUrl);
}

export async function analyzeImage(absolutePath: string): Promise<{ labels: string[] }> {
  const client = getClient();
  if (!client) return { labels: [] };

  const [result] = await client.annotateImage({
    image: { source: { filename: absolutePath } },
    features: [
      { type: 'LABEL_DETECTION',      maxResults: config.vision.maxLabels },
      { type: 'OBJECT_LOCALIZATION',  maxResults: config.vision.maxLabels },
    ],
  });

  const seen = new Set<string>();
  const labels: string[] = [];

  const addLabel = (description: string | null | undefined, score: number | null | undefined) => {
    if (!description) return;
    const confidence = score ?? 0;
    if (confidence < config.vision.minConfidence) return;
    const key = description.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(description);
  };

  for (const annotation of result.labelAnnotations ?? []) {
    addLabel(annotation.description, annotation.score);
  }
  for (const obj of result.localizedObjectAnnotations ?? []) {
    addLabel(obj.name, obj.score);
  }

  return { labels };
}

// ============================================================
// Main entry point
// ============================================================

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

    // Skip already tagged
    if (entry.ai_tagged_at) continue;

    // Skip external URLs (not hosted on this server)
    if (!entry.url || !entry.url.startsWith('/uploads/')) {
      console.log('[vision-tagging] Skipping external URL:', entry.url);
      continue;
    }

    const absolutePath = resolveAbsolutePath(entry.url);

    try {
      console.log(`[vision-tagging] Analysing image ${i + 1}/${entries.length}: ${entry.url}`);
      const { labels } = await analyzeImage(absolutePath);

      const categories = mapToCategories(labels);

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
      // Continue with remaining images
    }
  }

  if (!anyUpdated) {
    console.log('[vision-tagging] No new images to tag for project', projectId);
    return;
  }

  // Merge new categories into existing project tags
  const existingTags: string[] = parseJsonField(row.tags as string | null) ?? [];
  const mergedTags = Array.from(new Set([...existingTags, ...allNewCategories]));

  try {
    await pool.execute(
      'UPDATE projects SET images = ?, tags = ? WHERE id = ?',
      [JSON.stringify(entries), JSON.stringify(mergedTags), projectId]
    );
    console.log(
      `[vision-tagging] Project ${projectId} updated — tags: [${mergedTags.join(', ')}]`
    );
  } catch (err) {
    console.error('[vision-tagging] DB error saving tags for project', projectId, err);
  }
}
