/** Remove wholesale-only price data and internal import metadata from public copy. */
export function sanitizeDescription(value: unknown): string | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/price\s*:\s*[^|\n]*/gi, '')
    .replace(/moq\s*:\s*[^|\n]*/gi, '')
    .replace(/min\.?\s*order\s*:?\s*[^|\n]*/gi, '')
    .replace(/(?:CN¥|US\$|¥)\s*[\d.,]+(?:\s*[-–~]\s*[\d.,]+)?/g, '')
    .replace(/\s*\[catalog-import:[^\]]+\]\s*/gi, ' ')
    .replace(/\s*\|\s*(?=\||$)/gm, '')
    .replace(/^[\s|]+|[\s|]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}
