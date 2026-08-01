import assert from 'node:assert';
import { test } from 'node:test';
import { PRODUCT_UNITS, PRODUCT_CURRENCIES, isValidUnit, isValidCurrency, formatProductPrice, parsePriceInput } from './supplierProductUnits.ts';

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
  assert.equal(formatProductPrice(0, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(-1, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(Infinity, 'SQM', false, 'AED'), '');
});

test('formatProductPrice：en 语言用英文单位', () => {
  assert.equal(formatProductPrice(80, 'PCS', false, 'AED', 'en'), 'AED 80 / pcs');
  assert.equal(formatProductPrice(1200, 'SQM', true, 'AED', 'en'), 'AED 1,200 (from) / ㎡');
});

test('PRODUCT_CURRENCIES / isValidCurrency：白名单内为真，其余为假', () => {
  for (const c of ['AED', 'CNY', 'USD', 'VND']) {
    assert.ok(PRODUCT_CURRENCIES.includes(c), `缺币种 ${c}`);
    assert.equal(isValidCurrency(c), true);
  }
  assert.equal(isValidCurrency('元'), false);
  assert.equal(isValidCurrency('aed'), false); // 大小写敏感，避免脏值入库
  assert.equal(isValidCurrency(''), false);
  assert.equal(isValidCurrency(null), false);
});

test('parsePriceInput：正常数字通过（含小数、前后空格）', () => {
  assert.deepEqual(parsePriceInput('120'), { ok: true, value: 120 });
  assert.deepEqual(parsePriceInput(' 120.5 '), { ok: true, value: 120.5 });
  assert.deepEqual(parsePriceInput('0.01'), { ok: true, value: 0.01 });
});

test('parsePriceInput：区间价被识别为 range（本次事故的输入）', () => {
  // 供应商实际填的 "120-200" —— 旧版 type="number" 会把它静默读成空串，按钮永久置灰
  assert.deepEqual(parsePriceInput('120-200'), { ok: false, reason: 'range' });
  assert.deepEqual(parsePriceInput('120 - 200'), { ok: false, reason: 'range' });
  assert.deepEqual(parsePriceInput('120~200'), { ok: false, reason: 'range' });
  assert.deepEqual(parsePriceInput('120～200'), { ok: false, reason: 'range' });
  assert.deepEqual(parsePriceInput('120–200'), { ok: false, reason: 'range' }); // en dash
  assert.deepEqual(parsePriceInput('120—200'), { ok: false, reason: 'range' }); // em dash
  assert.deepEqual(parsePriceInput('120到200'), { ok: false, reason: 'range' });
  assert.deepEqual(parsePriceInput('120 至 200'), { ok: false, reason: 'range' });
});

test('parsePriceInput：空值与非法值各自报因，绝不静默', () => {
  assert.deepEqual(parsePriceInput(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parsePriceInput('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(parsePriceInput('abc'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parsePriceInput('120元'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parsePriceInput('0'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parsePriceInput('-5'), { ok: false, reason: 'invalid' }); // 负数不是区间
});

test('parsePriceInput：科学计数/Infinity 不被当成有效价格', () => {
  assert.deepEqual(parsePriceInput('Infinity'), { ok: false, reason: 'invalid' });
  assert.equal(parsePriceInput('1e3').ok, true); // Number('1e3')=1000，合法数字
});
