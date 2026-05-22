// server/src/services/tagEngine/metadataTagger.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractTagsFromMetadata } from './metadataTagger';

test('从分类名检测卧室', () => {
  const tags = extractTagsFromMetadata({ style: null, description: null, categoryNames: ['Master Bedroom'] });
  assert.ok(tags.some(t => t.tag === 'Bedroom'), `got: ${JSON.stringify(tags)}`);
});

test('从 villa style 检测 Luxury', () => {
  const tags = extractTagsFromMetadata({ style: 'Villa', description: null, categoryNames: [] });
  assert.ok(tags.some(t => t.tag === 'Luxury'), `got: ${JSON.stringify(tags)}`);
});

test('从 description 同时检测 Modern 和 Minimalist', () => {
  const tags = extractTagsFromMetadata({ style: null, description: 'A modern minimalist apartment', categoryNames: [] });
  assert.ok(tags.some(t => t.tag === 'Modern'));
  assert.ok(tags.some(t => t.tag === 'Minimalist'));
});

test('Majlis 同时触发 Majlis 和 Arabic', () => {
  const tags = extractTagsFromMetadata({ style: null, description: null, categoryNames: ['Majlis Design'] });
  assert.ok(tags.some(t => t.tag === 'Majlis'));
  assert.ok(tags.some(t => t.tag === 'Arabic'));
});

test('无元数据返回空数组', () => {
  const tags = extractTagsFromMetadata({ style: null, description: null, categoryNames: [] });
  assert.equal(tags.length, 0);
});

test('所有结果 confidence=1.0 source=metadata', () => {
  const tags = extractTagsFromMetadata({ style: 'Modern', description: null, categoryNames: [] });
  assert.ok(tags.every(t => t.confidence === 1.0 && t.source === 'metadata'));
});
