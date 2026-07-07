export function renderReport(d) {
  const lines = [];
  lines.push(`# GEO 审计报告 — ${d.baseUrl}`);
  lines.push('');
  lines.push(`**生成时间**: ${d.generatedAt}`);
  lines.push(`**总分**: **${d.overall} / 100**`);
  lines.push('');
  lines.push('## 各页型得分');
  lines.push('| 页型 | 分数 |');
  lines.push('|------|-----:|');
  for (const [t, s] of Object.entries(d.byPageType)) lines.push(`| ${t} | ${s} |`);
  lines.push('');
  lines.push('## 最痛短板(按 优先级=影响/成本 降序)');
  lines.push('| # | 维度 | 影响 | 成本 | 优先级 | 命中页数 |');
  lines.push('|---|------|-----:|-----:|-------:|--------:|');
  d.priorities.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.label} | ${p.impact} | ${p.cost} | ${p.priority} | ${p.affectedUrls.length} |`);
  });
  lines.push('');
  lines.push('## 逐页明细');
  for (const p of d.pages) {
    lines.push(`### ${p.pageType} — ${p.url} · ${p.score}/100`);
    for (const [dim, res] of Object.entries(p.checks)) {
      const flag = res.reviewNeeded ? ' 🧑需人判' : '';
      lines.push(`- **${dim}**: ${(res.score * 100).toFixed(0)}%${flag} — \`${JSON.stringify(res.evidence || {})}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}
