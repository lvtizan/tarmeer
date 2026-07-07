import { DIMENSIONS } from './rubric.mjs';

// 单页:Σ(weight×subscore)/Σweight ×100(只算该页出现的维度)
export function scorePage(page) {
  let wsum = 0, acc = 0;
  for (const [dim, res] of Object.entries(page.checks)) {
    const w = DIMENSIONS[dim].weight;
    wsum += w; acc += w * res.score;
  }
  return wsum ? +(acc / wsum * 100).toFixed(1) : 0;
}

export function aggregate(pages) {
  const byType = {};
  for (const p of pages) {
    (byType[p.pageType] ||= []).push(scorePage(p));
  }
  const byPageType = {};
  for (const [t, arr] of Object.entries(byType)) {
    byPageType[t] = +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  }
  const typeMeans = Object.values(byPageType);
  const overall = typeMeans.length ? +(typeMeans.reduce((a, b) => a + b, 0) / typeMeans.length).toFixed(1) : 0;

  const gaps = {};
  for (const p of pages) {
    for (const [dim, res] of Object.entries(p.checks)) {
      const gap = 1 - res.score;
      if (gap <= 0.001) continue;
      const g = (gaps[dim] ||= { dimension: dim, label: DIMENSIONS[dim].label, impactRaw: 0, cost: DIMENSIONS[dim].cost, affectedUrls: [] });
      g.impactRaw += DIMENSIONS[dim].weight * gap;
      g.affectedUrls.push(p.url);
    }
  }
  const priorities = Object.values(gaps).map(g => ({
    dimension: g.dimension, label: g.label,
    impact: +g.impactRaw.toFixed(1), cost: g.cost,
    priority: +(g.impactRaw / g.cost).toFixed(1),
    affectedUrls: g.affectedUrls,
  })).sort((a, b) => b.priority - a.priority);

  return { overall, byPageType, priorities };
}
