import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminDesignersListQuery } from './adminDesignersQuery';

test('buildAdminDesignersListQuery includes soft-delete fields for admin list rendering', () => {
  const result = buildAdminDesignersListQuery({
    whereClause: 'WHERE d.deleted_at IS NOT NULL',
    safeSortBy: 'created_at',
    safeSortOrder: 'DESC',
    safeLimit: 20,
    offset: 0,
  });

  assert.match(result.sql, /d\.deleted_at/);
  assert.match(result.sql, /d\.deleted_by_admin_id/);
  assert.match(result.sql, /d\.delete_reason/);
});
