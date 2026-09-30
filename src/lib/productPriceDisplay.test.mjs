import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildProductPriceLabel, ProductPriceText } from './productPriceDisplay.ts';
const product = (fields = {}) => ({ price: 120, price_max: null, price_unit: 'SQM', price_currency: 'AED', price_from: false, ...fields });
test('Unknown currency/unit is never inferred from country', () => {
  assert.equal(buildProductPriceLabel(product({price_currency:null}), 'AED'), 'Request a quote');
  assert.equal(buildProductPriceLabel(product({price_unit:null}), 'AED'), 'Request a quote');
  assert.equal(buildProductPriceLabel(product({price_currency:'USD'}), 'AED'), 'USD 120 / m²');
});
test('Range and starting price remain distinct, units are readable', () => {
  assert.equal(buildProductPriceLabel(product({price_max:200,price_from:true}), 'AED'), 'AED 120–200 / m²');
  assert.equal(buildProductPriceLabel(product({price_from:true}), 'AED'), 'AED 120 (from) / m²');
  assert.equal(buildProductPriceLabel(product({price_unit:'PCS'}), 'AED'), 'AED 120 / piece');
});
test('Missing and legacy placeholder prices show an actionable status', () => {
  for (const price of [null, 0, 0.01, 1]) assert.equal(buildProductPriceLabel(product({price}), 'AED'), 'Request a quote');
  assert.equal(buildProductPriceLabel(product({price:10}), 'AED'), 'AED 10 / m²');
});
test('Both priced and unpriced products render price status', () => {
  assert.match(renderToStaticMarkup(ProductPriceText({product:product({price_max:200}),fallbackCurrency:'AED'})), />AED 120–200 \/ m²<\/p>/);
  assert.match(renderToStaticMarkup(ProductPriceText({product:product({price:null}),fallbackCurrency:'AED'})), />Request a quote<\/p>/);
});

test('confirmed legacy yuan per square metre has one currency and readable unit', () => {
 assert.equal(buildProductPriceLabel(product({price:150,price_unit:'元/㎡',price_currency:'CNY'}),'AED'),'CNY 150 / m²');
 assert.equal(buildProductPriceLabel(product({price:150,price_unit:'元/㎡',price_currency:'USD'}),'AED'),'Request a quote');
 assert.equal(buildProductPriceLabel(product({price_unit:'M'}),'AED'),'AED 120 / m');
});
