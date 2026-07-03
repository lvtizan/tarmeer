"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const memoryCache_1 = require("../lib/memoryCache");
const router = (0, express_1.Router)();
// Public: showcase images for auth page
router.get('/showcase-images', (0, memoryCache_1.cacheMiddleware)(60), async (req, res) => {
    try {
        const country = typeof req.query.country === 'string' ? req.query.country.trim() : '';
        const configKey = country === 'vn' ? 'showcase_images_vn' : 'showcase_images';
        const [rows] = await database_1.default.execute('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', [configKey]);
        // For VN, fall back to global if no VN config exists yet
        let finalRows = rows;
        if (country === 'vn' && !rows.length) {
            const [fallback] = await database_1.default.execute("SELECT config_value FROM system_config WHERE config_key = 'showcase_images' LIMIT 1");
            finalRows = fallback;
        }
        if (!finalRows.length)
            return res.json({ images: [] });
        let images = [];
        try {
            images = JSON.parse(finalRows[0].config_value);
        }
        catch { /* ignore */ }
        res.json({ images: Array.isArray(images) ? images : [] });
    }
    catch {
        res.json({ images: [] });
    }
});
// Public: 导航「找公司」空间类型（后台 system-config 可配置，key: space_types_ae / space_types_vn）
// 首次读取时把默认值种进 system_config，超管可在后台直接编辑，前端零硬编码
const DEFAULT_SPACE_TYPES = {
    ae: [
        { key: 'Villa', to: '/companies?space=villa' },
        { key: 'Apartment', to: '/companies?space=apartment' },
        { key: 'Commercial', to: '/companies?space=commercial' },
        { key: 'Public / Institutional', to: '/companies?space=public' },
        { key: 'Outdoor / Landscape', to: '/companies?space=outdoor' },
    ],
    vn: [
        { key: 'Villa', to: '/companies?service=Interior+Design' },
        { key: 'Apartment', to: '/companies?service=Fit-Out' },
        { key: 'Commercial', to: '/companies?service=Construction' },
        { key: 'Public / Institutional', to: '/companies?service=Architecture' },
        { key: 'Outdoor / Landscape', to: '/companies?service=Renovation' },
    ],
};
router.get('/space-types', (0, memoryCache_1.cacheMiddleware)(60), async (req, res) => {
    try {
        const country = req.query.country === 'vn' ? 'vn' : 'ae';
        const configKey = `space_types_${country}`;
        const [rows] = await database_1.default.execute('SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1', [configKey]);
        if (rows.length) {
            try {
                const items = JSON.parse(rows[0].config_value);
                if (Array.isArray(items)) return res.json({ items });
            }
            catch { /* fallthrough to default */ }
        }
        else {
            // seed 默认值，让后台 system-config 里立即可见可编辑
            const seed = JSON.stringify(DEFAULT_SPACE_TYPES[country]);
            await database_1.default.execute('INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_key = config_key', [configKey, seed]).catch(() => { });
        }
        res.json({ items: DEFAULT_SPACE_TYPES[country] });
    }
    catch {
        res.json({ items: [] });
    }
});
exports.default = router;
