import type { TagResult } from './types';

/** B layer takes priority. C layer fills in what B didn't cover. Deduplicates by tag name. */
export function mergeTags(metaTags: TagResult[], clipTags: TagResult[]): TagResult[] {
  const seen = new Map<string, TagResult>();
  for (const r of metaTags) seen.set(r.tag, r);
  for (const r of clipTags) {
    if (!seen.has(r.tag)) seen.set(r.tag, r);
  }
  return Array.from(seen.values());
}

export function toTagStrings(merged: TagResult[]): string[] {
  return merged.map(r => r.tag);
}
