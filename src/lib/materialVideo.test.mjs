import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMaterialVideoUrl } from './materialVideo.ts';
import { normalizeMaterialVideoUrl as normalizeServerVideoUrl } from '../../server/dist/lib/materialVideo.js';

const normalizers = [normalizeMaterialVideoUrl, normalizeServerVideoUrl];

test('accepts only first-party supplier product uploads', () => {
  for (const normalize of normalizers) {
    assert.equal(
      normalize('/uploads/suppliers/supplier-1127/photos/se-570-35.mp4'),
      '/uploads/suppliers/supplier-1127/photos/se-570-35.mp4',
    );
  }
});

test('rejects unsafe or malformed video URLs', () => {
  for (const normalize of normalizers) {
    for (const value of [
      null,
      '',
      'javascript:alert(1)',
      'http://cdn.example.com/video.mp4',
      'https://cdn.example.com/stone.mp4',
      'https://user:password@cdn.example.com/video.mp4',
      'https://cdn.example.com/video.webm',
      '/uploads/suppliers/../private/video.mp4',
      '/uploads/suppliers/%2e%2e/private/video.mp4',
      '/uploads/suppliers/supplier-1127/%2fprivate/video.mp4',
      '/uploads/suppliers/supplier-1127/video.webm',
      '/images/video.mp4',
    ]) {
      assert.equal(normalize(value), null);
    }
  }
});
