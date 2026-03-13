import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonField } from './parseJsonField';

test('parseJsonField returns parsed arrays unchanged when mysql2 already decoded JSON', () => {
  const value = ['Residential', 'Luxury'];

  const result = parseJsonField(value);

  assert.deepEqual(result, ['Residential', 'Luxury']);
});

test('parseJsonField parses JSON strings and preserves plain objects', () => {
  assert.deepEqual(parseJsonField('["Dubai","Sharjah"]'), ['Dubai', 'Sharjah']);
  assert.deepEqual(parseJsonField({ enabled: true }), { enabled: true });
});
