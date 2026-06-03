"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeImageUrls = sanitizeImageUrls;
exports.sanitizeAvatarUrl = sanitizeAvatarUrl;
const SEED_AVATAR_IDS = new Set([
    'photo-1472099645785-5658abf4ff4e',
    'photo-1507003211169-0a1dd7228f2d',
    'photo-1494790108377-be9c29b29330',
    'photo-1519085360753-af0119f7cbe7',
    'photo-1500648767791-00dcc994a43e',
    'photo-1573496359142-b8d87734a5a2',
]);
function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function imageDedupKey(url) {
    const trimmed = url.trim();
    if (!trimmed)
        return '';
    try {
        if (trimmed.startsWith('/')) {
            return trimmed.split('?')[0];
        }
        const parsed = new URL(trimmed);
        return `${parsed.origin}${parsed.pathname}`;
    }
    catch {
        return trimmed.split('?')[0];
    }
}
function normalizeImageUrl(value) {
    const url = value.trim();
    if (!url)
        return '';
    if (url.startsWith('data:'))
        return url;
    if (url.startsWith('http://') || url.startsWith('https://'))
        return url;
    if (url.startsWith('//'))
        return `https:${url}`;
    if (url.startsWith('/'))
        return url;
    if (url.startsWith('./'))
        return `/${url.replace(/^\.\/+/, '')}`;
    if (url.startsWith('www.'))
        return `https://${url}`;
    if (url.startsWith('public/images/'))
        return `/${url.replace(/^public\//, '')}`;
    if (url.startsWith('public/uploads/'))
        return `/${url.replace(/^public\//, '')}`;
    if (url.startsWith('images/') || url.startsWith('uploads/'))
        return `/${url}`;
    return '';
}
function sanitizeImageUrls(values) {
    if (!Array.isArray(values)) {
        return [];
    }
    const out = [];
    const seen = new Set();
    for (const value of values) {
        const url = normalizeImageUrl(toTrimmedString(value));
        if (!url)
            continue;
        const key = imageDedupKey(url);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push(url);
    }
    return out;
}
function sanitizeAvatarUrl(value) {
    const url = normalizeImageUrl(toTrimmedString(value));
    if (!url)
        return '';
    const key = imageDedupKey(url);
    if (/\/images\/showcase\/avatar-\d+\.(png|jpe?g|webp)$/i.test(key)) {
        return '';
    }
    for (const avatarId of SEED_AVATAR_IDS) {
        if (key.includes(avatarId)) {
            return '';
        }
    }
    return url;
}
