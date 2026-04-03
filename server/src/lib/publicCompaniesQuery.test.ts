import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicCompaniesListQuery,
  buildPublicCompanyDetailQuery,
} from './publicCompaniesQuery';

test('buildPublicCompaniesListQuery embeds limit and offset and returns active companies', () => {
  const result = buildPublicCompaniesListQuery({
    limit: 12,
    offset: 24,
  });

  assert.match(result.sql, /is_active = 1/);
  assert.match(result.sql, /LIMIT 12 OFFSET 24/);
  assert.deepEqual(result.params, []);
});

test('buildPublicCompanyDetailQuery fetches by slug', () => {
  const result = buildPublicCompanyDetailQuery('algedra');

  assert.match(result.sql, /WHERE slug = \?/);
  assert.match(result.sql, /LIMIT 1/);
  assert.deepEqual(result.params, ['algedra']);
});
