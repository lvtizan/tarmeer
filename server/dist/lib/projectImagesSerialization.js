"use strict";
/**
 * Normalizes the `projects.images` JSON blob into a flat array of URL strings.
 *
 * The column historically stored `["/uploads/a.jpg", "/uploads/b.jpg"]`, but
 * after Gemini AI tagging (see services/visionTagging.ts) it is rewritten to
 * `[{ url, ai_tags, ai_category, ai_tagged_at }, ...]`. Any endpoint that
 * exposes project images to the frontend must normalize both shapes, or the
 * frontend receives raw objects where it expects strings and silently drops
 * them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImageUrls = extractImageUrls;
function extractUrl(item) {
    if (typeof item === 'string')
        return item;
    if (item && typeof item === 'object') {
        const url = item.url;
        if (typeof url === 'string')
            return url;
    }
    return '';
}
function extractImageUrls(raw) {
    let parsed = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(parsed))
        return [];
    return parsed.map(extractUrl).filter((url) => url.length > 0);
}
