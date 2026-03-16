import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorsOrigins } from './corsOrigins';

test('buildCorsOrigins allows local development on localhost and 127.0.0.1', () => {
  const origins = buildCorsOrigins('https://www.tarmeer.com');

  assert.ok(origins.includes('http://localhost:5173'));
  assert.ok(origins.includes('http://127.0.0.1:5173'));
  assert.ok(origins.includes('https://www.tarmeer.com'));
});
