#!/usr/bin/env node
// GEO 审计 CLI(站点无关)。用法:
//   node scripts/geo-audit/geo-audit.mjs --config scripts/geo-audit/config.tarmeer.json
//   node scripts/geo-audit/geo-audit.mjs --base-url https://example.com --config <path>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from './lib/extract.mjs';
import { runChecks } from './lib/checks.mjs';
import { scorePage, aggregate } from './lib/score.mjs';
import { renderReport } from './lib/report.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a, []));
if (!args.config) { console.error('用法: --config <path> [--base-url <url>]'); process.exit(1); }
const cfg = JSON.parse(readFileSync(args.config, 'utf8'));
const baseUrl = (args['base-url'] || cfg.baseUrl).replace(/\/$/, '');

async function fetchText(url, opts = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'GEO-Audit/1.0' }, ...opts });
    return { status: res.status, body: await res.text() };
  } catch (e) { return { status: 0, body: '', error: String(e) }; }
}

// robots.txt:逐 bot 判是否被 `Disallow: /`(全站封禁)。粗判,首轮够用。
function robotsAllows(robotsTxt, bot) {
  const blocks = robotsTxt.split(/(?=User-agent:)/i);
  const forBot = blocks.find(b => new RegExp(`User-agent:\\s*${bot}\\b`, 'i').test(b));
  const star = blocks.find(b => /User-agent:\s*\*/i.test(b));
  const block = forBot || star || '';
  return !/Disallow:\s*\/\s*$/im.test(block);
}

async function main() {
  const [robots, llms, sitemap] = await Promise.all([
    fetchText(`${baseUrl}/robots.txt`),
    fetchText(`${baseUrl}/llms.txt`),
    fetchText(`${baseUrl}/sitemap.xml`),
  ]);
  const robotsAllowsMap = Object.fromEntries((cfg.robotsBots || []).map(b => [b, robotsAllows(robots.body, b)]));
  const hasLlmsTxt = llms.status === 200 && llms.body.length > 20;
  const sitemapUrls = new Set((sitemap.body.match(/<loc>([^<]+)<\/loc>/gi) || []).map(m => m.replace(/<\/?loc>/gi, '')));

  const pages = [];
  for (const group of cfg.pages) {
    for (const url of group.urls) {
      const { status, body } = await fetchText(url);
      const facts = extractFacts(body);
      const site = { robotsAllows: robotsAllowsMap, hasLlmsTxt, inSitemap: sitemapUrls.has(url) };
      const checks = status === 200 ? runChecks(facts, group.pageType, site) : {};
      const page = { url, pageType: group.pageType, httpStatus: status, checks };
      page.score = status === 200 ? scorePage(page) : 0;
      pages.push(page);
    }
  }

  const scored = pages.filter(p => p.httpStatus === 200);
  const agg = aggregate(scored);
  const now = new Date().toISOString().slice(0, 10);
  const data = { baseUrl, generatedAt: now, ...agg, pages,
    siteFacts: { robotsAllowsMap, hasLlmsTxt, robotsStatus: robots.status, sitemapCount: sitemapUrls.size } };

  const outDir = path.join(ROOT, 'geo-audit');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(data, null, 2));
  writeFileSync(path.join(outDir, 'report.md'), renderReport(data));

  const failed = pages.filter(p => p.httpStatus !== 200);
  console.log(`GEO 总分 ${agg.overall}/100  (${scored.length}/${pages.length} 页可评)`);
  if (failed.length) console.log('⚠️ 非 200:', failed.map(p => `${p.httpStatus} ${p.url}`).join('; '));
  console.log('站点级:', `robots放行=${JSON.stringify(robotsAllowsMap)}`, `llms.txt=${hasLlmsTxt}`);
  console.log('Top 短板:', agg.priorities.slice(0, 5).map(p => `${p.label}(${p.priority})`).join('、'));
  console.log('→ geo-audit/report.md');
}
main();
