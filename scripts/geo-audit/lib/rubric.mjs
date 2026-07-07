// GEO rubric v1 — 权重/成本/页型适用性。阿语维度(localization)本轮 scored:false。
// 成本 cost:1=极低,2=低,3=中,5=高(修复相对工作量,用于 优先级=影响/成本)。
export const DIMENSIONS = {
  structuredData:       { id: 'structuredData',       label: '结构化数据/JSON-LD', weight: 20, cost: 3, scored: true,  auto: true  },
  crawlerAccess:        { id: 'crawlerAccess',        label: 'AI 爬虫可达性',      weight: 15, cost: 1, scored: true,  auto: true  },
  answerExtractability: { id: 'answerExtractability', label: '答案可摘取性',        weight: 20, cost: 3, scored: true,  auto: false },
  structuredContent:    { id: 'structuredContent',    label: '结构化内容块',        weight: 12, cost: 3, scored: true,  auto: false },
  entityAuthority:      { id: 'entityAuthority',      label: '实体与权威信号',      weight: 12, cost: 3, scored: true,  auto: true  },
  localization:         { id: 'localization',         label: '多语言/本地化',       weight: 12, cost: 5, scored: false, auto: true  },
  freshness:            { id: 'freshness',            label: '新鲜度信号',          weight: 5,  cost: 2, scored: true,  auto: true  },
  renderability:        { id: 'renderability',        label: '可渲染性',            weight: 4,  cost: 2, scored: true,  auto: true  },
};

export const PAGE_TYPES = {
  home:           ['structuredData', 'crawlerAccess', 'entityAuthority', 'freshness', 'renderability'],
  companyDetail:  ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  supplierDetail: ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  expertDetail:   ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  serviceCity:    ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  guide:          ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  list:           ['structuredData', 'crawlerAccess', 'entityAuthority', 'renderability'],
};

export function applicableDimensions(pageType) {
  const dims = PAGE_TYPES[pageType];
  if (!dims) throw new Error(`未知页型: ${pageType}`);
  return dims.filter(id => DIMENSIONS[id].scored);
}
