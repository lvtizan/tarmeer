#!/usr/bin/env node
/**
 * Build a single styled HTML file from all tech manual markdown chapters.
 * Output: docs/tech-manual.html
 *
 * Usage: node docs/build-tech-manual.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const DIR = new URL('./tech-manual/', import.meta.url).pathname;
const OVERVIEW = new URL('./TECH-MANUAL.md', import.meta.url).pathname;
const OUT = new URL('./tech-manual.html', import.meta.url).pathname;

// ── Minimal Markdown → HTML ──────────────────────────────────────────

function md2html(md) {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="lang-${lang || 'text'}">${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, sep, body) => {
    const thCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists (simple single-level)
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs (lines that aren't already tagged)
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up double blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  return html;
}

// ── Build TOC + chapters ─────────────────────────────────────────────

const chapters = [
  { id: 'overview', title: 'Tarmeer 4.0 技术手册', file: OVERVIEW },
];

const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== '00-INDEX.md').sort();
for (const f of files) {
  const content = readFileSync(join(DIR, f), 'utf8');
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : f.replace('.md', '');
  const id = f.replace('.md', '');
  chapters.push({ id, title, file: join(DIR, f) });
}

let tocHtml = '';
let bodyHtml = '';

for (const ch of chapters) {
  const raw = readFileSync(ch.file, 'utf8');
  tocHtml += `<a href="#${ch.id}" class="toc-item">${ch.title}</a>\n`;
  bodyHtml += `<section id="${ch.id}">\n${md2html(raw)}\n</section>\n<div class="page-break"></div>\n`;
}

// ── Assemble HTML ────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tarmeer 4.0 技术手册</title>
<style>
  :root {
    --gold: #b8864a;
    --text: #2c2c2c;
    --muted: #6b6b6b;
    --bg: #faf9f7;
    --card: #fff;
    --border: #e7e5e4;
    --code-bg: #f5f2ed;
    --sidebar-w: 280px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
    background: var(--bg);
    line-height: 1.7;
    font-size: 15px;
  }

  /* ── Sidebar TOC ── */
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    width: var(--sidebar-w);
    height: 100vh;
    overflow-y: auto;
    background: var(--card);
    border-right: 1px solid var(--border);
    padding: 24px 16px;
    z-index: 100;
  }

  .sidebar-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--gold);
  }

  .toc-item {
    display: block;
    padding: 6px 10px;
    margin: 2px 0;
    font-size: 13px;
    color: var(--muted);
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.15s;
    line-height: 1.4;
  }
  .toc-item:hover { background: #f5f0e8; color: var(--text); }
  .toc-item.active { background: #f5f0e8; color: var(--gold); font-weight: 600; }

  /* ── Main content ── */
  .main {
    margin-left: var(--sidebar-w);
    max-width: 860px;
    padding: 40px 48px 80px;
  }

  section {
    margin-bottom: 20px;
  }

  h1 {
    font-size: 28px;
    font-weight: 800;
    color: var(--text);
    margin: 48px 0 20px;
    padding-bottom: 12px;
    border-bottom: 3px solid var(--gold);
  }
  section:first-child h1:first-child { margin-top: 0; }

  h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    margin: 36px 0 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  h3 {
    font-size: 16px;
    font-weight: 700;
    color: var(--gold);
    margin: 24px 0 10px;
  }

  h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--muted);
    margin: 20px 0 8px;
  }

  p { margin: 8px 0; }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 32px 0;
  }

  strong { font-weight: 700; }

  code {
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
  }

  pre {
    background: #1c1917;
    color: #e7e5e4;
    padding: 16px 20px;
    border-radius: 10px;
    overflow-x: auto;
    margin: 14px 0;
    line-height: 1.5;
  }
  pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: 13px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 14px;
  }
  thead { background: #f5f0e8; }
  th {
    text-align: left;
    padding: 10px 14px;
    font-weight: 600;
    color: var(--text);
    border-bottom: 2px solid var(--gold);
    white-space: nowrap;
  }
  td {
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  tr:hover td { background: #faf9f7; }

  blockquote {
    border-left: 3px solid var(--gold);
    padding: 8px 16px;
    margin: 14px 0;
    color: var(--muted);
    background: #faf8f5;
    border-radius: 0 8px 8px 0;
  }

  ul, ol {
    padding-left: 24px;
    margin: 8px 0;
  }
  li { margin: 4px 0; }

  .page-break {
    page-break-after: always;
    break-after: page;
    height: 0;
  }

  /* ── Mobile ── */
  @media (max-width: 900px) {
    .sidebar { display: none; }
    .main { margin-left: 0; padding: 24px 20px; }
  }

  /* ── Print ── */
  @media print {
    .sidebar { display: none; }
    .main { margin-left: 0; padding: 0; max-width: 100%; }
    body { font-size: 12px; background: white; }
    h1 { font-size: 22px; page-break-after: avoid; }
    h2 { font-size: 17px; page-break-after: avoid; }
    pre { font-size: 11px; }
    table { font-size: 11px; }
    .page-break { page-break-after: always; }
  }
</style>
</head>
<body>

<nav class="sidebar">
  <div class="sidebar-title">Tarmeer 技术手册</div>
  ${tocHtml}
</nav>

<main class="main">
  ${bodyHtml}
</main>

<script>
// Highlight active TOC item on scroll
const sections = document.querySelectorAll('section[id]');
const tocLinks = document.querySelectorAll('.toc-item');

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      tocLinks.forEach(a => a.classList.remove('active'));
      const active = document.querySelector('.toc-item[href="#' + entry.target.id + '"]');
      if (active) active.classList.add('active');
    }
  }
}, { rootMargin: '-20% 0px -70% 0px' });

sections.forEach(s => observer.observe(s));

// Smooth scroll
tocLinks.forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
</script>
</body>
</html>`;

writeFileSync(OUT, html, 'utf8');
console.log(`Built: ${OUT}`);
console.log(`Chapters: ${chapters.length}`);
console.log(`Size: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
