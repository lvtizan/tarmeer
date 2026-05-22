import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeTags, toTagStrings } from './tagMerger';

test('B layer wins over C layer for same tag', () => {
  const meta = [{ tag: 'Bedroom', confidence: 0.8, source: 'metadata' as const }];
  const clip = [
    { tag: 'Bedroom', confidence: 0.3, source: 'clip' as const },
    { tag: 'Modern', confidence: 0.4, source: 'clip' as const },
  ];
  const result = mergeTags(meta, clip);
  assert.equal(result.find(r => r.tag === 'Bedroom')?.source, 'metadata');
  assert.ok(result.some(r => r.tag === 'Modern'));
});

test('deduplication: same tag appears only once', () => {
  const meta = [{ tag: 'Modern', confidence: 0.8, source: 'metadata' as const }];
  const clip = [{ tag: 'Modern', confidence: 0.5, source: 'clip' as const }];
  assert.equal(mergeTags(meta, clip).filter(r => r.tag === 'Modern').length, 1);
});

test('returns union of both layers', () => {
  const meta = [{ tag: 'Bedroom', confidence: 0.8, source: 'metadata' as const }];
  const clip = [{ tag: 'Luxury', confidence: 0.5, source: 'clip' as const }];
  assert.equal(mergeTags(meta, clip).length, 2);
});

test('empty meta returns clip tags only', () => {
  const clip = [{ tag: 'Modern', confidence: 0.4, source: 'clip' as const }];
  assert.equal(mergeTags([], clip).length, 1);
  assert.equal(mergeTags([], clip)[0].source, 'clip');
});

test('empty clip returns meta tags only', () => {
  const meta = [{ tag: 'Bedroom', confidence: 0.8, source: 'metadata' as const }];
  assert.equal(mergeTags(meta, []).length, 1);
  assert.equal(mergeTags(meta, [])[0].source, 'metadata');
});

test('toTagStrings returns string array', () => {
  const merged = [{ tag: 'Modern', confidence: 0.8, source: 'metadata' as const }];
  assert.deepEqual(toTagStrings(merged), ['Modern']);
});
