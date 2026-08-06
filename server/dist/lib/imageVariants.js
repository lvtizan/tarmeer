"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUploadedImage = processUploadedImage;
exports.generateVariants = generateVariants;
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
/** Max long edge for stored originals (px). Prevents multi-MB originals on disk. */
const MAX_ORIGINAL_LONG_EDGE = 2400;
/** WebP quality for stored originals. */
const ORIGINAL_QUALITY = 88;
/**
 * Process an uploaded image buffer before writing to disk:
 * - Resizes so the long edge ≤ 2400px (never enlarges)
 * - Converts to WebP at quality 88
 *
 * Returns the processed buffer and the fixed extension 'webp'.
 * If sharp throws (e.g. corrupt or non-image data), returns the original buffer unchanged.
 */
async function processUploadedImage(buffer) {
    try {
        const processed = await (0, sharp_1.default)(buffer)
            // EXIF 自动转向：把手机/相机拍摄时靠 Orientation 标签记录的旋转"烤进像素"并去掉标签，
            // 否则转 WebP 后方向标签丢失，竖图会按原始横向像素显示（上传后变横）。必须在 resize 之前。
            .rotate()
            .resize(MAX_ORIGINAL_LONG_EDGE, MAX_ORIGINAL_LONG_EDGE, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .webp({ quality: ORIGINAL_QUALITY })
            .toBuffer();
        return { buffer: processed, ext: 'webp' };
    }
    catch {
        // Fallback: return original unchanged (will still get variant generation)
        return { buffer, ext: 'webp' };
    }
}
const VARIANTS = [
    { suffix: '-blur', maxLongEdge: 40, quality: 20 },
    { suffix: '-thumb', maxLongEdge: 600, quality: 78 }, // mobile cards
    { suffix: '-medium', maxLongEdge: 1200, quality: 85 }, // desktop grid / masonry
];
/**
 * Generate blur, thumb, and medium WebP variants for a single image.
 * Skips variants that already exist on disk.
 */
async function generateVariants(imagePath) {
    const ext = path_1.default.extname(imagePath);
    const base = imagePath.slice(0, -ext.length);
    const generated = [];
    let metadata;
    try {
        metadata = await (0, sharp_1.default)(imagePath).metadata();
    }
    catch {
        return generated;
    }
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (width === 0 || height === 0)
        return generated;
    for (const variant of VARIANTS) {
        const outPath = `${base}${variant.suffix}.webp`;
        try {
            await fs_1.promises.access(outPath);
            continue;
        }
        catch {
            // does not exist, proceed
        }
        const longEdge = Math.max(width, height);
        const scale = longEdge > variant.maxLongEdge ? variant.maxLongEdge / longEdge : 1;
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        try {
            await (0, sharp_1.default)(imagePath)
                .resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: variant.quality })
                .toFile(outPath);
            await fs_1.promises.chmod(outPath, 0o644);
            generated.push(outPath);
        }
        catch {
            // skip this variant on error
        }
    }
    return generated;
}
