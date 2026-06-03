"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonField = parseJsonField;
function parseJsonField(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    if (typeof value === 'object') {
        return value;
    }
    return null;
}
