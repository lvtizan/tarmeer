/** Convert imported rich text to display-only plain text. Never render source HTML. */
function plainDescription(value: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', ndash: '–', mdash: '—', bull: '•', middot: '·', times: '×', le: '≤', ge: '≥', deg: '°', sup2: '²', sup3: '³', copy: '©', reg: '®' };
  const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
    const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
  // Decode before removing markup, including HTML stored as escaped text.
  let text = value;
  for (let i = 0; i < 3; i++) text = decode(text);
  return text
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|iframe|object|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<\/?(?:p|div|h[1-6]|ul|ol|table|tr|blockquote|section)\b[^>]*>/gi, '\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:li|td|th)\s*>/gi, '\n')
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi, '')
    .replace(/[\t \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n');
}

/** Remove wholesale-only price data and internal import metadata from public copy. */
export function sanitizeDescription(value: unknown): string | null {
  if (value == null) return null;
  const cleaned = plainDescription(String(value))
    .replace(/price\s*:\s*[^|\n]*/gi, '')
    .replace(/moq\s*:\s*[^|\n]*/gi, '')
    .replace(/min\.?\s*order\s*:?\s*[^|\n]*/gi, '')
    .replace(/(?:CN¥|US\$|¥)\s*[\d.,]+(?:\s*[-–~]\s*[\d.,]+)?/g, '')
    .replace(/\s*\[catalog-import:[^\]]+\]\s*/gi, ' ')
    .replace(/\s*\|\s*(?=\||$)/gm, '')
    .replace(/^[\t |]+|[\t |]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}
