"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePublicDesigner = sanitizePublicDesigner;
exports.sanitizePublicProject = sanitizePublicProject;
const parseJsonField_1 = require("./parseJsonField");
const publicImageCleanup_1 = require("./publicImageCleanup");
function toPublicString(value) {
    return typeof value === 'string' ? value : '';
}
function sanitizePublicDesigner(designer) {
    const featuredImages = (0, publicImageCleanup_1.sanitizeImageUrls)((0, parseJsonField_1.parseJsonField)(designer.featured_project_images) || []);
    return {
        id: designer.id,
        full_name: toPublicString(designer.company_name || designer.full_name),
        title: toPublicString(designer.title || ''),
        city: toPublicString(designer.city),
        bio: toPublicString(designer.description || designer.bio),
        avatar_url: (0, publicImageCleanup_1.sanitizeAvatarUrl)(designer.logo_url || designer.avatar_url),
        style: toPublicString(designer.style || ''),
        expertise: (0, parseJsonField_1.parseJsonField)(designer.expertise) || [],
        display_order: designer.display_order || 0,
        project_count: designer.project_count || 0,
        featured_images: featuredImages,
        featured_project_images: featuredImages,
        created_at: toPublicString(designer.created_at),
    };
}
function sanitizePublicProject(project) {
    return {
        id: project.id,
        title: toPublicString(project.title),
        description: toPublicString(project.description),
        style: toPublicString(project.style),
        location: toPublicString(project.location),
        area: toPublicString(project.area),
        year: toPublicString(project.year),
        cost: toPublicString(project.cost),
        images: (0, publicImageCleanup_1.sanitizeImageUrls)((0, parseJsonField_1.parseJsonField)(project.images) || []),
        tags: (0, parseJsonField_1.parseJsonField)(project.tags) || [],
        designer_name: toPublicString(project.designer_name),
        designer_city: toPublicString(project.designer_city),
        designer_avatar: (0, publicImageCleanup_1.sanitizeAvatarUrl)(project.designer_avatar),
        designer_bio: toPublicString(project.designer_bio),
        created_at: toPublicString(project.created_at),
    };
}
