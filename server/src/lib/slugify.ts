export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim hyphens
}

// Common legal/generic company suffixes to strip before generating a handle
const STRIP_SUFFIXES = [
  'llc', 'ltd', 'limited', 'inc', 'incorporated', 'co', 'corp', 'corporation',
  'fze', 'fzco', 'fzc', 'pjsc', 'jsc', 'plc', 'llp', 'lp',
  'group', 'holding', 'holdings', 'international', 'global',
  'consultancy', 'consulting', 'consultants',
  'engineering', 'engineers',
  'services', 'solutions', 'management',
  'company', 'companies',
];

/**
 * Generate a social-style handle from the local part of an email address.
 * e.g. "john.smith@example.com" → "john-smith"
 *      "info@archlon.com"       → "info"
 *      "archlon2024@gmail.com"  → "archlon2024"
 */
export function generateEmailHandle(email: string): string {
  const local = email.split('@')[0] || email;
  const handle = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphens
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 25);
  if (handle) return handle;
  // Fallback for non-ASCII locals: use domain name (e.g. "archlon" from archlon.com)
  const domain = email.split('@')[1] || '';
  return domain.split('.')[0].toLowerCase().slice(0, 25) || 'company';
}

/**
 * Generate a short social-style handle from a company name.
 * e.g. "Archlon Group Engineering Consultancy LLC" → "archlon"
 *      "Woods Bagot" → "woods-bagot"
 *      "XBD Collective" → "xbd-collective"
 */
export function generateHandle(name: string): string {
  // Normalize: lowercase, remove punctuation except spaces
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words and filter out legal/generic suffixes
  const words = normalized.split(' ');
  const meaningful = words.filter(w => w.length > 0 && !STRIP_SUFFIXES.includes(w));

  // Use meaningful words if any remain, otherwise fall back to all words
  const base = (meaningful.length > 0 ? meaningful : words)
    .slice(0, 3) // max 3 words
    .join('-');

  // Truncate to 25 chars at word boundary (hyphen)
  if (base.length <= 25) return base;
  const truncated = base.slice(0, 25);
  const lastHyphen = truncated.lastIndexOf('-');
  return lastHyphen > 5 ? truncated.slice(0, lastHyphen) : truncated;
}
