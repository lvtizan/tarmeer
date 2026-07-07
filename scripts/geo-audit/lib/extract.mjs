// 纯函数:服务端 HTML 字符串 → 结构化事实。零依赖,正则解析。
// 目标是"AI 爬虫看到什么",故只看 HTML 里已有的文本,不执行 JS。

const stripTags = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ').trim();

const wordCount = (s) => (s.match(/\S+/g) || []).length;

function parseJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (parsed['@graph']) out.push(...parsed['@graph']);
      else out.push(parsed);
    } catch { out.push({ __parseError: true }); }
  }
  return out;
}

function attr(html, tagRe) { const m = html.match(tagRe); return m ? m[1].trim() : null; }

export function extractFacts(html) {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : html;
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const body = bodyMatch ? bodyMatch[0] : html;

  const title = attr(head, /<title[^>]*>([\s\S]*?)<\/title>/i) || '';
  const metaDescription = attr(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || '';
  const canonical = attr(head, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const htmlLang = attr(html, /<html[^>]*\blang=["']([^"']*)["']/i);
  const htmlDir = attr(html, /<html[^>]*\bdir=["']([^"']*)["']/i);

  const hreflang = [];
  const hlRe = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']*)["']/gi;
  let hm; while ((hm = hlRe.exec(head))) hreflang.push(hm[1]);

  const h1s = body.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const headings = body.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi) || [];
  const questionHeadings = headings.filter(h => stripTags(h).includes('?')).length;

  const firstP = (body.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';

  return {
    jsonLd: parseJsonLd(html),
    title, metaDescription, canonical, htmlLang, htmlDir,
    hreflang,
    h1Count: h1s.length,
    h1Text: h1s.map(stripTags),
    headingCount: headings.length,
    questionHeadings,
    firstParagraphWords: wordCount(stripTags(firstP)),
    hasTable: /<table[\s>]/i.test(body),
    hasList: /<(ul|ol)[\s>]/i.test(body),
    visibleTextWords: wordCount(stripTags(body)),
  };
}
