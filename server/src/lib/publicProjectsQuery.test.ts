import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicProjectsListQuery } from './publicProjectsQuery';

test('buildPublicProjectsListQuery embeds limit and offset but keeps filters parameterized', () => {
  const result = buildPublicProjectsListQuery({
    status: 'published',
    designerId: '42',
    limit: 12,
    offset: 24,
  });

  assert.match(result.sql, /LIMIT 12 OFFSET 24/);
  assert.doesNotMatch(result.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(result.params, ['published', '42']);
});

test('buildPublicProjectsListQuery selects consistent designer metadata fields', () => {
  const result = buildPublicProjectsListQuery({
    status: 'published',
    limit: 3,
    offset: 0,
  });

  assert.match(result.sql, /d\.city as designer_city/);
  assert.match(result.sql, /d\.bio as designer_bio/);
  assert.match(result.sql, /d\.avatar_url as designer_avatar/);
});

test('buildPublicProjectsListQuery excludes soft-deleted designers', () => {
  const result = buildPublicProjectsListQuery({
    status: 'published',
    limit: 3,
    offset: 0,
  });

  assert.match(result.sql, /d\.deleted_at IS NULL/);
});
