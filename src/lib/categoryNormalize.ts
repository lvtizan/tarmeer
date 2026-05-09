/**
 * Normalize scraped portfolio category names into unified display categories.
 * Maps 180+ raw category slugs to ~10 clean display names.
 */

const CATEGORY_MAP: Record<string, string> = {
  // === Standard categories (keep as-is) ===
  'Commercial': 'Commercial',
  'Hospitality': 'Hospitality',
  'Office': 'Office',
  'Retail': 'Retail',
  'Healthcare': 'Healthcare',

  // === Map to Villa ===
  'Villa': 'Villa',
  'Villas-Design': 'Villa',
  'Villa-renovation': 'Villa',
  'Luxury': 'Villa',
  'Residential': 'Villa', // legacy fallback — most "Residential" in UAE data means villa
  'Residental': 'Villa', // typo in data

  // === Map to Apartment ===
  'Apartment': 'Apartment',
  'Penthouse': 'Apartment',

  // === Map to Hospitality ===
  'Hotel': 'Hospitality',
  'Restaurant': 'Hospitality',
  'Dining': 'Hospitality',
  'Spa': 'Hospitality',
  'Salon': 'Hospitality',
  'Leisure': 'Hospitality',
  'F&B': 'Hospitality',
  'Fb': 'Hospitality',
  'F-B-Divisions': 'Hospitality',
  'Leisure-Health': 'Hospitality',
  'Entertainment': 'Hospitality',
  'Lounge': 'Hospitality',
  'Cafe': 'Hospitality',
  'Bar': 'Hospitality',

  // === Map to Commercial ===
  'Malls': 'Commercial',
  'Shopping-malls': 'Commercial',
  'Mall-fitout-companies-in-dubai': 'Commercial',
  'Malls-And-Supermarkets': 'Commercial',
  'Banks': 'Commercial',
  'Luxury-retail': 'Commercial',
  'Showroom': 'Commercial',
  'Exhibition': 'Commercial',

  // === Map to Office ===
  'Offices': 'Office',
  'Office-fitout': 'Office',
  'Workspace': 'Office',
  'Corporate-and-commercial': 'Office',
  'Office-Infrastructure': 'Office',
  'Office-difc': 'Office',
  'Officex': 'Office',

  // === Map to Cultural & Public ===
  'Cultural': 'Cultural & Public',
  'Civic-and-cultural': 'Cultural & Public',
  'Mosque': 'Cultural & Public',
  'Museum': 'Cultural & Public',
  'Education': 'Cultural & Public',
  'Transport': 'Cultural & Public',
  'Urban-design': 'Cultural & Public',

  // === Map to Landscape & Exterior ===
  'Landscape': 'Landscape',
  'Exterior': 'Landscape',

  // === Generic fallback names ===
  'Interior': 'Interior Design',
  'Design': 'Interior Design',
  'General': 'Projects',
  'Projects': 'Projects',
  'Work': 'Projects',
  'All': 'Projects',
  'Stories': 'Projects',
  'Markets': 'Projects',
  'Disciplines': 'Projects',
  'Market': 'Projects',
  'Dubai': 'Projects',
};

/**
 * Normalize a single category name.
 * If it matches a known mapping, return the clean name.
 * If it looks like a project name (contains hyphens + proper nouns), return 'Featured Projects'.
 */
export function normalizeCategory(raw: string): string {
  // Direct match
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];

  // Case-insensitive match
  const lower = raw.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }

  // Heuristic: if it contains words like villa, hotel, office etc.
  if (/villa|palace|mansion|townhouse/i.test(raw)) return 'Villa';
  if (/apartment|penthouse|flat|studio/i.test(raw)) return 'Apartment';
  if (/residence/i.test(raw)) return 'Villa'; // generic "residence" → villa in UAE context
  if (/hotel|resort|restaurant|cafe|coffee|lounge|dining|hallab/i.test(raw)) return 'Hospitality';
  if (/office|hq|headquarter|corporate|law.firm|visa/i.test(raw)) return 'Office';
  if (/mall|shop|store|retail|showroom|boutique/i.test(raw)) return 'Commercial';
  if (/hospital|clinic|healthcare|medical/i.test(raw)) return 'Healthcare';
  if (/museum|mosque|church|school|university|library|pavilion/i.test(raw)) return 'Cultural & Public';
  if (/landscape|garden|exterior|park/i.test(raw)) return 'Landscape';

  // If it's a long slug with hyphens, it's likely a project name
  if (raw.includes('-') && raw.length > 15) return 'Featured Projects';

  return 'Featured Projects';
}

export interface NormalizedCategories {
  [displayName: string]: { url: string; title: string }[];
}

/**
 * Filter out low-quality images: logos, tiny icons, placeholder images.
 */
function isHighQualityImage(url: string): boolean {
  const lower = url.toLowerCase();

  // Skip logos and icons
  if (/logo|icon|favicon|brand|badge/i.test(lower)) return false;

  // Skip tiny thumbnails (common patterns like 150x150, 32x32)
  if (/[_-](150x150|100x100|72x72|32x32|48x48|64x64|thumb|small|mini)/i.test(lower)) return false;

  // Skip placeholder/tracking images
  if (/placeholder|spacer|blank|pixel|tracking|transparent/i.test(lower)) return false;

  // Skip social media icons
  if (/facebook|twitter|linkedin|youtube|instagram|whatsapp|telegram/i.test(lower)) return false;

  // Skip common non-portfolio paths
  if (/\/wp-includes\/|\/plugins\/|\/themes\/.*\/images\//i.test(lower)) return false;

  // Skip SVG (usually icons/logos, not portfolio photos)
  if (/\.svg(\?|$)/i.test(lower)) return false;

  // Skip very short filenames (likely auto-generated icons)
  const filename = lower.split('/').pop() || '';
  if (filename.length < 3) return false;

  return true;
}

/**
 * Take raw portfolio_categories and merge into normalized display categories.
 * Deduplicates images by URL. Filters out low-quality/logo images.
 */
export function normalizePortfolioCategories(
  raw: Record<string, { url: string; title: string }[]>
): NormalizedCategories {
  const result: NormalizedCategories = {};
  const seenUrls = new Set<string>();

  for (const [rawCat, items] of Object.entries(raw)) {
    const displayName = normalizeCategory(rawCat);
    if (!result[displayName]) result[displayName] = [];

    for (const item of items) {
      if (!seenUrls.has(item.url) && isHighQualityImage(item.url)) {
        seenUrls.add(item.url);
        result[displayName].push(item);
      }
    }
  }

  // Sort: put 'Projects' and 'Featured Projects' last
  const ordered: NormalizedCategories = {};
  const keys = Object.keys(result).sort((a, b) => {
    const aGeneric = a === 'Projects' || a === 'Featured Projects' ? 1 : 0;
    const bGeneric = b === 'Projects' || b === 'Featured Projects' ? 1 : 0;
    if (aGeneric !== bGeneric) return aGeneric - bGeneric;
    return b.length - a.length; // longer names (more specific) first... actually sort by count
  });

  // Re-sort by image count descending
  keys.sort((a, b) => {
    const aGeneric = a === 'Projects' || a === 'Featured Projects' ? 1 : 0;
    const bGeneric = b === 'Projects' || b === 'Featured Projects' ? 1 : 0;
    if (aGeneric !== bGeneric) return aGeneric - bGeneric;
    return result[b].length - result[a].length;
  });

  for (const key of keys) {
    ordered[key] = result[key];
  }

  return ordered;
}
