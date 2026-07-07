import { applicableDimensions } from './rubric.mjs';

const typesOf = (jsonLd) => jsonLd.flatMap(b => [].concat(b['@type'] || []));
const hasType = (jsonLd, t) => typesOf(jsonLd).includes(t);
const findType = (jsonLd, t) => jsonLd.find(b => [].concat(b['@type'] || []).includes(t));

const EXPECTED_SCHEMA = {
  home:           ['Organization'],
  companyDetail:  ['LocalBusiness'],
  supplierDetail: ['LocalBusiness'],
  expertDetail:   ['Person'],
  serviceCity:    ['ItemList'],
  guide:          ['Article', 'FAQPage'],
  list:           ['ItemList', 'BreadcrumbList'],
};
const SCHEMA_ALIASES = { LocalBusiness: ['LocalBusiness', 'Organization'] };

function checkStructuredData(f, pageType) {
  const want = EXPECTED_SCHEMA[pageType] || [];
  if (!want.length) return { score: 1, evidence: { note: '该页型无 schema 要求' } };
  const missing = [];
  for (const t of want) {
    const accept = SCHEMA_ALIASES[t] || [t];
    if (!accept.some(a => hasType(f.jsonLd, a))) missing.push(t);
  }
  const parseErrors = f.jsonLd.filter(b => b.__parseError).length;
  const primary = findType(f.jsonLd, want[0]) || {};
  const qualityChecks = [
    !!f.canonical,
    !!(primary['@id']),
    (pageType === 'guide') ? !!primary.dateModified : true,
  ];
  const presenceScore = want.length ? (want.length - missing.length) / want.length : 1;
  const qualityScore = qualityChecks.filter(Boolean).length / qualityChecks.length;
  let score = presenceScore * 0.7 + qualityScore * 0.3;
  if (parseErrors) score = Math.min(score, 0.5);
  return { score: Math.max(0, Math.min(1, score)),
    evidence: { want, missing, parseErrors, canonical: !!f.canonical, hasId: !!primary['@id'] } };
}

const AI_BOTS = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'];
function checkCrawlerAccess(f, pageType, site) {
  const blocked = AI_BOTS.filter(b => site.robotsAllows?.[b] === false);
  const botScore = (AI_BOTS.length - blocked.length) / AI_BOTS.length;
  const parts = [botScore, site.hasLlmsTxt ? 1 : 0, site.inSitemap ? 1 : 0];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { blocked, hasLlmsTxt: !!site.hasLlmsTxt, inSitemap: !!site.inSitemap } };
}

function checkAnswerExtractability(f) {
  const leadOk = f.firstParagraphWords >= 40 ? 1 : f.firstParagraphWords >= 20 ? 0.5 : 0;
  const qOk = f.questionHeadings >= 2 ? 1 : f.questionHeadings === 1 ? 0.5 : 0;
  const bodyOk = f.visibleTextWords >= 300 ? 1 : f.visibleTextWords >= 100 ? 0.5 : 0;
  const score = leadOk * 0.4 + qOk * 0.3 + bodyOk * 0.3;
  return { score, reviewNeeded: true,
    evidence: { firstParagraphWords: f.firstParagraphWords, questionHeadings: f.questionHeadings, visibleTextWords: f.visibleTextWords } };
}

function checkStructuredContent(f) {
  const hasFaq = hasType(f.jsonLd, 'FAQPage');
  const parts = [f.hasTable ? 1 : 0, f.hasList ? 1 : 0, hasFaq ? 1 : 0];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, reviewNeeded: true, evidence: { hasTable: f.hasTable, hasList: f.hasList, hasFaqSchema: hasFaq } };
}

function checkEntityAuthority(f, pageType) {
  const org = findType(f.jsonLd, 'Organization') || findType(f.jsonLd, 'LocalBusiness') || {};
  const parts = [
    !!(org.name),
    !!(org.address || org.telephone) || pageType === 'guide',
    Array.isArray(org.sameAs) && org.sameAs.length > 0,
  ];
  const score = parts.filter(Boolean).length / parts.length;
  return { score, evidence: { hasName: !!org.name, hasNAP: !!(org.address || org.telephone), hasSameAs: Array.isArray(org.sameAs) && org.sameAs.length > 0 } };
}

function checkFreshness(f, pageType) {
  const primary = f.jsonLd.find(b => b.dateModified) || {};
  const hasYear = /20(2[6-9]|3\d)/.test(f.title + ' ' + f.metaDescription);
  const hasDateMod = !!primary.dateModified;
  const parts = pageType === 'guide' ? [hasYear ? 1 : 0, hasDateMod ? 1 : 0] : [hasDateMod ? 1 : 0.5];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { hasYearInTitle: hasYear, hasDateModified: hasDateMod } };
}

function checkRenderability(f) {
  const parts = [
    f.title && f.title.length > 5 ? 1 : 0,
    f.metaDescription && f.metaDescription.length > 20 ? 1 : 0,
    f.h1Count === 1 ? 1 : f.h1Count > 1 ? 0.5 : 0,
    f.visibleTextWords >= 100 ? 1 : 0,
  ];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { title: f.title, h1Count: f.h1Count, visibleTextWords: f.visibleTextWords } };
}

const CHECKERS = {
  structuredData:       (f, pt) => checkStructuredData(f, pt),
  crawlerAccess:        (f, pt, site) => checkCrawlerAccess(f, pt, site),
  answerExtractability: (f) => checkAnswerExtractability(f),
  structuredContent:    (f) => checkStructuredContent(f),
  entityAuthority:      (f, pt) => checkEntityAuthority(f, pt),
  freshness:            (f, pt) => checkFreshness(f, pt),
  renderability:        (f) => checkRenderability(f),
};

export function runChecks(facts, pageType, site = {}) {
  const out = {};
  for (const dim of applicableDimensions(pageType)) {
    out[dim] = CHECKERS[dim](facts, pageType, site);
  }
  return out;
}
