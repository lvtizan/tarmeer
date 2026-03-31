/**
 * Normalize scraped portfolio category names into unified display categories.
 * Maps 180+ raw category slugs to ~10 clean display names.
 */

const CATEGORY_MAP: Record<string, string> = {
  // === Standard categories (keep as-is) ===
  'Residential': 'Residential',
  'Commercial': 'Commercial',
  'Hospitality': 'Hospitality',
  'Office': 'Office',
  'Retail': 'Retail',
  'Healthcare': 'Healthcare',

  // === Map to Residential ===
  'Villa': 'Residential',
  'Villas-Design': 'Residential',
  'Villa-renovation': 'Residential',
  'Penthouse': 'Residential',
  'Apartment': 'Residential',
  'Residental': 'Residential', // typo in data
  'Luxury': 'Residential',

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
  if (/villa|palace|residence|mansion|townhouse|apartment/i.test(raw)) return 'Residential';
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
 * Take raw portfolio_categories and merge into normalized display categories.
 * Deduplicates images by URL.
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
      if (!seenUrls.has(item.url)) {
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
