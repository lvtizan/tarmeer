import assert from 'node:assert';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/lib/')) {
      return nextResolve(new URL(`./${specifier.slice('@/lib/'.length)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { toMaterialProduct } = await import('./materialsApi.ts');

test('toMaterialProduct：公共 mapper 使用统一价格字段归一化', () => {
  const product = toMaterialProduct({
    id: 1,
    image_url: '/product.webp',
    price: ' 120.50 ',
    price_max: '200.00',
    price_unit: ' SQM ',
    price_currency: 'USD',
    price_from: '0',
  });
  assert.deepEqual({
    price: product.price,
    price_max: product.price_max,
    price_unit: product.price_unit,
    price_currency: product.price_currency,
    price_from: product.price_from,
  }, {
    price: 120.5,
    price_max: 200,
    price_unit: 'SQM',
    price_currency: 'USD',
    price_from: false,
  });
});

test('toMaterialProduct：非法范围使价格对失效且其它脏字段安全归一化', () => {
  const product = toMaterialProduct({
    id: 2,
    price: '120',
    price_max: '119',
    price_unit: true,
    price_currency: 'usd',
    price_from: '1',
  });
  assert.deepEqual({
    price: product.price,
    price_max: product.price_max,
    price_unit: product.price_unit,
    price_currency: product.price_currency,
    price_from: product.price_from,
  }, {
    price: null,
    price_max: null,
    price_unit: null,
    price_currency: null,
    price_from: true,
  });
});
