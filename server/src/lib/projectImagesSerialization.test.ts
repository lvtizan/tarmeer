import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageUrls } from './projectImagesSerialization';

test('extractImageUrls — legacy string array (pre-Gemini)', () => {
  assert.deepEqual(
    extractImageUrls(['/uploads/a.jpg', '/uploads/b.jpg']),
    ['/uploads/a.jpg', '/uploads/b.jpg']
  );
});

test('extractImageUrls — Gemini AI-tagged object array', () => {
  const raw = [
    { url: '/uploads/a.jpg', ai_tags: ['sofa'], ai_category: ['Living Room'], ai_tagged_at: '2026-04-01T00:00:00Z' },
    { url: '/uploads/b.jpg', ai_tags: ['bed'],  ai_category: ['Bedroom'],     ai_tagged_at: '2026-04-01T00:00:01Z' },
  ];
  assert.deepEqual(extractImageUrls(raw), ['/uploads/a.jpg', '/uploads/b.jpg']);
});

test('extractImageUrls — JSON string of Gemini object array (raw DB value)', () => {
  const raw = JSON.stringify([
    { url: '/uploads/a.jpg', ai_tags: ['sofa'] },
    { url: '/uploads/b.jpg', ai_tags: ['bed'] },
  ]);
  assert.deepEqual(extractImageUrls(raw), ['/uploads/a.jpg', '/uploads/b.jpg']);
});

test('extractImageUrls — JSON string of legacy string array', () => {
  assert.deepEqual(
    extractImageUrls('["/uploads/a.jpg","/uploads/b.jpg"]'),
    ['/uploads/a.jpg', '/uploads/b.jpg']
  );
});

test('extractImageUrls — mixed legacy + Gemini entries', () => {
  const raw = [
    '/uploads/a.jpg',
    { url: '/uploads/b.jpg', ai_tags: ['x'] },
    '/uploads/c.jpg',
  ];
  assert.deepEqual(extractImageUrls(raw), ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']);
});

test('extractImageUrls — drops entries with missing/non-string url', () => {
  const raw = [
    '/uploads/a.jpg',
    { url: '' },
    { ai_tags: ['orphan'] },                 // no url field
    { url: null },
    { url: 123 },                             // non-string url
    null,
    '',
    '/uploads/z.jpg',
  ];
  assert.deepEqual(extractImageUrls(raw), ['/uploads/a.jpg', '/uploads/z.jpg']);
});

test('extractImageUrls — malformed JSON string returns empty array', () => {
  assert.deepEqual(extractImageUrls('{not json'), []);
});

test('extractImageUrls — null / undefined / non-array inputs return empty array', () => {
  assert.deepEqual(extractImageUrls(null), []);
  assert.deepEqual(extractImageUrls(undefined), []);
  assert.deepEqual(extractImageUrls(42), []);
  assert.deepEqual(extractImageUrls({}), []);
});
