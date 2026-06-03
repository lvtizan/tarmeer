import { describe, it, expect } from 'vitest';
import { toNumber, formatCount } from '@/lib/formatNumber';

describe('toNumber', () => {
  it('converts numeric strings', () => {
    expect(toNumber('42')).toBe(42);
  });

  it('converts actual numbers', () => {
    expect(toNumber(3.14)).toBe(3.14);
  });

  it('returns 0 for null/undefined', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it('returns 0 for NaN-producing values', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
  });

  it('converts boolean values', () => {
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
  });
});

describe('formatCount', () => {
  it('formats numbers with commas (en-US)', () => {
    expect(formatCount(1000)).toBe('1,000');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('formats small numbers without commas', () => {
    expect(formatCount(42)).toBe('42');
  });

  it('handles null/undefined as 0', () => {
    expect(formatCount(null)).toBe('0');
    expect(formatCount(undefined)).toBe('0');
  });

  it('handles string input', () => {
    expect(formatCount('5000')).toBe('5,000');
  });

  it('handles non-numeric string as 0', () => {
    expect(formatCount('abc')).toBe('0');
  });
});
