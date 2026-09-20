import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSupplierProjectGallery } from './supplierProjectGallery.ts';

const supplierDetailSource = readFileSync(
  new URL('../components/materials/SupplierDetailClient.tsx', import.meta.url),
  'utf8',
);

for (const count of [0, 1, 2, 3, 4, 5, 6, 9]) {
  test(`project gallery stays balanced with ${count} images`, () => {
    const images = Array.from({ length: count }, (_, index) => `image-${index}.jpg`);
    const gallery = buildSupplierProjectGallery(images);

    assert.deepEqual(gallery.visible, images.slice(0, 2));
    assert.equal(gallery.remaining, Math.max(0, count - 2));
    assert.ok(gallery.visible.length <= 2);
  });
}

test('supplier project section keeps the wide balanced card layout', () => {
  assert.match(supplierDetailSource, /Project portfolio/);
  assert.match(supplierDetailSource, /max-w-\[1920px\]/);
  assert.match(supplierDetailSource, /buildSupplierProjectGallery\(imgs\)/);
  assert.match(supplierDetailSource, /gallery\.visible\.length > 1 \? 'grid-cols-2' : 'grid-cols-1'/);
  assert.match(supplierDetailSource, /grid gap-6 lg:grid-cols-2/);
  assert.match(supplierDetailSource, /className="aspect-video w-full object-cover/);
  assert.match(supplierDetailSource, /View project <ArrowRight/);
});
