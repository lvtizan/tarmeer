import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePage, aggregate } from '../lib/score.mjs';

const pageA = { pageType: 'guide', url: 'u1', checks: {
  structuredData: { score: 1 }, crawlerAccess: { score: 1 }, answerExtractability: { score: 1 },
  structuredContent: { score: 1 }, entityAuthority: { score: 1 }, freshness: { score: 1 }, renderability: { score: 1 } } };
const pageB = { pageType: 'guide', url: 'u2', checks: {
  structuredData: { score: 0 }, crawlerAccess: { score: 1 }, answerExtractability: { score: 0.5 },
  structuredContent: { score: 1 }, entityAuthority: { score: 1 }, freshness: { score: 1 }, renderability: { score: 1 } } };

test('单页分归一化到 0..100', () => {
  const s = scorePage(pageA);
  assert.ok(s > 90 && s <= 100);
});

test('缺 structuredData(权重20)明显拉低单页分', () => {
  assert.ok(scorePage(pageB) < scorePage(pageA) - 15);
});

test('aggregate 给出总分、页型均分、优先级清单', () => {
  const agg = aggregate([pageA, pageB]);
  assert.ok(agg.overall > 0 && agg.overall <= 100);
  assert.ok(agg.byPageType.guide >= 0);
  assert.ok(Array.isArray(agg.priorities));
  assert.equal(agg.priorities[0].dimension, 'structuredData');
});

test('优先级项含 impact/cost/affectedUrls', () => {
  const p = aggregate([pageA, pageB]).priorities[0];
  assert.ok(p.impact > 0 && p.cost > 0);
  assert.ok(p.affectedUrls.includes('u2'));
});
