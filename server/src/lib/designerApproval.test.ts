import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutoPublishPendingProjectsQuery } from './designerApproval';

test('buildAutoPublishPendingProjectsQuery builds placeholders for designer IDs', () => {
  const result = buildAutoPublishPendingProjectsQuery([8, 12, 99]);

  assert.match(result.sql, /WHERE designer_id IN \(\?,\?,\?\) AND status = 'pending'/);
  assert.deepEqual(result.params, [8, 12, 99]);
});

test('buildAutoPublishPendingProjectsQuery rejects empty input', () => {
  assert.throws(() => buildAutoPublishPendingProjectsQuery([]), /DESIGNER_IDS_REQUIRED/);
});

