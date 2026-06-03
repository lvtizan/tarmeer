import { describe, it, expect } from 'vitest';
import {
  SERVICE_CATEGORIES,
  SPACE_TYPES,
  MAX_SERVICE_CATEGORIES,
  getCategoryForSub,
  getActiveParents,
} from '@/lib/serviceCategories';

describe('SERVICE_CATEGORIES', () => {
  it('has expected categories', () => {
    const names = SERVICE_CATEGORIES.map(c => c.name);
    expect(names).toContain('Design & Planning');
    expect(names).toContain('Construction');
    expect(names).toContain('Renovation');
    expect(names).toContain('Maintenance');
  });

  it('each category has a name and subs array', () => {
    for (const cat of SERVICE_CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.subs.length).toBeGreaterThan(0);
    }
  });
});

describe('SPACE_TYPES', () => {
  it('contains expected space types', () => {
    expect(SPACE_TYPES).toContain('Villa');
    expect(SPACE_TYPES).toContain('Apartment');
    expect(SPACE_TYPES).toContain('Commercial');
  });
});

describe('MAX_SERVICE_CATEGORIES', () => {
  it('is 5', () => {
    expect(MAX_SERVICE_CATEGORIES).toBe(5);
  });
});

describe('getCategoryForSub', () => {
  it('returns parent category for known subcategory', () => {
    expect(getCategoryForSub('Interior Design')).toBe('Design & Planning');
    expect(getCategoryForSub('Full Renovation')).toBe('Renovation');
    expect(getCategoryForSub('Pool Construction')).toBe('Outdoor & Pools');
    expect(getCategoryForSub('MEP')).toBe('Home Systems');
  });

  it('returns null for unknown subcategory', () => {
    expect(getCategoryForSub('Unknown Service')).toBeNull();
    expect(getCategoryForSub('')).toBeNull();
  });
});

describe('getActiveParents', () => {
  it('returns unique parent categories for given subs', () => {
    const result = getActiveParents(['Interior Design', 'Architecture', 'Full Renovation']);
    expect(result).toContain('Design & Planning');
    expect(result).toContain('Renovation');
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(getActiveParents([])).toEqual([]);
  });

  it('returns empty array when no subs match', () => {
    expect(getActiveParents(['Unknown'])).toEqual([]);
  });

  it('deduplicates parents', () => {
    const result = getActiveParents(['Interior Design', 'Architecture', 'Spatial Planning']);
    expect(result).toEqual(['Design & Planning']);
  });
});
