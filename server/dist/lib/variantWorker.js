"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueVariants = enqueueVariants;
const imageVariants_1 = require("./imageVariants");
/**
 * Async queue for image variant generation.
 *
 * All upload handlers call enqueueVariants() after writing a file.
 * The worker drains the queue one at a time in the background,
 * so uploads are never slowed down waiting for sharp.
 *
 * Rule: every image written to disk MUST call enqueueVariants(absolutePath).
 * Front-end then uses resolveVariantUrl(url, 'thumb'/'medium') for lists/cards,
 * and resolveImageUrl(url) only for the full-screen lightbox.
 */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const queue = [];
let running = false;
/** Fire-and-forget: enqueue absolutePath for -blur/-thumb/-medium variant generation. */
function enqueueVariants(absolutePath) {
    if (!IMAGE_EXT.test(absolutePath))
        return;
    queue.push(absolutePath);
    drain();
}
async function drain() {
    if (running)
        return;
    running = true;
    while (queue.length > 0) {
        const p = queue.shift();
        try {
            await (0, imageVariants_1.generateVariants)(p);
        }
        catch {
            // individual failures are silent — missing variants fall back to original
        }
    }
    running = false;
}
