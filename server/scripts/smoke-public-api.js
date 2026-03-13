const assert = require('node:assert/strict');
const path = require('node:path');

async function main() {
  const apiBase = process.env.API_BASE || 'http://localhost:3002/api';
  const smokeModulePath = path.resolve(__dirname, '../dist/lib/publicApiSmoke.js');
  const paginationModulePath = path.resolve(__dirname, '../dist/lib/publicApiSmokePagination.js');
  const {
    assertPublicDesignersPayload,
    assertPublicDesignerDetailPayload,
    assertPublicProjectsPayload,
    assertPublicProjectDetailPayload,
  } = require(smokeModulePath);
  const {
    assertDescendingNumberField,
    assertDescendingComparableField,
    assertPaginationMatchesRequest,
    assertCrossPageDescendingBoundary,
    assertNoOverlappingIds,
    collectSmokeSampleIds,
  } = require(paginationModulePath);

  const limit = 3;
  const pageOne = 1;
  const pageTwo = 2;

  const designersResponse = await fetch(`${apiBase}/designers?limit=${limit}&page=${pageOne}`);
  assert.equal(designersResponse.ok, true, 'Designers API should respond with 200');
  const designersPayload = await designersResponse.json();
  assertPublicDesignersPayload(designersPayload);
  assertPaginationMatchesRequest(designersPayload, { page: pageOne, limit });
  assertDescendingNumberField(designersPayload.designers, 'display_order');

  const projectsResponse = await fetch(`${apiBase}/projects?limit=${limit}&page=${pageOne}`);
  assert.equal(projectsResponse.ok, true, 'Projects API should respond with 200');
  const projectsPayload = await projectsResponse.json();
  assertPublicProjectsPayload(projectsPayload);
  assertPaginationMatchesRequest(projectsPayload, { page: pageOne, limit });
  assertDescendingComparableField(projectsPayload.projects, 'created_at');

  const designersPageTwoPayload = designersPayload.pagination.totalPages > 1
    ? await fetch(`${apiBase}/designers?limit=${limit}&page=${pageTwo}`).then(async (response) => {
      assert.equal(response.ok, true, 'Designers page 2 API should respond with 200');
      const payload = await response.json();
      assertPublicDesignersPayload(payload);
      assertPaginationMatchesRequest(payload, { page: pageTwo, limit });
      assertDescendingNumberField(payload.designers, 'display_order');
      return payload;
    })
    : { designers: [] };
  const projectsPageTwoPayload = projectsPayload.pagination.totalPages > 1
    ? await fetch(`${apiBase}/projects?limit=${limit}&page=${pageTwo}`).then(async (response) => {
      assert.equal(response.ok, true, 'Projects page 2 API should respond with 200');
      const payload = await response.json();
      assertPublicProjectsPayload(payload);
      assertPaginationMatchesRequest(payload, { page: pageTwo, limit });
      assertDescendingComparableField(payload.projects, 'created_at');
      return payload;
    })
    : { projects: [] };

  assertCrossPageDescendingBoundary(
    designersPayload.designers,
    designersPageTwoPayload.designers || [],
    'display_order'
  );
  assertNoOverlappingIds(
    designersPayload.designers,
    designersPageTwoPayload.designers || []
  );
  assertNoOverlappingIds(
    projectsPayload.projects,
    projectsPageTwoPayload.projects || []
  );

  const designerIds = collectSmokeSampleIds(
    designersPayload.designers,
    designersPageTwoPayload.designers || [],
    2
  );
  assert.equal(designerIds.length > 0, true, 'At least one public designer is required for smoke test');

  for (const designerId of designerIds) {
    const detailResponse = await fetch(`${apiBase}/designers/${designerId}`);
    assert.equal(detailResponse.ok, true, 'Designer detail API should respond with 200');
    const detailPayload = await detailResponse.json();
    assertPublicDesignerDetailPayload(detailPayload);
  }

  const projectIds = collectSmokeSampleIds(
    projectsPayload.projects,
    projectsPageTwoPayload.projects || [],
    2
  );
  assert.equal(projectIds.length > 0, true, 'At least one public project is required for smoke test');

  for (const projectId of projectIds) {
    const projectDetailResponse = await fetch(`${apiBase}/projects/${projectId}`);
    assert.equal(projectDetailResponse.ok, true, 'Project detail API should respond with 200');
    const projectDetailPayload = await projectDetailResponse.json();
    assertPublicProjectDetailPayload(projectDetailPayload);
  }

  console.log(`Public API smoke passed against ${apiBase}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
