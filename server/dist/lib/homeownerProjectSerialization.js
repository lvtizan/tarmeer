"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHomeownerRecentProjects = normalizeHomeownerRecentProjects;
const parseJsonField_1 = require("./parseJsonField");
const publicImageCleanup_1 = require("./publicImageCleanup");
function toString(value) {
    return typeof value === 'string' ? value : '';
}
function parseImageList(raw) {
    const parsed = (0, parseJsonField_1.parseJsonField)(raw);
    if (Array.isArray(parsed)) {
        return (0, publicImageCleanup_1.sanitizeImageUrls)(parsed);
    }
    return [];
}
function normalizeHomeownerRecentProjects(rows) {
    return rows.map((row) => {
        const images = parseImageList(row.image_urls ?? row.images);
        return {
            ...row,
            title: toString(row.title),
            description: toString(row.description),
            style: toString(row.style),
            images,
        };
    });
}
