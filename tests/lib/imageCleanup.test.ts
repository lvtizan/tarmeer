import { describe, it, expect } from 'vitest';
import {
  imageDedupKey,
  sanitizeImageUrl,
  sanitizeImageUrls,
  sanitizeAvatarUrl,
  dedupeImageEntries,
  getNextRenderableImageIndex,
  getImageFallbackCandidates,
} from '@/lib/imageCleanup';

describe('imageDedupKey', () => {
  it('returns empty for falsy input', () => {
    expect(imageDedupKey('')).toBe('');
    expect(imageDedupKey(null)).toBe('');
    expect(imageDedupKey(undefined)).toBe('');
  });

  it('strips query parameters from root-relative URLs', () => {
    expect(imageDedupKey('/images/test.jpg?w=200')).toBe('/images/test.jpg');
  });

  it('strips query parameters from absolute URLs', () => {
    expect(imageDedupKey('https://cdn.com/img.jpg?v=1')).toBe('https://cdn.com/img.jpg');
  });

  it('handles root-relative paths', () => {
    expect(imageDedupKey('/images/photo.jpg')).toBe('/images/photo.jpg');
  });

  it('handles object with url property', () => {
    expect(imageDedupKey({ url: '/images/test.jpg?q=1' })).toBe('/images/test.jpg');
  });
});

describe('sanitizeImageUrl', () => {
  it('returns empty for falsy input', () => {
    expect(sanitizeImageUrl('')).toBe('');
    expect(sanitizeImageUrl(null)).toBe('');
  });

  it('passes through data: URLs', () => {
    expect(sanitizeImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('passes through http/https URLs', () => {
    expect(sanitizeImageUrl('https://example.com/img.jpg')).toBe('https://example.com/img.jpg');
  });

  it('prepends https: to protocol-relative URLs', () => {
    expect(sanitizeImageUrl('//example.com/img.jpg')).toBe('https://example.com/img.jpg');
  });

  it('normalizes ./ prefix', () => {
    expect(sanitizeImageUrl('./images/test.jpg')).toBe('/images/test.jpg');
  });

  it('normalizes www. prefix', () => {
    expect(sanitizeImageUrl('www.example.com/img.jpg')).toBe('https://www.example.com/img.jpg');
  });

  it('normalizes public/images/ prefix', () => {
    expect(sanitizeImageUrl('public/images/test.jpg')).toBe('/images/test.jpg');
  });

  it('normalizes bare images/ prefix', () => {
    expect(sanitizeImageUrl('images/test.jpg')).toBe('/images/test.jpg');
  });

  it('returns empty for truly unrecognized strings', () => {
    expect(sanitizeImageUrl('random-garbage')).toBe('');
  });

  it('rewrites /uploads/ to /api/uploads/', () => {
    expect(sanitizeImageUrl('/uploads/photo.jpg')).toBe('/api/uploads/photo.jpg');
  });

  it('rewrites known broken portfolio paths', () => {
    expect(sanitizeImageUrl('/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png'))
      .toBe('/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.jpg');
  });
});

describe('sanitizeImageUrls', () => {
  it('sanitizes and deduplicates an array of URLs', () => {
    const result = sanitizeImageUrls([
      '/images/a.jpg',
      '/images/a.jpg?v=1',
      '/images/b.jpg',
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContain('/images/a.jpg');
    expect(result).toContain('/images/b.jpg');
  });

  it('filters out invalid URLs', () => {
    const result = sanitizeImageUrls(['', null, undefined, '/images/valid.jpg']);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(sanitizeImageUrls([])).toEqual([]);
  });
});

describe('sanitizeAvatarUrl', () => {
  it('returns empty for seeded avatar paths', () => {
    expect(sanitizeAvatarUrl('/images/showcase/avatar-1.png')).toBe('');
    expect(sanitizeAvatarUrl('/images/showcase/avatar-42.jpg')).toBe('');
  });

  it('returns empty for known unsplash seed avatar IDs', () => {
    expect(sanitizeAvatarUrl('https://images.unsplash.com/photo-1472099645785-5658abf4ff4e')).toBe('');
  });

  it('returns sanitized URL for valid avatars', () => {
    expect(sanitizeAvatarUrl('/images/avatars/user1.jpg')).toBe('/images/avatars/user1.jpg');
  });

  it('returns empty for falsy input', () => {
    expect(sanitizeAvatarUrl('')).toBe('');
    expect(sanitizeAvatarUrl(null)).toBe('');
  });
});

describe('dedupeImageEntries', () => {
  it('deduplicates items by image URL', () => {
    const items = [
      { image: '/images/a.jpg', name: 'A' },
      { image: '/images/a.jpg?v=1', name: 'A dup' },
      { image: '/images/b.jpg', name: 'B' },
    ];
    const result = dedupeImageEntries(items);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });

  it('filters out items with empty/invalid image', () => {
    const items = [
      { image: '', name: 'empty' },
      { image: '/images/valid.jpg', name: 'valid' },
    ];
    const result = dedupeImageEntries(items);
    expect(result).toHaveLength(1);
  });
});

describe('getNextRenderableImageIndex', () => {
  it('returns the current index if it is valid', () => {
    expect(getNextRenderableImageIndex(['/a.jpg', '/b.jpg'], 0, [])).toBe(0);
  });

  it('skips failed indices', () => {
    expect(getNextRenderableImageIndex(['/a.jpg', '/b.jpg'], 0, [0])).toBe(1);
  });

  it('wraps around the array', () => {
    expect(getNextRenderableImageIndex(['/a.jpg', '/b.jpg', '/c.jpg'], 2, [2])).toBe(0);
  });

  it('returns -1 for empty images array', () => {
    expect(getNextRenderableImageIndex([], 0, [])).toBe(-1);
  });

  it('returns -1 when all indices are failed', () => {
    expect(getNextRenderableImageIndex(['/a.jpg', '/b.jpg'], 0, [0, 1])).toBe(-1);
  });
});

describe('getImageFallbackCandidates', () => {
  it('returns array with original URL for non-image URLs', () => {
    expect(getImageFallbackCandidates('/path/to/file')).toEqual(['/path/to/file']);
  });

  it('returns empty for falsy input', () => {
    expect(getImageFallbackCandidates('')).toEqual([]);
    expect(getImageFallbackCandidates(null)).toEqual([]);
  });

  it('generates fallback candidates with different extensions', () => {
    const candidates = getImageFallbackCandidates('/images/test.png');
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0]).toBe('/images/test.png');
    // Should include jpg, jpeg, webp, avif variants
    expect(candidates.some(c => c.includes('.jpg'))).toBe(true);
    expect(candidates.some(c => c.includes('.webp'))).toBe(true);
  });
});
