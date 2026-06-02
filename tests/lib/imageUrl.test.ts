import { describe, it, expect } from 'vitest';
import { resolveImageUrl, resolveVariantUrl } from '@/lib/imageUrl';

describe('resolveImageUrl', () => {
  it('returns empty string for falsy input', () => {
    expect(resolveImageUrl('')).toBe('');
    expect(resolveImageUrl(null)).toBe('');
    expect(resolveImageUrl(undefined)).toBe('');
    expect(resolveImageUrl(0)).toBe('');
  });

  it('returns empty for non-string non-object input', () => {
    expect(resolveImageUrl(42)).toBe('');
    expect(resolveImageUrl(true)).toBe('');
  });

  it('passes through data: URLs', () => {
    expect(resolveImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('passes through http/https URLs unchanged (non-admin)', () => {
    expect(resolveImageUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
  });

  it('prepends https: to protocol-relative URLs', () => {
    expect(resolveImageUrl('//cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
  });

  it('normalizes ./ prefix', () => {
    expect(resolveImageUrl('./images/test.jpg')).toBe('/images/test.jpg');
  });

  it('normalizes public/images/ prefix', () => {
    expect(resolveImageUrl('public/images/test.jpg')).toBe('/images/test.jpg');
  });

  it('normalizes public/uploads/ prefix', () => {
    expect(resolveImageUrl('public/uploads/test.jpg')).toBe('/api/uploads/test.jpg');
  });

  it('normalizes bare images/ prefix', () => {
    expect(resolveImageUrl('images/test.jpg')).toBe('/images/test.jpg');
  });

  it('normalizes bare uploads/ prefix', () => {
    expect(resolveImageUrl('uploads/test.jpg')).toBe('/api/uploads/test.jpg');
  });

  it('rewrites /uploads/ to /api/uploads/', () => {
    expect(resolveImageUrl('/uploads/projects/1/photo.jpg')).toBe('/api/uploads/projects/1/photo.jpg');
  });

  it('returns empty for legacy seeded avatar paths', () => {
    expect(resolveImageUrl('/images/showcase/avatar-1.png')).toBe('');
    expect(resolveImageUrl('/images/showcase/avatar-42.jpg')).toBe('');
  });

  it('rewrites known broken portfolio paths', () => {
    expect(resolveImageUrl('/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png'))
      .toBe('/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.jpg');
  });

  it('supports AI-tagged image object input', () => {
    expect(resolveImageUrl({ url: '/images/test.jpg' })).toBe('/images/test.jpg');
  });

  it('returns empty for object without url property', () => {
    expect(resolveImageUrl({ name: 'test' })).toBe('');
  });
});

describe('resolveVariantUrl', () => {
  it('returns empty for null/undefined', () => {
    expect(resolveVariantUrl(null, 'thumb')).toBe('');
    expect(resolveVariantUrl(undefined, 'thumb')).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(resolveVariantUrl('', 'thumb')).toBe('');
  });

  it('passes through data: URLs unchanged', () => {
    expect(resolveVariantUrl('data:image/png;base64,abc', 'thumb')).toBe('data:image/png;base64,abc');
  });

  it('passes through external URLs unchanged', () => {
    expect(resolveVariantUrl('https://cdn.example.com/img.jpg', 'thumb')).toBe('https://cdn.example.com/img.jpg');
  });

  it('appends variant suffix for local images', () => {
    expect(resolveVariantUrl('/images/test.jpg', 'thumb')).toBe('/images/test-thumb.webp');
    expect(resolveVariantUrl('/images/test.jpg', 'blur')).toBe('/images/test-blur.webp');
    expect(resolveVariantUrl('/images/test.jpg', 'medium')).toBe('/images/test-medium.webp');
  });

  it('handles paths without extension gracefully', () => {
    expect(resolveVariantUrl('/images/test', 'thumb')).toBe('/images/test');
  });
});
