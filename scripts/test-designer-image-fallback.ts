import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextRenderableImageIndex } from '../src/lib/imageCleanup.ts';

test('getNextRenderableImageIndex skips failed first image', () => {
  const images = ['broken-1', 'ok-2', 'ok-3'];
  const result = getNextRenderableImageIndex(images, 0, [0]);
  assert.equal(result, 1);
});

test('getNextRenderableImageIndex returns -1 when all images failed', () => {
  const images = ['broken-1', 'broken-2'];
  const result = getNextRenderableImageIndex(images, 0, [0, 1]);
  assert.equal(result, -1);
});
