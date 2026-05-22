// server/src/services/tagEngine/metadataTagger.ts
import type { TagResult } from './types';

interface MetadataInput {
  style: string | null;
  description: string | null;
  categoryNames: string[];
}

const ROOM_KEYWORDS: Record<string, string[]> = {
  'Living Room': ['living room', 'living', 'lounge', 'sitting room', 'reception', 'salon'],
  'Bedroom':     ['bedroom', 'bed room', 'master bedroom', 'master', 'sleeping'],
  'Kitchen':     ['kitchen', 'cooking', 'culinary'],
  'Bathroom':    ['bathroom', 'bath room', 'toilet', 'washroom', 'shower'],
  'Dining Room': ['dining room', 'dining', 'dinner room'],
  'Home Office': ['home office', 'office', 'study', 'workspace', 'library'],
  'Majlis':      ['majlis', 'مجلس'],
  'Hallway':     ['hallway', 'corridor', 'entrance', 'foyer', 'lobby', 'entryway'],
  'Nursery':     ['nursery', "kids' room", "children's room", 'playroom', 'kids room'],
  'Outdoor':     ['outdoor', 'garden', 'pool', 'terrace', 'balcony', 'exterior', 'landscape'],
};

const STYLE_KEYWORDS: Record<string, string[]> = {
  'Modern':       ['modern', 'contemporary'],
  'Luxury':       ['luxury', 'luxurious', 'premium', 'high-end', 'villa', 'palace', 'penthouse'],
  'Minimalist':   ['minimalist', 'minimal', 'clean lines', 'simple'],
  'Classical':    ['classical', 'classic', 'traditional', 'european', 'victorian', 'baroque'],
  'Arabic':       ['arabic', 'arabic style', 'islamic', 'oriental', 'arab', 'majlis'],
  'Industrial':   ['industrial', 'loft', 'warehouse', 'raw'],
  'Scandinavian': ['scandinavian', 'nordic', 'scandi', 'hygge'],
  'Coastal':      ['coastal', 'beach', 'mediterranean', 'seaside', 'marine'],
  'Art Deco':     ['art deco', 'deco', 'gatsby'],
  'Bohemian':     ['bohemian', 'boho', 'eclectic'],
};

function matchKeywords(text: string, keywordMap: Record<string, string[]>): string[] {
  const lower = text.toLowerCase();
  return Object.entries(keywordMap)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([tag]) => tag);
}

export function extractTagsFromMetadata(input: MetadataInput): TagResult[] {
  const corpus = [
    input.style || '',
    input.description || '',
    ...input.categoryNames,
  ].join(' ');

  if (!corpus.trim()) return [];

  const roomTags = matchKeywords(corpus, ROOM_KEYWORDS);
  const styleTags = matchKeywords(corpus, STYLE_KEYWORDS);

  return [...roomTags, ...styleTags].map(tag => ({
    tag,
    confidence: 1.0,
    source: 'metadata' as const,
  }));
}
