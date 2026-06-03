"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeArticleImageKey = normalizeArticleImageKey;
exports.resolveMirroredArticleImage = resolveMirroredArticleImage;
exports.rewriteMirroredArticleContent = rewriteMirroredArticleContent;
const blogImageManifest_json_1 = __importDefault(require("../data/blogImageManifest.json"));
const articleImageManifest = blogImageManifest_json_1.default;
function normalizeArticleImageKey(url) {
    const trimmed = url.trim();
    if (!trimmed)
        return '';
    try {
        const parsed = new URL(trimmed);
        return `${parsed.origin}${parsed.pathname}`;
    }
    catch {
        return trimmed;
    }
}
function resolveMirroredArticleImage(slug, imageUrl) {
    if (!imageUrl)
        return null;
    if (!/^https?:\/\//i.test(imageUrl))
        return imageUrl;
    const articleEntry = articleImageManifest[slug];
    if (!articleEntry?.images)
        return imageUrl;
    const normalizedKey = normalizeArticleImageKey(imageUrl);
    return articleEntry.images[normalizedKey] || imageUrl;
}
function rewriteMirroredArticleContent(slug, html) {
    const articleEntry = articleImageManifest[slug];
    if (!articleEntry || !html)
        return html;
    const missingKeys = new Set(articleEntry.missing || []);
    const withoutMissingFigures = missingKeys.size === 0
        ? html
        : html.replace(/<figure><img[^>]*\ssrc="([^"]+)"[^>]*\/?><figcaption>.*?<\/figcaption><\/figure>/gi, (match, src) => (missingKeys.has(normalizeArticleImageKey(src)) ? '' : match));
    if (!articleEntry.images)
        return withoutMissingFigures;
    return withoutMissingFigures.replace(/(<img[^>]*\ssrc=")([^"]+)(")/gi, (_match, prefix, src, suffix) => {
        const rewritten = resolveMirroredArticleImage(slug, src);
        return `${prefix}${rewritten || src}${suffix}`;
    });
}
