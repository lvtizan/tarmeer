import assert from 'node:assert';
import { test } from 'node:test';
import * as productUnits from './supplierProductUnits.ts';
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

test('formatProductPrice：有效最高价显示范围，且范围优先于起价', () => {
  assert.equal(formatProductPrice(120, 'SQM', false, 'AED', 200), 'AED 120–200 / ㎡');
  assert.equal(formatProductPrice(1200.5, 'PCS', true, 'USD', 2500.75), 'USD 1,200.5–2,500.75 / 件');
  assert.equal(formatProductPrice(120, 'SQM', true, 'AED', 120), 'AED 120–120 / ㎡');
});

test('formatProductPrice：最高价为空时保留单价/起价行为', () => {
  assert.equal(formatProductPrice(120, 'SQM', false, 'AED', null), 'AED 120 / ㎡');
  assert.equal(formatProductPrice(120, 'SQM', true, 'AED', null), 'AED 120 起 / ㎡');
});

test('formatProductPrice：无效最高价不生成价格标签', () => {
  assert.equal(formatProductPrice(120, 'SQM', false, 'AED', 119.99), '');
  assert.equal(formatProductPrice(120, 'SQM', false, 'AED', 0), '');
  assert.equal(formatProductPrice(120, 'SQM', false, 'AED', Infinity), '');
});

test('formatProductPrice：无价格返回空串（旧产品不显示价格块）', () => {
  assert.equal(formatProductPrice(null, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(undefined, null, false, 'AED'), '');
  assert.equal(formatProductPrice(0, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(-1, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(Infinity, 'SQM', false, 'AED'), '');
});

test('formatProductPrice：异常低价视为占位价不展示', () => {
  assert.equal(formatProductPrice(0.01, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(0.01, 'Priced by actual covered area', true, 'AED'), '');
  assert.equal(formatProductPrice(1, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(10, 'SQM', false, 'AED'), 'AED 10 / ㎡');
});

test('formatProductPrice：en 语言用英文单位', () => {
  assert.equal(formatProductPrice(80, 'PCS', false, 'AED', null, 'en'), 'AED 80 / pcs');
  assert.equal(formatProductPrice(1200, 'SQM', true, 'AED', null, 'en'), 'AED 1,200 (from) / ㎡');
});

test('formatProductPrice：旧第五参 lang 调用保持兼容', () => {
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

test('normalizeProductPriceFields：规范 DECIMAL 字符串、单位、币种与起价标记', () => {
  assert.deepEqual(productUnits.normalizeProductPriceFields({
    price: ' 120.50 ', price_max: '200.00', price_unit: ' SQM ', price_currency: 'AED', price_from: '1',
  }), {
    price: 120.5, price_max: 200, price_unit: 'SQM', price_currency: 'AED', price_from: true,
  });
  assert.equal(productUnits.normalizeProductPriceFields({ price: '120', price_from: '0' }).price_from, false);
  assert.equal(productUnits.normalizeProductPriceFields({ price: 1.15 }).price, 1.15);
});

test('normalizeProductPriceFields：拒绝非规范价格及脏字段', () => {
  for (const price of ['', '   ', '1e3', '1.234', 1.234, 9999999999.990002, 0, -1, Infinity, true, [], {}]) {
    assert.equal(productUnits.normalizeProductPriceFields({ price }).price, null, `应拒绝 ${String(price)}`);
  }
  assert.deepEqual(productUnits.normalizeProductPriceFields({
    price: '120', price_max: '119.99', price_unit: ['SQM'], price_currency: 'aed', price_from: 'yes',
  }), {
    price: null, price_max: null, price_unit: null, price_currency: null, price_from: false,
  });
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
  assert.deepEqual(parsePriceInput('1e3'), { ok: false, reason: 'invalid' });
  assert.deepEqual(parsePriceInput('1.234'), { ok: false, reason: 'invalid' });
});

test('parseProductPriceRange：最低价必填，最高价留空规范为 null', () => {
  assert.deepEqual(productUnits.parseProductPriceRange('', ''), { ok: false, field: 'min', reason: 'required' });
  assert.deepEqual(productUnits.parseProductPriceRange('120.50', '  '), { ok: true, min: 120.5, max: null });
});

test('parseProductPriceRange：最高价必须是规范正数且最多两位小数', () => {
  for (const max of ['0', '-1', '1e3', '200.001', 'abc']) {
    assert.deepEqual(productUnits.parseProductPriceRange('120', max), { ok: false, field: 'max', reason: 'invalid' });
  }
});

test('parseProductPriceRange：最高价不得低于最低价', () => {
  assert.deepEqual(productUnits.parseProductPriceRange('120', '119.99'), { ok: false, field: 'max', reason: 'below_min' });
  assert.deepEqual(productUnits.parseProductPriceRange('120', '120'), { ok: true, min: 120, max: 120 });
  assert.deepEqual(productUnits.parseProductPriceRange('120', '200'), { ok: true, min: 120, max: 200 });
});

test('parseProductPriceRange：遵守 DECIMAL(12,2) 精确边界', () => {
  assert.deepEqual(productUnits.parseProductPriceRange('9999999999.99', ''), { ok: true, min: 9999999999.99, max: null });
  for (const value of ['10000000000', '9999999999.999', '12345678901.23', '9007199254740991']) {
    assert.deepEqual(productUnits.parseProductPriceRange(value, ''), { ok: false, field: 'min', reason: 'invalid' });
  }
  assert.deepEqual(productUnits.parseProductPriceRange('9999999999.98', '9999999999.99'), { ok: true, min: 9999999999.98, max: 9999999999.99 });
});

test('normalizeProductPriceFields：number 同样拒绝 DECIMAL(12,2) 溢出和不安全精度', () => {
  assert.equal(productUnits.normalizeProductPriceFields({ price: 9999999999.99 }).price, 9999999999.99);
  for (const price of [10000000000, Number.MAX_SAFE_INTEGER, 9999999999.999]) {
    assert.equal(productUnits.normalizeProductPriceFields({ price }).price, null);
  }
});
