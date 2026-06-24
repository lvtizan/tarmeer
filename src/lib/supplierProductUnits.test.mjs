import assert from 'node:assert';
import { test } from 'node:test';
import { PRODUCT_UNITS, isValidUnit, formatProductPrice } from './supplierProductUnits.ts';

test('PRODUCT_UNITS 覆盖建材外贸常用单位', () => {
  const values = PRODUCT_UNITS.map(u => u.value);
  for (const v of ['PCS', 'SET', 'SQM', 'LM', 'M', 'CBM', 'KG', 'TON', 'ROLL', 'CTN', 'BAG', 'SHEET', 'CONTAINER']) {
    assert.ok(values.includes(v), `缺单位 ${v}`);
  }
});

test('isValidUnit：预设值或非空自定义文本为真，空为假', () => {
  assert.equal(isValidUnit('SQM'), true);
  assert.equal(isValidUnit('每托盘'), true); // 自定义文本
  assert.equal(isValidUnit(''), false);
  assert.equal(isValidUnit('   '), false);
  assert.equal(isValidUnit(null), false);
});

test('formatProductPrice：千分位 + 币种 + 起价 + 单位', () => {
  assert.equal(formatProductPrice(1200, 'SQM', false, 'AED'), 'AED 1,200 / ㎡');
  assert.equal(formatProductPrice(1200, 'SQM', true, 'AED'), 'AED 1,200 起 / ㎡');
  assert.equal(formatProductPrice(50000, 'PCS', false, 'VND'), 'VND 50,000 / 件');
  assert.equal(formatProductPrice(80, '每托盘', false, 'AED'), 'AED 80 / 每托盘');
});

test('formatProductPrice：无价格返回空串（旧产品不显示价格块）', () => {
  assert.equal(formatProductPrice(null, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(undefined, null, false, 'AED'), '');
});
