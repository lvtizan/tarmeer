import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDesignersListQuery } from './publicDesignersQuery';

test('buildPublicDesignersListQuery embeds limit and offset for mysql2 compatibility', () => {
  const result = buildPublicDesignersListQuery({
    limit: 8,
    offset: 16,
  });

  assert.match(result.sql, /LIMIT 8 OFFSET 16/);
  assert.doesNotMatch(result.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(result.params, []);
});

test('buildPublicDesignersListQuery excludes soft-deleted designers', () => {
  const result = buildPublicDesignersListQuery({
    limit: 8,
    offset: 0,
  });

  assert.match(result.sql, /deleted_at IS NULL/);
});
