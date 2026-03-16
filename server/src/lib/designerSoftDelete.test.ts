import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDesignerAdminWhereClause,
  normalizeDesignerDeleteFilter,
  validateDeleteReason,
} from './designerSoftDelete';

test('normalizeDesignerDeleteFilter defaults to active', () => {
  assert.equal(normalizeDesignerDeleteFilter(undefined), 'active');
  assert.equal(normalizeDesignerDeleteFilter('garbage'), 'active');
});

test('normalizeDesignerDeleteFilter accepts deleted and all', () => {
  assert.equal(normalizeDesignerDeleteFilter('deleted'), 'deleted');
  assert.equal(normalizeDesignerDeleteFilter('all'), 'all');
});

test('buildDesignerAdminWhereClause excludes deleted designers by default', () => {
  const result = buildDesignerAdminWhereClause({
    status: undefined,
    search: undefined,
    deleted: undefined,
  });

  assert.match(result.whereClause, /d\.deleted_at IS NULL/);
  assert.deepEqual(result.values, []);
});

test('buildDesignerAdminWhereClause can filter only deleted designers', () => {
  const result = buildDesignerAdminWhereClause({
    status: 'pending',
    search: 'hana',
    deleted: 'deleted',
  });

  assert.match(result.whereClause, /d\.status = \?/);
  assert.match(result.whereClause, /d\.deleted_at IS NOT NULL/);
  assert.match(result.whereClause, /d\.full_name LIKE \?/);
  assert.deepEqual(result.values, ['pending', '%hana%', '%hana%', '%hana%']);
});

test('validateDeleteReason trims valid reasons', () => {
  assert.equal(validateDeleteReason('  duplicate profile  '), 'duplicate profile');
});

test('validateDeleteReason rejects empty reasons', () => {
  assert.equal(validateDeleteReason('   '), null);
});
