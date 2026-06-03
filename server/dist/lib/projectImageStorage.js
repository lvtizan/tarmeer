"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImageDataUrl = isImageDataUrl;
exports.persistProjectImages = persistProjectImages;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const variantWorker_1 = require("./variantWorker");
const imageVariants_1 = require("./imageVariants");
const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;
const PROJECT_UPLOADS_RELATIVE_DIR = '/uploads/projects';
const PROJECT_UPLOADS_ABSOLUTE_DIR = path_1.default.join(__dirname, '..', '..', 'public', 'uploads', 'projects');
function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function getFileExtensionByMime(mimeType) {
    switch (mimeType.toLowerCase()) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        case 'image/avif':
            return 'avif';
        default:
            return 'bin';
    }
}
function normalizeDesignerId(value) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) {
        return String(id);
    }
    return 'unknown';
}
function normalizeProjectId(value) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) {
        return String(id);
    }
    return 'new';
}
function buildProjectImagePathSegments(designerId, projectId) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return [normalizeDesignerId(designerId), normalizeProjectId(projectId), year, month];
}
function isImageDataUrl(value) {
    const text = toTrimmedString(value);
    return DATA_URL_PATTERN.test(text);
}
async function persistSingleImageDataUrl(dataUrl, designerId, projectId) {
    const match = dataUrl.match(DATA_URL_PATTERN);
    if (!match) {
        throw new Error('Invalid image data URL.');
    }
    const mimeType = match[1];
    const base64Payload = match[2].replace(/\s+/g, '');
    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length === 0) {
        throw new Error('Image payload is empty.');
    }
    const { buffer: processedBuffer, ext: processedExt } = await (0, imageVariants_1.processUploadedImage)(buffer);
    const subDirs = buildProjectImagePathSegments(designerId, projectId);
    const fileName = `${(0, crypto_1.randomUUID)()}.${processedExt}`;
    const absoluteDir = path_1.default.join(PROJECT_UPLOADS_ABSOLUTE_DIR, ...subDirs);
    const absoluteFilePath = path_1.default.join(absoluteDir, fileName);
    const relativeUrl = `${PROJECT_UPLOADS_RELATIVE_DIR}/${subDirs.join('/')}/${fileName}`;
    await fs_1.promises.mkdir(absoluteDir, { recursive: true, mode: 0o755 });
    await fs_1.promises.writeFile(absoluteFilePath, processedBuffer, { mode: 0o644 });
    (0, variantWorker_1.enqueueVariants)(absoluteFilePath);
    return relativeUrl;
}
function isPersistedImageUrl(value) {
    return value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}
function getRawUrl(image) {
    return typeof image === 'string' ? image : image.url;
}
function withUpdatedUrl(image, newUrl) {
    return typeof image === 'string' ? newUrl : { ...image, url: newUrl };
}
async function persistProjectImages(rawImages, options) {
    const result = [];
    const { designerId, projectId } = options;
    for (const image of rawImages) {
        const value = toTrimmedString(getRawUrl(image));
        if (!value)
            continue;
        if (isPersistedImageUrl(value)) {
            result.push(image); // preserve object (with tag) unchanged
            continue;
        }
        if (isImageDataUrl(value)) {
            const uploadedUrl = await persistSingleImageDataUrl(value, designerId, projectId);
            result.push(withUpdatedUrl(image, uploadedUrl)); // keep tag, update url
        }
    }
    return result;
}
