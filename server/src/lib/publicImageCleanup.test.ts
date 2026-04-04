import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAvatarUrl,
  sanitizeImageUrls,
} from './publicImageCleanup';

test('sanitizeImageUrls removes empty values and duplicate urls after normalization', () => {
  const result = sanitizeImageUrls([
    'https://example.com/a.jpg?w=800&q=80',
    ' https://example.com/a.jpg?w=1200&q=90 ',
    '',
    '   ',
    'https://example.com/b.jpg',
    null as unknown as string,
    undefined as unknown as string,
  ]);

  assert.deepEqual(result, [
    'https://example.com/a.jpg?w=800&q=80',
    'https://example.com/b.jpg',
  ]);
});

test('sanitizeAvatarUrl strips known seed avatar urls', () => {
  const result = sanitizeAvatarUrl(
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop'
  );

  assert.equal(result, '');
});

test('sanitizeAvatarUrl keeps non-seed avatars', () => {
  const result = sanitizeAvatarUrl('https://example.com/avatar.jpg');
  assert.equal(result, 'https://example.com/avatar.jpg');
});

test('sanitizeAvatarUrl strips legacy showcase avatar urls', () => {
  const result1 = sanitizeAvatarUrl('https://www.tarmeer.com/images/showcase/avatar-15.png');
  const result2 = sanitizeAvatarUrl('/images/showcase/avatar-06.png');
  assert.equal(result1, '');
  assert.equal(result2, '');
});

test('sanitizeImageUrls returns empty list for non-array-like values', () => {
  const result = sanitizeImageUrls({ foo: 'bar' } as unknown as string[]);
  assert.deepEqual(result, []);
});

test('sanitizeImageUrls normalizes relative image paths from database', () => {
  const result = sanitizeImageUrls([
    'images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png',
    './uploads/projects/a.jpg',
    'public/images/uae-companies/portfolio/x/y.png',
    '//cdn.example.com/a.webp',
    'www.example.com/ok.jpg',
  ]);

  assert.deepEqual(result, [
    '/images/uae-companies/portfolio/hba-hirsch-bedner/general/1.png',
    '/uploads/projects/a.jpg',
    '/images/uae-companies/portfolio/x/y.png',
    'https://cdn.example.com/a.webp',
    'https://www.example.com/ok.jpg',
  ]);
});
