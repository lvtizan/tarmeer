"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPublicDesignersPayload = assertPublicDesignersPayload;
exports.assertPublicProjectsPayload = assertPublicProjectsPayload;
exports.assertPublicCompaniesPayload = assertPublicCompaniesPayload;
exports.assertPublicDesignerDetailPayload = assertPublicDesignerDetailPayload;
exports.assertPublicProjectDetailPayload = assertPublicProjectDetailPayload;
exports.assertPublicCompanyDetailPayload = assertPublicCompanyDetailPayload;
const strict_1 = __importDefault(require("node:assert/strict"));
function assertStringField(value, fieldName) {
    strict_1.default.equal(typeof value, 'string', `${fieldName} must be a string`);
}
function assertPaginationShape(pagination) {
    strict_1.default.equal(typeof pagination?.page, 'number');
    strict_1.default.equal(typeof pagination?.limit, 'number');
    strict_1.default.equal(typeof pagination?.total, 'number');
    strict_1.default.equal(typeof pagination?.totalPages, 'number');
}
function assertDesignerShape(designer) {
    strict_1.default.ok(typeof designer.id === 'number' || typeof designer.id === 'string');
    assertStringField(designer.full_name, 'full_name');
    assertStringField(designer.title, 'title');
    assertStringField(designer.city, 'city');
    assertStringField(designer.bio, 'bio');
    assertStringField(designer.avatar_url, 'avatar_url');
    assertStringField(designer.style, 'style');
    strict_1.default.ok(Array.isArray(designer.expertise));
    strict_1.default.ok(Array.isArray(designer.featured_images));
    strict_1.default.ok(Array.isArray(designer.featured_project_images));
    strict_1.default.equal(typeof designer.project_count, 'number');
    strict_1.default.equal(typeof designer.display_order, 'number');
    assertStringField(designer.created_at, 'created_at');
}
function assertProjectShape(project) {
    strict_1.default.ok(typeof project.id === 'number' || typeof project.id === 'string');
    assertStringField(project.title, 'title');
    assertStringField(project.description, 'description');
    assertStringField(project.designer_name, 'designer_name');
    assertStringField(project.designer_city, 'designer_city');
    assertStringField(project.designer_avatar, 'designer_avatar');
    assertStringField(project.designer_bio, 'designer_bio');
    strict_1.default.ok(Array.isArray(project.images));
    strict_1.default.ok(Array.isArray(project.tags));
}
function assertCompanyShape(company) {
    strict_1.default.ok(typeof company.id === 'number' || typeof company.id === 'string');
    assertStringField(company.slug, 'slug');
    assertStringField(company.name_en, 'name_en');
    assertStringField(company.description, 'description');
    assertStringField(company.city, 'city');
    assertStringField(company.address, 'address');
    assertStringField(company.year_established, 'year_established');
    assertStringField(company.website, 'website');
    assertStringField(company.instagram, 'instagram');
    assertStringField(company.phone, 'phone');
    assertStringField(company.email, 'email');
    strict_1.default.ok(Array.isArray(company.services));
    strict_1.default.ok(Array.isArray(company.specialties));
    assertStringField(company.logo_url, 'logo_url');
    assertStringField(company.cover_image, 'cover_image');
    strict_1.default.ok(Array.isArray(company.portfolio_images));
    strict_1.default.equal(typeof company.project_count, 'number');
}
function assertDesignerDetailShape(designer) {
    assertDesignerShape(designer);
}
function assertProjectDetailShape(project) {
    assertProjectShape(project);
}
function assertPublicDesignersPayload(payload) {
    strict_1.default.ok(Array.isArray(payload?.designers));
    assertPaginationShape(payload?.pagination);
    for (const designer of payload.designers) {
        assertDesignerShape(designer);
    }
}
function assertPublicProjectsPayload(payload) {
    strict_1.default.ok(Array.isArray(payload?.projects));
    assertPaginationShape(payload?.pagination);
    for (const project of payload.projects) {
        assertProjectShape(project);
    }
}
function assertPublicCompaniesPayload(payload) {
    strict_1.default.ok(Array.isArray(payload?.companies));
    assertPaginationShape(payload?.pagination);
    for (const company of payload.companies) {
        assertCompanyShape(company);
    }
}
function assertPublicDesignerDetailPayload(payload) {
    strict_1.default.ok(payload?.designer);
    assertDesignerDetailShape(payload.designer);
    strict_1.default.ok(Array.isArray(payload?.projects));
    for (const project of payload.projects) {
        assertProjectShape(project);
    }
}
function assertPublicProjectDetailPayload(payload) {
    strict_1.default.ok(payload?.project);
    assertProjectDetailShape(payload.project);
}
function assertPublicCompanyDetailPayload(payload) {
    strict_1.default.ok(payload?.company);
    assertCompanyShape(payload.company);
}
