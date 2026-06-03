"use strict";
/**
 * Canonical tag taxonomy for portfolio filtering.
 * Shared by: frontend filters, Gemini vision tagging, migration scripts.
 *
 * ROOM_TAGS  — physical space type (detected from image content)
 * STYLE_TAGS — design aesthetic  (detected from image content)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PORTFOLIO_TAGS = exports.STYLE_TAGS = exports.ROOM_TAGS = void 0;
exports.ROOM_TAGS = [
    'Living Room',
    'Bedroom',
    'Kitchen',
    'Bathroom',
    'Dining Room',
    'Home Office',
    'Majlis',
    'Hallway',
    'Nursery',
    'Outdoor',
];
exports.STYLE_TAGS = [
    'Modern',
    'Luxury',
    'Minimalist',
    'Classical',
    'Arabic',
    'Industrial',
    'Scandinavian',
    'Coastal',
    'Art Deco',
    'Bohemian',
];
/** All valid tags for portfolio filtering (room + style). */
exports.ALL_PORTFOLIO_TAGS = [...exports.ROOM_TAGS, ...exports.STYLE_TAGS];
