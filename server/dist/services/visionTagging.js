"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeImageEntry = normalizeImageEntry;
exports.resolveAbsolutePath = resolveAbsolutePath;
exports.analyzeImage = analyzeImage;
exports.tagProjectImages = tagProjectImages;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const generative_ai_1 = require("@google/generative-ai");
const database_1 = __importDefault(require("../config/database"));
const config_1 = require("../config");
const parseJsonField_1 = require("../lib/parseJsonField");
const tagTaxonomy_1 = require("../lib/tagTaxonomy");
const VALID_CATEGORIES = tagTaxonomy_1.ALL_PORTFOLIO_TAGS;
let _genAI = null;
let _initialized = false;
function getGenAI() {
    if (!config_1.config.vision.enabled)
        return null;
    if (!_initialized) {
        _initialized = true;
        const key = config_1.config.vision.apiKey;
        if (!key) {
            console.error('[vision-tagging] GEMINI_API_KEY not set');
            return null;
        }
        try {
            _genAI = new generative_ai_1.GoogleGenerativeAI(key);
        }
        catch (err) {
            console.error('[vision-tagging] Failed to initialise Gemini client:', err);
        }
    }
    return _genAI;
}
function normalizeImageEntry(entry) {
    if (typeof entry === 'string')
        return { url: entry };
    if (entry && typeof entry === 'object') {
        const obj = entry;
        return {
            url: String(obj.url ?? ''),
            ai_tags: Array.isArray(obj.ai_tags) ? obj.ai_tags : undefined,
            ai_category: Array.isArray(obj.ai_category) ? obj.ai_category : undefined,
            ai_tagged_at: typeof obj.ai_tagged_at === 'string' ? obj.ai_tagged_at : undefined,
        };
    }
    return { url: '' };
}
function resolveAbsolutePath(imageUrl) {
    const serverRoot = path_1.default.resolve(__dirname, '../../');
    return path_1.default.join(serverRoot, 'public', imageUrl);
}
async function analyzeImage(absolutePath) {
    const genAI = getGenAI();
    if (!genAI)
        return { labels: [], categories: [] };
    const imageData = fs_1.default.readFileSync(absolutePath);
    const base64 = imageData.toString('base64');
    const ext = path_1.default.extname(absolutePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const categoriesList = VALID_CATEGORIES.join(', ');
    const prompt = `Analyze this interior design / architecture image. Return ONLY a valid JSON object with no markdown, no code blocks, just raw JSON:
{
  "labels": ["up to 15 descriptive tags: materials, furniture, room features, style keywords"],
  "categories": ["pick only matching ones from: ${categoriesList}"]
}
For categories, identify both the room type (Living Room, Bedroom, Kitchen, etc.) AND the design style (Modern, Luxury, Minimalist, Classical, Arabic, Industrial, Scandinavian, Coastal, Art Deco, Bohemian). Include all that apply.`;
    const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType } },
    ]);
    const text = result.response.text().trim();
    try {
        const parsed = JSON.parse(text);
        const labels = Array.isArray(parsed.labels) ? parsed.labels.map(String) : [];
        const categories = Array.isArray(parsed.categories)
            ? parsed.categories.filter((c) => VALID_CATEGORIES.includes(c))
            : [];
        return { labels, categories };
    }
    catch {
        console.error('[vision-tagging] Failed to parse Gemini response:', text.slice(0, 200));
        return { labels: [], categories: [] };
    }
}
async function tagProjectImages(projectId) {
    if (!config_1.config.vision.enabled) {
        console.log('[vision-tagging] Vision disabled, skipping project', projectId);
        return;
    }
    let row;
    try {
        const [rows] = await database_1.default.execute('SELECT id, images, tags FROM projects WHERE id = ? LIMIT 1', [projectId]);
        if (!rows || rows.length === 0) {
            console.warn('[vision-tagging] Project not found:', projectId);
            return;
        }
        row = rows[0];
    }
    catch (err) {
        console.error('[vision-tagging] DB error loading project', projectId, err);
        return;
    }
    const rawImages = (0, parseJsonField_1.parseJsonField)(row.images);
    if (!Array.isArray(rawImages) || rawImages.length === 0) {
        console.log('[vision-tagging] No images for project', projectId);
        return;
    }
    const entries = rawImages.map(normalizeImageEntry);
    const nowIso = new Date().toISOString();
    const allNewCategories = [];
    let anyUpdated = false;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.ai_tagged_at)
            continue;
        if (!entry.url || !entry.url.startsWith('/uploads/')) {
            console.log('[vision-tagging] Skipping external URL:', entry.url);
            continue;
        }
        const absolutePath = resolveAbsolutePath(entry.url);
        if (!fs_1.default.existsSync(absolutePath)) {
            console.warn('[vision-tagging] File not found:', absolutePath);
            continue;
        }
        try {
            console.log(`[vision-tagging] Analysing image ${i + 1}/${entries.length}: ${entry.url}`);
            const { labels, categories } = await analyzeImage(absolutePath);
            entries[i] = {
                ...entry,
                ai_tags: labels,
                ai_category: categories,
                ai_tagged_at: nowIso,
            };
            allNewCategories.push(...categories);
            anyUpdated = true;
            console.log(`[vision-tagging] Tagged: labels=${labels.length}, categories=${categories.join(', ')}`);
        }
        catch (err) {
            console.error('[vision-tagging] Failed to analyse image', entry.url, err);
        }
    }
    if (!anyUpdated) {
        console.log('[vision-tagging] No new images to tag for project', projectId);
        return;
    }
    const existingTags = (0, parseJsonField_1.parseJsonField)(row.tags) ?? [];
    const mergedTags = Array.from(new Set([...existingTags, ...allNewCategories]));
    try {
        await database_1.default.execute('UPDATE projects SET images = ?, tags = ? WHERE id = ?', [JSON.stringify(entries), JSON.stringify(mergedTags), projectId]);
        console.log(`[vision-tagging] Project ${projectId} updated — tags: [${mergedTags.join(', ')}]`);
    }
    catch (err) {
        console.error('[vision-tagging] DB error saving tags for project', projectId, err);
    }
}
