import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../config/database';
import { resolveLinkedDesigner } from './linkedDesigner';

test.after(async () => {
  await pool.end();
});

test('resolveLinkedDesigner prefers already linked designer records', () => {
  const result = resolveLinkedDesigner(
    { id: 88, email: 'designer@example.com' },
    [{ id: 12, user_id: 88, email: 'designer@example.com' }],
    [{ id: 12, user_id: 88, email: 'designer@example.com' }],
  );

  assert.equal(result.designer?.id, 12);
  assert.equal(result.shouldLinkByEmail, false);
});

test('resolveLinkedDesigner relinks legacy designer row found by email', () => {
  const result = resolveLinkedDesigner(
    { id: 88, email: 'designer@example.com' },
    [],
    [{ id: 12, user_id: null, email: 'designer@example.com' }],
  );

  assert.equal(result.designer?.id, 12);
  assert.equal(result.shouldLinkByEmail, true);
});

test('resolveLinkedDesigner returns null when no designer row exists', () => {
  const result = resolveLinkedDesigner(
    { id: 88, email: 'designer@example.com' },
    [],
    [],
  );

  assert.equal(result.designer, null);
  assert.equal(result.shouldLinkByEmail, false);
});
