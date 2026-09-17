import assert from 'node:assert/strict';
import { test } from 'node:test';

const { sanitizeDescription } = await import('./materialDescription.ts');

test('public material descriptions remove wholesale prices, MOQ and import metadata', () => {
  assert.equal(
    sanitizeDescription('大理石系列。[catalog-import:quanshi-2026-09-16] | Price: CN¥197.02-264.95 | MOQ: Min. Order: 2 pieces'),
    '大理石系列。',
  );
});

test('public material descriptions preserve ordinary copy', () => {
  assert.equal(sanitizeDescription('Natural stone for interior walls.'), 'Natural stone for interior walls.');
  assert.equal(sanitizeDescription(null), null);
});
