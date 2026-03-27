import assert from 'node:assert/strict';

function assertStringField(value: any, fieldName: string) {
  assert.equal(typeof value, 'string', `${fieldName} must be a string`);
}

function assertPaginationShape(pagination: any) {
  assert.equal(typeof pagination?.page, 'number');
  assert.equal(typeof pagination?.limit, 'number');
  assert.equal(typeof pagination?.total, 'number');
  assert.equal(typeof pagination?.totalPages, 'number');
}

function assertDesignerShape(designer: any) {
  assert.ok(typeof designer.id === 'number' || typeof designer.id === 'string');
  assertStringField(designer.full_name, 'full_name');
  assertStringField(designer.title, 'title');
  assertStringField(designer.city, 'city');
  assertStringField(designer.bio, 'bio');
  assertStringField(designer.avatar_url, 'avatar_url');
  assertStringField(designer.style, 'style');
  assert.ok(Array.isArray(designer.expertise));
  assert.ok(Array.isArray(designer.featured_images));
  assert.ok(Array.isArray(designer.featured_project_images));
  assert.equal(typeof designer.project_count, 'number');
  assert.equal(typeof designer.display_order, 'number');
  assertStringField(designer.created_at, 'created_at');
}

function assertProjectShape(project: any) {
  assert.ok(typeof project.id === 'number' || typeof project.id === 'string');
  assertStringField(project.title, 'title');
  assertStringField(project.description, 'description');
  assertStringField(project.designer_name, 'designer_name');
  assertStringField(project.designer_city, 'designer_city');
  assertStringField(project.designer_avatar, 'designer_avatar');
  assertStringField(project.designer_bio, 'designer_bio');
  assert.ok(Array.isArray(project.images));
  assert.ok(Array.isArray(project.tags));
}

function assertCompanyShape(company: any) {
  assert.ok(typeof company.id === 'number' || typeof company.id === 'string');
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
  assert.ok(Array.isArray(company.services));
  assert.ok(Array.isArray(company.specialties));
  assertStringField(company.logo_url, 'logo_url');
  assertStringField(company.cover_image, 'cover_image');
  assert.ok(Array.isArray(company.portfolio_images));
  assert.equal(typeof company.project_count, 'number');
}

function assertDesignerDetailShape(designer: any) {
  assertDesignerShape(designer);
}

function assertProjectDetailShape(project: any) {
  assertProjectShape(project);
}

export function assertPublicDesignersPayload(payload: any) {
  assert.ok(Array.isArray(payload?.designers));
  assertPaginationShape(payload?.pagination);

  for (const designer of payload.designers) {
    assertDesignerShape(designer);
  }
}

export function assertPublicProjectsPayload(payload: any) {
  assert.ok(Array.isArray(payload?.projects));
  assertPaginationShape(payload?.pagination);

  for (const project of payload.projects) {
    assertProjectShape(project);
  }
}

export function assertPublicCompaniesPayload(payload: any) {
  assert.ok(Array.isArray(payload?.companies));
  assertPaginationShape(payload?.pagination);

  for (const company of payload.companies) {
    assertCompanyShape(company);
  }
}

export function assertPublicDesignerDetailPayload(payload: any) {
  assert.ok(payload?.designer);
  assertDesignerDetailShape(payload.designer);
  assert.ok(Array.isArray(payload?.projects));

  for (const project of payload.projects) {
    assertProjectShape(project);
  }
}

export function assertPublicProjectDetailPayload(payload: any) {
  assert.ok(payload?.project);
  assertProjectDetailShape(payload.project);
}

export function assertPublicCompanyDetailPayload(payload: any) {
  assert.ok(payload?.company);
  assertCompanyShape(payload.company);
}
