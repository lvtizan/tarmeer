import { describe, it, expect } from 'vitest';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

describe('formatAdminDateTime', () => {
  it('formats a Date object', () => {
    const d = new Date(2026, 4, 4, 15, 23); // May 4, 2026 15:23
    expect(formatAdminDateTime(d)).toBe('2026/05/04 15:23');
  });

  it('formats an ISO date string', () => {
    const result = formatAdminDateTime('2026-01-15T08:05:00Z');
    // Exact output depends on local timezone, but should match pattern
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it('returns dash for null', () => {
    expect(formatAdminDateTime(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatAdminDateTime(undefined)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatAdminDateTime('')).toBe('—');
  });

  it('returns dash for invalid date string', () => {
    expect(formatAdminDateTime('not-a-date')).toBe('—');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5, 3, 7); // Jan 5, 2026 03:07
    expect(formatAdminDateTime(d)).toBe('2026/01/05 03:07');
  });
});

describe('ADMIN_TIME_CLS', () => {
  it('contains expected Tailwind classes', () => {
    expect(ADMIN_TIME_CLS).toContain('text-[15px]');
    expect(ADMIN_TIME_CLS).toContain('tabular-nums');
  });
});
