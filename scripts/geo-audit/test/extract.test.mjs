import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from '../lib/extract.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const good = readFileSync(path.join(dir, 'fixtures/good-guide.html'), 'utf8');
const bad = readFileSync(path.join(dir, 'fixtures/bad-thin.html'), 'utf8');

test('抽出所有 JSON-LD 块并解析类型', () => {
  const f = extractFacts(good);
  const types = f.jsonLd.flatMap(b => [].concat(b['@type'] || []));
  assert.ok(types.includes('Article'));
  assert.ok(types.includes('FAQPage'));
});

test('抽 title/description/canonical/h1', () => {
  const f = extractFacts(good);
  assert.match(f.title, /Renovation Cost in Dubai 2026/);
  assert.ok(f.metaDescription.length > 0);
  assert.equal(f.canonical, 'https://www.tarmeer.com/guide/renovation-cost-dubai');
  assert.equal(f.h1Count, 1);
});

test('抽 hreflang 对', () => {
  const f = extractFacts(good);
  assert.deepEqual(f.hreflang.sort(), ['ar', 'en']);
});

test('检测问句型小标题与表格/清单', () => {
  const f = extractFacts(good);
  assert.ok(f.questionHeadings >= 2);
  assert.ok(f.hasTable);
  assert.ok(f.hasList);
});

test('抽首段(用于答案可摘取性代理)', () => {
  const f = extractFacts(good);
  assert.ok(f.firstParagraphWords >= 20);
});

test('坏样例:无 JSON-LD、body 文本极少', () => {
  const f = extractFacts(bad);
  assert.equal(f.jsonLd.length, 0);
  assert.ok(f.visibleTextWords < 10);
  assert.equal(f.canonical, null);
});
