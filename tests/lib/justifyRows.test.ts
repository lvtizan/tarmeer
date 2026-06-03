import { describe, it, expect } from 'vitest';
import {
  justifyRows,
  GAP,
  TARGET_ROW_HEIGHT,
  MAX_ROW_HEIGHT,
  MAX_HERO_HEIGHT,
  MIN_ROW_HEIGHT,
  DEFAULT_RATIO,
  IDEAL_ROW_COUNT,
} from '@/lib/justifyRows';

describe('constants', () => {
  it('exports expected constant values', () => {
    expect(GAP).toBe(6);
    expect(TARGET_ROW_HEIGHT).toBe(280);
    expect(MAX_ROW_HEIGHT).toBe(420);
    expect(MAX_HERO_HEIGHT).toBe(520);
    expect(MIN_ROW_HEIGHT).toBe(180);
    expect(DEFAULT_RATIO).toBe(1.33);
    expect(IDEAL_ROW_COUNT).toBe(4);
  });
});

describe('justifyRows', () => {
  it('returns empty array for empty ratios', () => {
    expect(justifyRows([], 1000, TARGET_ROW_HEIGHT)).toEqual([]);
  });

  it('returns empty array for zero container width', () => {
    expect(justifyRows([1.5], 0, TARGET_ROW_HEIGHT)).toEqual([]);
  });

  it('returns empty array for negative container width', () => {
    expect(justifyRows([1.5], -100, TARGET_ROW_HEIGHT)).toEqual([]);
  });

  // N=1: single hero image
  describe('single image (N=1)', () => {
    it('produces a single row with one image', () => {
      const rows = justifyRows([1.5], 1000, TARGET_ROW_HEIGHT);
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(1);
      expect(rows[0].startIdx).toBe(0);
    });

    it('clamps height to MAX_HERO_HEIGHT for tall images', () => {
      const rows = justifyRows([0.5], 1000, TARGET_ROW_HEIGHT); // portrait → tall
      expect(rows[0].height).toBeLessThanOrEqual(MAX_HERO_HEIGHT);
      expect(rows[0].height).toBeGreaterThanOrEqual(MIN_ROW_HEIGHT);
    });
  });

  // N=2,3: single row
  describe('2-3 images (single row)', () => {
    it('produces a single row for 2 images', () => {
      const rows = justifyRows([1.5, 1.2], 1000, TARGET_ROW_HEIGHT);
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(2);
    });

    it('produces a single row for 3 images', () => {
      const rows = justifyRows([1.5, 1.2, 1.8], 1000, TARGET_ROW_HEIGHT);
      expect(rows).toHaveLength(1);
      expect(rows[0].count).toBe(3);
    });

    it('row widths array has correct length', () => {
      const rows = justifyRows([1.5, 1.2], 1000, TARGET_ROW_HEIGHT);
      expect(rows[0].widths).toHaveLength(2);
    });
  });

  // N≥4: DP layout
  describe('4+ images (DP layout)', () => {
    it('produces multiple rows for many images', () => {
      const ratios = [1.5, 1.2, 1.8, 1.3, 1.6, 1.4, 1.1, 1.7];
      const rows = justifyRows(ratios, 1000, TARGET_ROW_HEIGHT);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      // Total images across all rows should equal input
      const totalCount = rows.reduce((s, r) => s + r.count, 0);
      expect(totalCount).toBe(ratios.length);
    });

    it('each row has valid startIdx and count', () => {
      const ratios = [1.5, 1.2, 1.8, 1.3, 1.6, 1.4];
      const rows = justifyRows(ratios, 1000, TARGET_ROW_HEIGHT);
      let idx = 0;
      for (const row of rows) {
        expect(row.startIdx).toBe(idx);
        expect(row.count).toBeGreaterThan(0);
        expect(row.widths).toHaveLength(row.count);
        idx += row.count;
      }
      expect(idx).toBe(ratios.length);
    });

    it('row heights stay within MIN_ROW_HEIGHT and reasonable upper bound', () => {
      const ratios = Array.from({ length: 12 }, () => 1.5);
      const rows = justifyRows(ratios, 1000, TARGET_ROW_HEIGHT);
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(MIN_ROW_HEIGHT);
        // Last row gets 1.15x ceiling
        expect(row.height).toBeLessThanOrEqual(MAX_ROW_HEIGHT * 1.2);
      }
    });

    it('handles uniform ratios', () => {
      const ratios = Array.from({ length: 8 }, () => DEFAULT_RATIO);
      const rows = justifyRows(ratios, 1200, TARGET_ROW_HEIGHT);
      const totalCount = rows.reduce((s, r) => s + r.count, 0);
      expect(totalCount).toBe(8);
    });

    it('handles extreme aspect ratios (very wide)', () => {
      const ratios = [5.0, 4.0, 3.0, 2.0]; // very wide images
      const rows = justifyRows(ratios, 1000, TARGET_ROW_HEIGHT);
      const totalCount = rows.reduce((s, r) => s + r.count, 0);
      expect(totalCount).toBe(4);
    });
  });
});
