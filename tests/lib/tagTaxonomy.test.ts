import { describe, it, expect } from 'vitest';
import {
  SPACE_TAXONOMY,
  SERVICE_GROUPS,
  ALL_SPACE_TAGS,
  ALL_SERVICES,
  getL1ForTag,
} from '@/lib/tagTaxonomy';

describe('SPACE_TAXONOMY', () => {
  it('has expected categories', () => {
    const ids = SPACE_TAXONOMY.map(g => g.id);
    expect(ids).toContain('villa');
    expect(ids).toContain('apartment');
    expect(ids).toContain('commercial');
    expect(ids).toContain('public');
    expect(ids).toContain('outdoor');
  });

  it('each category has an id, label, and tags', () => {
    for (const group of SPACE_TAXONOMY) {
      expect(group.id).toBeTruthy();
      expect(group.label).toBeTruthy();
      expect(group.tags.length).toBeGreaterThan(0);
    }
  });
});

describe('SERVICE_GROUPS', () => {
  it('has expected groups', () => {
    const groups = SERVICE_GROUPS.map(g => g.group);
    expect(groups).toContain('Design');
    expect(groups).toContain('Renovation');
    expect(groups).toContain('Finishes');
    expect(groups).toContain('Systems');
    expect(groups).toContain('Outdoor');
  });
});

describe('ALL_SPACE_TAGS', () => {
  it('is a flat array of all space tags', () => {
    expect(ALL_SPACE_TAGS).toContain('Villa');
    expect(ALL_SPACE_TAGS).toContain('Apartment');
    expect(ALL_SPACE_TAGS).toContain('Penthouse');
    expect(ALL_SPACE_TAGS).toContain('Garden');
  });

  it('has no duplicates', () => {
    const unique = new Set(ALL_SPACE_TAGS);
    expect(unique.size).toBe(ALL_SPACE_TAGS.length);
  });
});

describe('ALL_SERVICES', () => {
  it('is a flat array of all service tags', () => {
    expect(ALL_SERVICES).toContain('Design & Planning');
    expect(ALL_SERVICES).toContain('Flooring & Carpet');
    expect(ALL_SERVICES).toContain('Smart Home');
  });
});

describe('getL1ForTag', () => {
  it('returns the L1 category id for a known tag', () => {
    expect(getL1ForTag('Villa')).toBe('villa');
    expect(getL1ForTag('Penthouse')).toBe('apartment');
    expect(getL1ForTag('Office')).toBe('commercial');
    expect(getL1ForTag('School')).toBe('public');
    expect(getL1ForTag('Garden')).toBe('outdoor');
  });

  it('returns null for unknown tag', () => {
    expect(getL1ForTag('UnknownTag')).toBeNull();
    expect(getL1ForTag('')).toBeNull();
  });
});
