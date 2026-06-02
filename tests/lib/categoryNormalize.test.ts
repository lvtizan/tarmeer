import { describe, it, expect } from 'vitest';
import { normalizeCategory, normalizePortfolioCategories } from '@/lib/categoryNormalize';

describe('normalizeCategory', () => {
  it('returns exact match from CATEGORY_MAP', () => {
    expect(normalizeCategory('Villa')).toBe('Villa');
    expect(normalizeCategory('Hospitality')).toBe('Hospitality');
    expect(normalizeCategory('Office')).toBe('Office');
  });

  it('normalizes known aliases', () => {
    expect(normalizeCategory('Villas-Design')).toBe('Villa');
    expect(normalizeCategory('Penthouse')).toBe('Apartment');
    expect(normalizeCategory('Restaurant')).toBe('Hospitality');
    expect(normalizeCategory('Malls')).toBe('Commercial');
    expect(normalizeCategory('Offices')).toBe('Office');
    expect(normalizeCategory('Mosque')).toBe('Cultural & Public');
    expect(normalizeCategory('Landscape')).toBe('Landscape');
  });

  it('performs case-insensitive match', () => {
    expect(normalizeCategory('villa')).toBe('Villa');
    expect(normalizeCategory('HOTEL')).toBe('Hospitality');
    expect(normalizeCategory('office')).toBe('Office');
  });

  it('uses heuristic pattern matching for unknown categories', () => {
    expect(normalizeCategory('luxury-villa-dubai')).toBe('Villa');
    expect(normalizeCategory('modern-apartment-design')).toBe('Apartment');
    expect(normalizeCategory('5-star-hotel')).toBe('Hospitality');
    expect(normalizeCategory('corporate-office-fit')).toBe('Office');
    expect(normalizeCategory('shopping-mall-design')).toBe('Commercial');
    expect(normalizeCategory('hospital-interior')).toBe('Healthcare');
    expect(normalizeCategory('mosque-renovation')).toBe('Cultural & Public');
    expect(normalizeCategory('garden-landscape-design')).toBe('Landscape');
  });

  it('returns Featured Projects for long slug-like names', () => {
    expect(normalizeCategory('this-is-a-very-long-project-slug')).toBe('Featured Projects');
  });

  it('returns Featured Projects for truly unknown short names', () => {
    expect(normalizeCategory('xyz')).toBe('Featured Projects');
  });

  it('handles typo in data (Residental → Villa)', () => {
    expect(normalizeCategory('Residental')).toBe('Villa');
  });
});

describe('normalizePortfolioCategories', () => {
  it('merges raw categories into normalized display names', () => {
    const raw = {
      'Villa': [{ url: '/img/v1.jpg', title: 'V1' }],
      'Villas-Design': [{ url: '/img/v2.jpg', title: 'V2' }],
    };
    const result = normalizePortfolioCategories(raw);
    expect(result['Villa']).toHaveLength(2);
  });

  it('deduplicates images by URL', () => {
    const raw = {
      'Villa': [{ url: '/img/v1.jpg', title: 'V1' }],
      'Luxury': [{ url: '/img/v1.jpg', title: 'V1 duplicate' }],
    };
    const result = normalizePortfolioCategories(raw);
    expect(result['Villa']).toHaveLength(1);
  });

  it('filters out low-quality images (logos, icons)', () => {
    const raw = {
      'Villa': [
        { url: '/img/villa-photo.jpg', title: 'photo' },
        { url: '/img/logo-small.png', title: 'logo' },
      ],
    };
    const result = normalizePortfolioCategories(raw);
    expect(result['Villa']).toHaveLength(1);
    expect(result['Villa'][0].title).toBe('photo');
  });

  it('sorts generic categories (Projects, Featured Projects) last', () => {
    const raw = {
      'General': [{ url: '/img/g1.jpg', title: 'G1' }],
      'Villa': [{ url: '/img/v1.jpg', title: 'V1' }],
      'Office': [{ url: '/img/o1.jpg', title: 'O1' }],
    };
    const result = normalizePortfolioCategories(raw);
    const keys = Object.keys(result);
    expect(keys[keys.length - 1]).toBe('Projects');
  });

  it('returns empty object for empty input', () => {
    expect(normalizePortfolioCategories({})).toEqual({});
  });
});
