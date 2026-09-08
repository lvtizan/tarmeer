import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IMAGE_UPLOAD_SAFE_BYTES,
  buildCompressionAttempts,
  isImageUpload,
  shouldCompressImageBeforeUpload,
  outputMimeTypeForImage,
} from './uploadImageCompression.ts';

test('小于安全上传线的图片保留原文件', () => {
  assert.equal(shouldCompressImageBeforeUpload({ name: 'small.jpg', type: 'image/jpeg', size: IMAGE_UPLOAD_SAFE_BYTES - 1 }), false);
});

test('超出安全上传线的图片会进入压缩流程', () => {
  assert.equal(shouldCompressImageBeforeUpload({ name: 'large.jpg', type: 'image/jpeg', size: IMAGE_UPLOAD_SAFE_BYTES + 1 }), true);
  assert.equal(shouldCompressImageBeforeUpload({ name: 'catalog.pdf', type: 'application/pdf', size: IMAGE_UPLOAD_SAFE_BYTES * 2 }), false);
});

test('缺失 MIME 的 Windows 图片仍会按扩展名进入压缩流程', () => {
  assert.equal(isImageUpload({ name: 'material.PNG', type: '' }), true);
  assert.equal(shouldCompressImageBeforeUpload({ name: 'material.PNG', type: '', size: IMAGE_UPLOAD_SAFE_BYTES + 1 }), true);
});

test('所有透明图片输出为 WebP，其余图片输出 JPEG', () => {
  assert.equal(outputMimeTypeForImage('image/png', true), 'image/webp');
  assert.equal(outputMimeTypeForImage('image/webp', true), 'image/webp');
  assert.equal(outputMimeTypeForImage('image/jpeg', false), 'image/jpeg');
});

test('压缩轮次逐步降低质量和最大边，最终能够达到安全目标', () => {
  const attempts = buildCompressionAttempts();
  assert.ok(attempts.length >= 3);
  assert.ok(attempts.every((attempt) => attempt.maxDimension >= 1600));
  assert.ok(attempts.every((attempt, index) => index === 0 || attempt.maxDimension <= attempts[index - 1].maxDimension));
  assert.ok(attempts.every((attempt, index) => index === 0 || attempt.quality <= attempts[index - 1].quality));
});
