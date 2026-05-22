/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import type { TagResult } from './types.js';
import { ROOM_TAGS, STYLE_TAGS } from '../../lib/tagTaxonomy.js';

// @xenova/transformers v2 is CommonJS compatible
const { pipeline, env } = require('@xenova/transformers');

// Fixed model cache dir to avoid scattering files in home
env.cacheDir = path.resolve(__dirname, '../../../.model-cache');

// Zero-shot prompts — more specific = more accurate
const ROOM_PROMPTS = ROOM_TAGS.map(t => `a photo of a ${t.toLowerCase()} in a home`);
const STYLE_PROMPTS = STYLE_TAGS.map(t => `a photo of a ${t.toLowerCase()} interior design`);

// Reverse maps: prompt string -> taxonomy tag (needed because @xenova/transformers returns
// results sorted by score descending, NOT in the same order as input prompts)
const roomPromptToTag = new Map<string, string>(ROOM_PROMPTS.map((p, i) => [p, ROOM_TAGS[i]]));
const stylePromptToTag = new Map<string, string>(STYLE_PROMPTS.map((p, i) => [p, STYLE_TAGS[i]]));

// Softmax output acceptance thresholds (relative probability among 10 candidates)
const ROOM_THRESHOLD = 0.15;
const STYLE_THRESHOLD = 0.12;  // styles are harder to distinguish, lower threshold

let _classifier: any = null;
let _loading: Promise<any> | null = null;

async function getClassifier(): Promise<any> {
  if (_classifier) return _classifier;
  if (_loading) return _loading;
  _loading = pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32')
    .then((cls: any) => {
      _classifier = cls;
      console.log('[tag-engine] CLIP model ready');
      return cls;
    })
    .catch((err: unknown) => {
      _loading = null;  // allow retry on next call
      throw err;
    });
  return _loading;
}

/** Pre-warm model on server startup to avoid latency on first request */
export async function warmupClip(): Promise<void> {
  await getClassifier();
}

interface ClipScore { label: string; score: number; }

export async function tagImageWithClip(absoluteImagePath: string): Promise<TagResult[]> {
  const results: TagResult[] = [];
  try {
    const cls = await getClassifier();

    const roomScores: ClipScore[] = await cls(absoluteImagePath, ROOM_PROMPTS);
    for (const score of roomScores) {
      const tag = roomPromptToTag.get(score.label);
      if (tag && score.score >= ROOM_THRESHOLD) {
        results.push({ tag, confidence: score.score, source: 'clip' });
      }
    }

    const styleScores: ClipScore[] = await cls(absoluteImagePath, STYLE_PROMPTS);
    for (const score of styleScores) {
      const tag = stylePromptToTag.get(score.label);
      if (tag && score.score >= STYLE_THRESHOLD) {
        results.push({ tag, confidence: score.score, source: 'clip' });
      }
    }
  } catch (err) {
    console.error('[tag-engine] CLIP inference error:', absoluteImagePath, err);
  }
  return results;
}
