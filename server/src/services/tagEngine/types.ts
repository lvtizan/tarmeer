// server/src/services/tagEngine/types.ts

export interface TagResult {
  tag: string;
  confidence: number;   // 0.0–1.0
  source: 'metadata' | 'clip';
}

export interface TaggedImage {
  url: string;
  ai_tags: string[];      // per-image CLIP labels (schema field from visionTagging era, kept for DB compat)
  ai_category: string[];  // merged taxonomy tags from B+C layers (room type + design style)
  ai_tagged_at: string;     // ISO 时间戳
}
