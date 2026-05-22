// server/src/services/tagEngine/types.ts

export interface TagResult {
  tag: string;
  confidence: number;   // 0.0–1.0
  source: 'metadata' | 'clip';
}

export interface TaggedImage {
  url: string;
  ai_tags: string[];        // CLIP 原始描述标签（保持 schema 兼容）
  ai_category: string[];    // 合并后的 taxonomy 标签（room + style）
  ai_tagged_at: string;     // ISO 时间戳
}
