import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArticleImageKey,
  resolveMirroredArticleImage,
  rewriteMirroredArticleContent,
} from './articleImageMirror';

test('normalizeArticleImageKey strips query params for external image urls', () => {
  assert.equal(
    normalizeArticleImageKey('https://images.unsplash.com/photo-123?w=800&q=80'),
    'https://images.unsplash.com/photo-123'
  );
});

test('resolveMirroredArticleImage returns mirrored local path when manifest entry exists', () => {
  assert.equal(
    resolveMirroredArticleImage(
      'modern-villa-interior-design-dubai',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80'
    ),
    '/images/blog/articles/modern-villa-interior-design-dubai/cover.jpg'
  );
});

test('rewriteMirroredArticleContent rewrites mirrored image src values inside html', () => {
  const html = '<figure><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&amp;q=80" alt="test" /></figure>';
  const result = rewriteMirroredArticleContent('modern-villa-interior-design-dubai', html);

  assert.match(
    result,
    /src="\/images\/blog\/articles\/modern-villa-interior-design-dubai\/image-1\.jpg"/
  );
});

test('rewriteMirroredArticleContent removes known missing figures from html', () => {
  const html = '<figure><img src="https://images.unsplash.com/photo-1565814329452-e1432bc13e7f?w=900&amp;q=80" alt="missing" /><figcaption>missing</figcaption></figure>';
  const result = rewriteMirroredArticleContent('lighting-design-transform-room', html);
  assert.equal(result, '');
});
