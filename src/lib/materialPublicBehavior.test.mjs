import assert from 'node:assert/strict';
import { test } from 'node:test';

const priceModule = await import('./supplierProductUnits.ts');
const identityModule = await import('./supplierDetailIdentity.ts').catch(() => ({}));

test('三个表单入口共享保存校验与 payload 语义', () => {
  assert.equal(typeof priceModule.buildProductPriceSubmission, 'function');
  const build = priceModule.buildProductPriceSubmission;
  assert.deepEqual(build({ min: '120', max: '200', unit: 'SQM', currency: 'AED', from: true, dirty: true }), {
    ok: true,
    payload: { price: 120, price_max: 200, price_unit: 'SQM', price_currency: 'AED', price_from: false },
  });
  assert.deepEqual(build({ min: '80', max: '', unit: 'PCS', currency: 'USD', from: true, dirty: true }), {
    ok: true,
    payload: { price: 80, price_max: null, price_unit: 'PCS', price_currency: 'USD', price_from: true },
  });
  assert.deepEqual(build({ min: '80', max: '', unit: '', currency: '', from: false, dirty: true }), {
    ok: false, field: 'unit', reason: 'required',
  });
  assert.deepEqual(build({ min: '200', max: '100', unit: 'PCS', currency: '', from: false, dirty: true }), {
    ok: false, field: 'max', reason: 'below_min',
  });
  assert.deepEqual(build({ min: '', max: '', unit: '', currency: '', from: false, dirty: false }), {
    ok: true, payload: {},
  });
});

test('supplier identity guard 拒绝慢旧请求并识别 country/slug 切换', () => {
  assert.equal(typeof identityModule.createSupplierIdentityGuard, 'function');
  assert.equal(typeof identityModule.isSupplierContentStale, 'function');
  const guard = identityModule.createSupplierIdentityGuard('ae:supplier-a');
  const first = guard.begin('ae:supplier-a');
  const countrySwitch = guard.begin('vn:supplier-a');
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(countrySwitch), true);
  guard.cancel(countrySwitch);
  assert.equal(guard.isCurrent(countrySwitch), false);
  assert.equal(identityModule.isSupplierContentStale('ae:supplier-a', 'vn:supplier-a'), true);
  assert.equal(identityModule.isSupplierContentStale('vn:supplier-a', 'vn:supplier-b'), true);
  assert.equal(identityModule.isSupplierContentStale('vn:supplier-b', 'vn:supplier-b'), false);
});
