import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, PAGE_TYPES, applicableDimensions } from '../lib/rubric.mjs';

test('本轮 7 个计分维度,权重和为 88(阿语维度不计分)', () => {
  const scored = Object.values(DIMENSIONS).filter(d => d.scored);
  const sum = scored.reduce((a, d) => a + d.weight, 0);
  assert.equal(sum, 88);
});

test('每个维度有正的成本常量(用于优先级)', () => {
  for (const d of Object.values(DIMENSIONS)) assert.ok(d.cost > 0, `${d.id} 缺 cost`);
});

test('guide 页适用维度含 structuredData 与 answerExtractability', () => {
  const dims = applicableDimensions('guide');
  assert.ok(dims.includes('structuredData'));
  assert.ok(dims.includes('answerExtractability'));
});

test('list 页不跑 answerExtractability', () => {
  assert.ok(!applicableDimensions('list').includes('answerExtractability'));
});
