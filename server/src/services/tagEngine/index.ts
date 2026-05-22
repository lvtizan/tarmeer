import path from 'path';
import fs from 'fs';
import pool from '../../config/database.js';
import { parseJsonField } from '../../lib/parseJsonField.js';
import { extractTagsFromMetadata } from './metadataTagger.js';
import { tagImageWithClip } from './onnxTagger.js';
import { mergeTags, toTagStrings } from './tagMerger.js';
import type { TaggedImage } from './types.js';

function resolveAbsolutePath(imageUrl: string): string {
  const serverRoot = path.resolve(__dirname, '../../../');
  return path.join(serverRoot, 'public', imageUrl);
}

function normalizeEntry(entry: unknown): { url: string; alreadyTagged: boolean; raw: unknown } {
  if (typeof entry === 'string') return { url: entry, alreadyTagged: false, raw: entry };
  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    return {
      url: String(obj.url ?? ''),
      alreadyTagged: !!obj.ai_tagged_at,
      raw: entry,
    };
  }
  return { url: '', alreadyTagged: false, raw: entry };
}

/**
 * Tag all images in a project. forceRetag=true skips the alreadyTagged check (for backfill).
 */
export async function tagProjectImages(projectId: number, forceRetag = false): Promise<void> {
  let row: Record<string, unknown>;
  try {
    const [rows] = await (pool as any).execute(
      'SELECT id, images, tags, style, description, title FROM projects WHERE id = ? LIMIT 1',
      [projectId]
    );
    if (!rows || rows.length === 0) return;
    row = rows[0];
  } catch (err) {
    console.error('[tag-engine] DB error loading project', projectId, err);
    return;
  }

  const rawImages = parseJsonField(row.images as string | null);
  if (!Array.isArray(rawImages) || rawImages.length === 0) return;

  const entries = rawImages.map(normalizeEntry);

  // B layer: project-level metadata shared across all images
  const metaTags = extractTagsFromMetadata({
    style: row.style as string | null,
    description: row.description as string | null,
    // Note: row.tags is not used as categoryNames input — it's the output we're computing.
    // Using it as input would create circular dependency (tags → metadata → same tags).
    categoryNames: row.title ? [String(row.title)] : [],
  });

  const nowIso = new Date().toISOString();
  const updatedEntries: unknown[] = [];
  let anyUpdated = false;

  for (const entry of entries) {
    if (!entry.url) {
      updatedEntries.push(entry.raw);
      continue;
    }

    // Already tagged and not force-retagging → keep as-is
    if (entry.alreadyTagged && !forceRetag) {
      updatedEntries.push(entry.raw);
      continue;
    }

    // C layer: only for local /uploads/ images
    let clipTags: Awaited<ReturnType<typeof tagImageWithClip>> = [];
    if (entry.url.startsWith('/uploads/')) {
      const absPath = resolveAbsolutePath(entry.url);
      if (fs.existsSync(absPath)) {
        clipTags = await tagImageWithClip(absPath);
      }
    }

    const merged = mergeTags(metaTags, clipTags);
    const categoryTags = toTagStrings(merged);

    const tagged: TaggedImage = {
      url: entry.url,
      ai_tags: clipTags.map(r => r.tag),
      ai_category: categoryTags,
      ai_tagged_at: nowIso,
    };
    updatedEntries.push(tagged);
    anyUpdated = true;
  }

  if (!anyUpdated) return;

  // Legacy string entries (alreadyTagged=false per normalizeEntry) are always re-tagged
  // above and become TaggedImage objects in updatedEntries, so their categories
  // are always captured here. Already-tagged object entries retain their ai_category field.
  const allCategories = Array.from(
    new Set(
      updatedEntries.flatMap(e =>
        e && typeof e === 'object' && Array.isArray((e as any).ai_category)
          ? (e as any).ai_category as string[]
          : []
      )
    )
  );

  try {
    await pool.execute(
      'UPDATE projects SET images = ?, tags = ? WHERE id = ?',
      [JSON.stringify(updatedEntries), JSON.stringify(allCategories), projectId]
    );
    console.log(`[tag-engine] Project ${projectId} tagged — ${updatedEntries.length} imgs, tags: [${allCategories.join(', ')}]`);
  } catch (err) {
    console.error('[tag-engine] DB error saving tags for project', projectId, err);
  }
}
