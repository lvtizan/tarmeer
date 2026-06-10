"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeTags = mergeTags;
exports.toTagStrings = toTagStrings;
/** B layer takes priority. C layer fills in what B didn't cover. Deduplicates by tag name. */
function mergeTags(metaTags, clipTags) {
    const seen = new Map();
    for (const r of metaTags)
        seen.set(r.tag, r);
    for (const r of clipTags) {
        if (!seen.has(r.tag))
            seen.set(r.tag, r);
    }
    return Array.from(seen.values());
}
function toTagStrings(merged) {
    return merged.map(r => r.tag);
}
