import assert from 'node:assert/strict';
import { test } from 'node:test';

const library = await import('./supplierProductLibrary.ts');
const label = (value) => value === 'stone' ? 'Stone' : value;

const products = [
  {
    id: 1,
    title: '雅士白',
    description: '白色大理石',
    category: 'stone',
    specs: JSON.stringify([{ label: '系列', value: '大理石系列' }, { label: '产品编号', value: 'M-001' }]),
  },
  {
    id: 2,
    title: '宝格丽蓝',
    description: '蓝色奢石',
    category: 'stone',
    specs: [{ label: 'Series', value: '奢石系列' }],
  },
  { id: 3, title: 'Unsorted slab', category: 'stone', specs: null },
];

test('series aggregation prefers dynamic product specs and falls back to category label', () => {
  const indexed = library.indexSupplierProducts(products, label);
  assert.deepEqual(indexed.map((item) => item.series), ['大理石系列', '奢石系列', 'Stone']);
});

test('combined series and multilingual keyword filters keep the correct material', () => {
  const indexed = library.indexSupplierProducts(products, label);
  assert.deepEqual(
    library.filterIndexedSupplierProducts(indexed, '大理石系列', 'm-001').map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    library.filterIndexedSupplierProducts(indexed, null, '蓝色').map((item) => item.id),
    [2],
  );
});

test('malformed specs do not break the material library', () => {
  assert.deepEqual(library.parseSupplierProductSpecs('{bad json'), []);
  assert.deepEqual(
    library.parseSupplierProductSpecs([null, 3, 'Series: Marble', { label: 'Code', value: 'M-2' }]),
    [{ label: 'Series', value: 'Marble' }, { label: 'Code', value: 'M-2' }],
  );
});
