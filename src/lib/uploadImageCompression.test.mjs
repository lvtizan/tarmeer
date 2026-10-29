import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IMAGE_UPLOAD_SAFE_BYTES,
  buildCompressionAttempts,
  isImageUpload,
  shouldCompressImageBeforeUpload,
  outputMimeTypeForImage,
  replacementFileName,
} from './uploadImageCompression.ts';

test('安全上传线设定为 1.5MB，确保手机和相机大图在客户端自动压缩后疾速上传', () => {
  assert.equal(IMAGE_UPLOAD_SAFE_BYTES, 1.5 * 1024 * 1024);
});

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

test('压缩轮次逐步降低质量和最大边，初始尺寸与服务端 2400px 上限对齐', () => {
  const attempts = buildCompressionAttempts();
  assert.ok(attempts.length >= 3);
  assert.equal(attempts[0].maxDimension, 2400);
  assert.ok(attempts.every((attempt) => attempt.maxDimension >= 1600));
  assert.ok(attempts.every((attempt, index) => index === 0 || attempt.maxDimension <= attempts[index - 1].maxDimension));
  assert.ok(attempts.every((attempt, index) => index === 0 || attempt.quality <= attempts[index - 1].quality));
});

test('文件名扩展名按输出格式正确重命名', () => {
  assert.equal(replacementFileName('photo.png', 'image/webp'), 'photo-optimized.webp');
  assert.equal(replacementFileName('photo.jpeg', 'image/jpeg'), 'photo-optimized.jpg');
  assert.equal(replacementFileName('photo.PNG', 'image/jpeg'), 'photo-optimized.jpg');
});

test('product uploads use smaller dimensions without lowering project defaults',()=>{const attempts=buildCompressionAttempts('product');assert.equal(attempts[0].maxDimension,1600);assert.equal(attempts.at(-1).maxDimension,1200);assert.equal(buildCompressionAttempts()[0].maxDimension,2400);});
