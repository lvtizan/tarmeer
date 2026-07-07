import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../lib/report.mjs';

const data = {
  baseUrl: 'https://www.tarmeer.com', generatedAt: '2026-07-07',
  overall: 72.3, byPageType: { guide: 80, companyDetail: 65 },
  priorities: [
    { dimension: 'structuredData', label: '结构化数据/JSON-LD', impact: 20, cost: 3, priority: 6.7, affectedUrls: ['https://www.tarmeer.com/@acme'] },
  ],
  pages: [{ url: 'https://www.tarmeer.com/@acme', pageType: 'companyDetail', score: 65,
    checks: { structuredData: { score: 0.5, evidence: { missing: [] } } } }],
};

test('报告含总分、页型分、最痛短板表', () => {
  const md = renderReport(data);
  assert.match(md, /72\.3/);
  assert.match(md, /结构化数据/);
  assert.match(md, /最痛|优先级/);
  assert.match(md, /www\.tarmeer\.com/);
});

test('report 是字符串且非空', () => {
  assert.ok(typeof renderReport(data) === 'string' && renderReport(data).length > 100);
});
