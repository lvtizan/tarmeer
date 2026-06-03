"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE64_IMAGES_NOT_ALLOWED_ERROR = exports.PROJECT_IMAGES_REQUIRED_ERROR = void 0;
exports.normalizeProjectImages = normalizeProjectImages;
exports.assertProjectHasImages = assertProjectHasImages;
exports.buildProjectPersistenceValues = buildProjectPersistenceValues;
exports.PROJECT_IMAGES_REQUIRED_ERROR = 'PROJECT_IMAGES_REQUIRED';
exports.BASE64_IMAGES_NOT_ALLOWED_ERROR = 'BASE64_IMAGES_NOT_ALLOWED';
/**
 * CRITICAL: Validate that images are NOT stored as base64 in the database.
 * All base64 images MUST be converted to file URLs via persistProjectImages() BEFORE this point.
 *
 * Background: Base64 images cause:
 * - 10-17MB per project in database (comparison: file URLs are <1KB)
 * - MySQL sort_buffer_size overflow errors
 * - API response timeouts
 * - Network bandwidth waste
 */
function validateNoBase64Images(images) {
    if (!Array.isArray(images)) {
        return;
    }
    for (const image of images) {
        const url = typeof image === 'string' ? image : image?.url || '';
        if (url.startsWith('data:')) {
            throw new Error(exports.BASE64_IMAGES_NOT_ALLOWED_ERROR);
        }
    }
}
function toNullableString(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}
function toNullableCost(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    return value;
}
function toJsonArrayString(value) {
    return JSON.stringify(Array.isArray(value) ? value : []);
}
function normalizeProjectImages(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const result = [];
    for (const item of value) {
        if (typeof item === 'string') {
            const url = item.trim();
            if (url)
                result.push(url);
        }
        else if (item && typeof item === 'object' && 'url' in item) {
            const url = String(item.url).trim();
            if (!url)
                continue;
            const tag = item.tag;
            result.push(typeof tag === 'string' && tag.trim() ? { url, tag: tag.trim() } : url);
        }
    }
    return result;
}
function assertProjectHasImages(value) {
    const normalizedImages = normalizeProjectImages(value);
    if (normalizedImages.length === 0) {
        throw new Error(exports.PROJECT_IMAGES_REQUIRED_ERROR);
    }
    return normalizedImages;
}
function buildProjectPersistenceValues(input) {
    const normalizedImages = assertProjectHasImages(input.images);
    // CRITICAL: Prevent base64 images from entering the database
    validateNoBase64Images(normalizedImages);
    return {
        title: input.title,
        description: input.description,
        style: toNullableString(input.style),
        location: toNullableString(input.location),
        area: toNullableString(input.area),
        year: toNullableString(input.year),
        cost: toNullableCost(input.cost),
        images: toJsonArrayString(normalizedImages),
        tags: toJsonArrayString(input.tags),
        service_tags: toJsonArrayString(input.service_tags),
        status: input.status,
    };
}
