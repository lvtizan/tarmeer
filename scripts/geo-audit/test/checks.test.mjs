import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from '../lib/extract.mjs';
import { runChecks } from '../lib/checks.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const good = extractFacts(readFileSync(path.join(dir, 'fixtures/good-guide.html'), 'utf8'));
const bad = extractFacts(readFileSync(path.join(dir, 'fixtures/bad-thin.html'), 'utf8'));

const siteOk = { robotsAllows: { GPTBot: true, PerplexityBot: true, ClaudeBot: true, 'Google-Extended': true }, hasLlmsTxt: true, inSitemap: true };
const siteBad = { robotsAllows: { GPTBot: false, PerplexityBot: false, ClaudeBot: false, 'Google-Extended': false }, hasLlmsTxt: false, inSitemap: false };

test('好 guide:structuredData 满分(Article+FAQPage+dateModified)', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.structuredData.score, 1);
});

test('好 guide:crawlerAccess 满分', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.crawlerAccess.score, 1);
});

test('坏页:crawlerAccess 低分且证据列出被封爬虫', () => {
  const r = runChecks(bad, 'guide', siteBad);
  assert.ok(r.crawlerAccess.score < 0.5);
  assert.ok(r.crawlerAccess.evidence.blocked.length >= 4);
});

test('answerExtractability 标记 reviewNeeded=true(薄 C 层)', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.answerExtractability.reviewNeeded, true);
  assert.ok(r.answerExtractability.score > 0.5);
});

test('坏页:renderability 低(无 h1/描述,正文空)', () => {
  const r = runChecks(bad, 'guide', siteBad);
  assert.ok(r.renderability.score < 0.5);
});

test('只返回该页型适用维度', () => {
  const r = runChecks(good, 'list', siteOk);
  assert.ok(!('answerExtractability' in r));
  assert.ok('structuredData' in r);
});
