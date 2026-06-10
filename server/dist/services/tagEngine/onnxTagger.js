"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.warmupClip = warmupClip;
exports.tagImageWithClip = tagImageWithClip;
/* eslint-disable @typescript-eslint/no-var-requires */
const path_1 = __importDefault(require("path"));
const tagTaxonomy_js_1 = require("../../lib/tagTaxonomy.js");
// @xenova/transformers v2 is CommonJS compatible
const { pipeline, env } = require('@xenova/transformers');
// Fixed model cache dir to avoid scattering files in home
env.cacheDir = path_1.default.resolve(__dirname, '../../../.model-cache');
// Zero-shot prompts — more specific = more accurate
const ROOM_PROMPTS = tagTaxonomy_js_1.ROOM_TAGS.map(t => `a photo of a ${t.toLowerCase()} in a home`);
const STYLE_PROMPTS = tagTaxonomy_js_1.STYLE_TAGS.map(t => `a photo of a ${t.toLowerCase()} interior design`);
// Reverse maps: prompt string -> taxonomy tag (needed because @xenova/transformers returns
// results sorted by score descending, NOT in the same order as input prompts)
const roomPromptToTag = new Map(ROOM_PROMPTS.map((p, i) => [p, tagTaxonomy_js_1.ROOM_TAGS[i]]));
const stylePromptToTag = new Map(STYLE_PROMPTS.map((p, i) => [p, tagTaxonomy_js_1.STYLE_TAGS[i]]));
// Softmax output acceptance thresholds (relative probability among 10 candidates)
const ROOM_THRESHOLD = 0.15;
const STYLE_THRESHOLD = 0.12; // styles are harder to distinguish, lower threshold
let _classifier = null;
let _loading = null;
async function getClassifier() {
    if (_classifier)
        return _classifier;
    if (_loading)
        return _loading;
    _loading = pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32')
        .then((cls) => {
        _classifier = cls;
        console.log('[tag-engine] CLIP model ready');
        return cls;
    })
        .catch((err) => {
        _loading = null; // allow retry on next call
        throw err;
    });
    return _loading;
}
/** Pre-warm model on server startup to avoid latency on first request */
async function warmupClip() {
    await getClassifier();
}
async function tagImageWithClip(absoluteImagePath) {
    const results = [];
    try {
        const cls = await getClassifier();
        const roomScores = await cls(absoluteImagePath, ROOM_PROMPTS);
        for (const score of roomScores) {
            const tag = roomPromptToTag.get(score.label);
            if (tag && score.score >= ROOM_THRESHOLD) {
                results.push({ tag, confidence: score.score, source: 'clip' });
            }
        }
        const styleScores = await cls(absoluteImagePath, STYLE_PROMPTS);
        for (const score of styleScores) {
            const tag = stylePromptToTag.get(score.label);
            if (tag && score.score >= STYLE_THRESHOLD) {
                results.push({ tag, confidence: score.score, source: 'clip' });
            }
        }
    }
    catch (err) {
        console.error('[tag-engine] CLIP inference error:', absoluteImagePath, err);
    }
    return results;
}
