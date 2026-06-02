import { describe, it, expect } from 'vitest';
import { sanitizePhoneDigits, sanitizeAreaInput, sanitizePersonName } from '@/lib/formInputRules';

describe('sanitizePhoneDigits', () => {
  it('strips non-digit characters', () => {
    expect(sanitizePhoneDigits('+971-50-123-4567')).toBe('971501234567');
  });

  it('limits to 15 digits', () => {
    expect(sanitizePhoneDigits('12345678901234567890')).toBe('123456789012345');
  });

  it('returns empty for non-numeric input', () => {
    expect(sanitizePhoneDigits('abc')).toBe('');
  });

  it('keeps pure digits unchanged', () => {
    expect(sanitizePhoneDigits('501234567')).toBe('501234567');
  });
});

describe('sanitizeAreaInput', () => {
  it('strips non-numeric/non-dot characters', () => {
    expect(sanitizeAreaInput('12.5 sqm')).toBe('12.5');
  });

  it('keeps only the first decimal point', () => {
    expect(sanitizeAreaInput('12.5.3')).toBe('12.53');
  });

  it('returns whole number without dots', () => {
    expect(sanitizeAreaInput('150')).toBe('150');
  });

  it('strips all non-numeric chars', () => {
    expect(sanitizeAreaInput('abc')).toBe('');
  });

  it('handles leading dot', () => {
    expect(sanitizeAreaInput('.5')).toBe('.5');
  });
});

describe('sanitizePersonName', () => {
  it('keeps valid characters', () => {
    expect(sanitizePersonName("John O'Brien-Smith")).toBe("John O'Brien-Smith");
  });

  it('strips invalid characters', () => {
    expect(sanitizePersonName('John123!@#')).toBe('John');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizePersonName('John   Doe')).toBe('John Doe');
  });

  it('truncates to 50 characters', () => {
    const longName = 'A'.repeat(60);
    expect(sanitizePersonName(longName).length).toBe(50);
  });

  it('allows Unicode letters (Arabic, Chinese, etc.)', () => {
    expect(sanitizePersonName('محمد')).toBe('محمد');
    expect(sanitizePersonName('王小明')).toBe('王小明');
  });
});
