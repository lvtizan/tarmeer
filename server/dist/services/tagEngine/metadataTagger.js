"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTagsFromMetadata = extractTagsFromMetadata;
const ROOM_KEYWORDS = {
    'Living Room': ['living room', 'living', 'lounge', 'sitting room', 'reception', 'salon'],
    'Bedroom': ['bedroom', 'bed room', 'master bedroom', 'master', 'sleeping'],
    'Kitchen': ['kitchen', 'cooking', 'culinary'],
    'Bathroom': ['bathroom', 'bath room', 'toilet', 'washroom', 'shower'],
    'Dining Room': ['dining room', 'dining', 'dinner room'],
    'Home Office': ['home office', 'office', 'study', 'workspace', 'library'],
    'Majlis': ['majlis', 'مجلس'],
    'Hallway': ['hallway', 'corridor', 'entrance', 'foyer', 'entryway'],
    'Nursery': ['nursery', "kids' room", "children's room", 'playroom', 'kids room'],
    'Outdoor': ['outdoor', 'garden', 'pool', 'terrace', 'balcony', 'exterior', 'landscape'],
};
const STYLE_KEYWORDS = {
    'Modern': ['modern', 'contemporary'],
    'Luxury': ['luxury', 'luxurious', 'premium', 'high-end', 'villa', 'palace', 'penthouse'],
    'Minimalist': ['minimalist', 'minimal', 'clean lines', 'simple'],
    'Classical': ['classical', 'classic', 'traditional', 'european', 'victorian', 'baroque'],
    'Arabic': ['arabic', 'arabic style', 'islamic', 'oriental', 'arab', 'majlis'],
    'Industrial': ['industrial', 'loft', 'warehouse', 'raw'],
    'Scandinavian': ['scandinavian', 'nordic', 'scandi', 'hygge'],
    'Coastal': ['coastal', 'beach', 'mediterranean', 'seaside', 'marine'],
    'Art Deco': ['art deco', 'deco', 'gatsby'],
    'Bohemian': ['bohemian', 'boho', 'eclectic'],
};
/**
 * Match a single keyword against lowercased text.
 * Multi-word keywords (containing spaces) use substring match (includes).
 * Single-word keywords use word-boundary regex to avoid false positives
 * e.g. 'raw' matching 'drawing', 'master' matching 'masterpiece'.
 */
function matchWord(text, kw) {
    if (kw.includes(' ')) {
        return text.includes(kw);
    }
    // Escape any regex special chars in the keyword
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(text);
}
function matchKeywords(text, keywordMap) {
    const lower = text.toLowerCase();
    return Object.entries(keywordMap)
        .filter(([, keywords]) => keywords.some(kw => matchWord(lower, kw)))
        .map(([tag]) => tag);
}
/**
 * Match each field independently and merge results.
 * Prevents ghost words from cross-field concatenation
 * e.g. categoryNames: ['bath', 'room'] joining into 'bath room' → false Bathroom hit.
 */
function matchAll(fields, map) {
    const matched = new Set();
    for (const field of fields) {
        for (const tag of matchKeywords(field, map)) {
            matched.add(tag);
        }
    }
    return Array.from(matched);
}
function extractTagsFromMetadata(input) {
    const fields = [
        input.style || '',
        input.description || '',
        ...input.categoryNames,
    ];
    if (!fields.some(f => f.trim()))
        return [];
    const roomTags = matchAll(fields, ROOM_KEYWORDS);
    const styleTags = matchAll(fields, STYLE_KEYWORDS);
    return [...roomTags, ...styleTags].map(tag => ({
        tag,
        confidence: 0.8,
        source: 'metadata',
    }));
}
