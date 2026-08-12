import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildProductPriceLabel, ProductPriceText } from './productPriceDisplay.ts';

const product = (fields = {}) => ({
  price: 120,
  price_max: null,
  price_unit: 'SQM',
  price_currency: null,
  price_from: false,
  ...fields,
});

test('站点币种回退与显式币种优先', () => {
  assert.equal(buildProductPriceLabel(product(), 'AED'), 'AED 120 / ㎡');
  assert.equal(buildProductPriceLabel(product(), 'VND'), 'VND 120 / ㎡');
  assert.equal(buildProductPriceLabel(product({ price_currency: 'USD' }), 'VND'), 'USD 120 / ㎡');
});

test('区间优先于 from，单价保留 from，无价返回空', () => {
  assert.equal(buildProductPriceLabel(product({ price_max: 200, price_from: true }), 'AED'), 'AED 120–200 / ㎡');
  assert.equal(buildProductPriceLabel(product({ price_from: true }), 'AED'), 'AED 120 (from) / ㎡');
  assert.equal(buildProductPriceLabel(product({ price: null }), 'AED'), '');
});

test('异常低价占位不生成公开价格文本', () => {
  assert.equal(buildProductPriceLabel(product({ price: 0.01, price_from: true }), 'AED'), '');
  assert.equal(buildProductPriceLabel(product({ price: 1 }), 'AED'), '');
  assert.equal(buildProductPriceLabel(product({ price: 10 }), 'AED'), 'AED 10 / ㎡');
  assert.equal(renderToStaticMarkup(ProductPriceText({
    product: product({ price: 0.01, price_unit: 'Priced by actual covered area', price_from: true }),
    fallbackCurrency: 'AED',
  })), '');
});

test('DOM 输出正确文本和品牌 class；空价格不渲染元素', () => {
  const html = renderToStaticMarkup(ProductPriceText({ product: product({ price_max: 200 }), fallbackCurrency: 'AED' }));
  assert.match(html, />AED 120–200 \/ ㎡<\/p>/);
  assert.match(html, /text-\[#b8864a\]/);
  assert.equal(renderToStaticMarkup(ProductPriceText({ product: product({ price: null }), fallbackCurrency: 'AED' })), '');
});
