"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagProjectImages = tagProjectImages;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_js_1 = __importDefault(require("../../config/database.js"));
const parseJsonField_js_1 = require("../../lib/parseJsonField.js");
const metadataTagger_js_1 = require("./metadataTagger.js");
const onnxTagger_js_1 = require("./onnxTagger.js");
const tagMerger_js_1 = require("./tagMerger.js");
function resolveAbsolutePath(imageUrl) {
    const serverRoot = path_1.default.resolve(__dirname, '../../../');
    return path_1.default.join(serverRoot, 'public', imageUrl);
}
function normalizeEntry(entry) {
    if (typeof entry === 'string')
        return { url: entry, alreadyTagged: false, raw: entry };
    if (entry && typeof entry === 'object') {
        const obj = entry;
        return {
            url: String(obj.url ?? ''),
            alreadyTagged: !!obj.ai_tagged_at,
            raw: entry,
        };
    }
    return { url: '', alreadyTagged: false, raw: entry };
}
/**
 * Tag all images in a project. forceRetag=true skips the alreadyTagged check (for backfill).
 */
async function tagProjectImages(projectId, forceRetag = false) {
    let row;
    try {
        const [rows] = await database_js_1.default.execute('SELECT id, images, tags, style, description, title FROM projects WHERE id = ? LIMIT 1', [projectId]);
        if (!rows || rows.length === 0)
            return;
        row = rows[0];
    }
    catch (err) {
        console.error('[tag-engine] DB error loading project', projectId, err);
        return;
    }
    const rawImages = (0, parseJsonField_js_1.parseJsonField)(row.images);
    if (!Array.isArray(rawImages) || rawImages.length === 0)
        return;
    const entries = rawImages.map(normalizeEntry);
    // B layer: project-level metadata shared across all images
    const metaTags = (0, metadataTagger_js_1.extractTagsFromMetadata)({
        style: row.style,
        description: row.description,
        // Note: row.tags is not used as categoryNames input — it's the output we're computing.
        // Using it as input would create circular dependency (tags → metadata → same tags).
        categoryNames: row.title ? [String(row.title)] : [],
    });
    const nowIso = new Date().toISOString();
    const updatedEntries = [];
    let anyUpdated = false;
    for (const entry of entries) {
        if (!entry.url) {
            updatedEntries.push(entry.raw);
            continue;
        }
        // Already tagged and not force-retagging → keep as-is
        if (entry.alreadyTagged && !forceRetag) {
            updatedEntries.push(entry.raw);
            continue;
        }
        // C layer: only for local /uploads/ images
        let clipTags = [];
        if (entry.url.startsWith('/uploads/')) {
            const absPath = resolveAbsolutePath(entry.url);
            if (fs_1.default.existsSync(absPath)) {
                clipTags = await (0, onnxTagger_js_1.tagImageWithClip)(absPath);
            }
        }
        const merged = (0, tagMerger_js_1.mergeTags)(metaTags, clipTags);
        const categoryTags = (0, tagMerger_js_1.toTagStrings)(merged);
        const tagged = {
            url: entry.url,
            ai_tags: clipTags.map(r => r.tag),
            ai_category: categoryTags,
            ai_tagged_at: nowIso,
        };
        updatedEntries.push(tagged);
        anyUpdated = true;
    }
    if (!anyUpdated)
        return;
    // Legacy string entries (alreadyTagged=false per normalizeEntry) are always re-tagged
    // above and become TaggedImage objects in updatedEntries, so their categories
    // are always captured here. Already-tagged object entries retain their ai_category field.
    const allCategories = Array.from(new Set(updatedEntries.flatMap(e => e && typeof e === 'object' && Array.isArray(e.ai_category)
        ? e.ai_category
        : [])));
    try {
        await database_js_1.default.execute('UPDATE projects SET images = ?, tags = ? WHERE id = ?', [JSON.stringify(updatedEntries), JSON.stringify(allCategories), projectId]);
        console.log(`[tag-engine] Project ${projectId} tagged — ${updatedEntries.length} imgs, tags: [${allCategories.join(', ')}]`);
    }
    catch (err) {
        console.error('[tag-engine] DB error saving tags for project', projectId, err);
    }
}
