import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationLabel, isPublicInternetIp } from './ipLocation';

test('buildLocationLabel maps UAE city names to Chinese labels', () => {
  assert.equal(
    buildLocationLabel({ countryCode: 'AE', city: 'Dubai' }),
    '迪拜'
  );
  assert.equal(
    buildLocationLabel({ countryCode: 'AE', city: 'Sharjah' }),
    '沙迦'
  );
});

test('buildLocationLabel falls back to city/region for non-UAE', () => {
  assert.equal(
    buildLocationLabel({ countryCode: 'US', city: 'New York', region: 'NY' }),
    'New York'
  );
  assert.equal(
    buildLocationLabel({ countryCode: 'US', city: '', region: 'California' }),
    'California'
  );
});

test('isPublicInternetIp filters private and localhost addresses', () => {
  assert.equal(isPublicInternetIp('127.0.0.1'), false);
  assert.equal(isPublicInternetIp('192.168.1.8'), false);
  assert.equal(isPublicInternetIp('172.16.0.5'), false);
  assert.equal(isPublicInternetIp('8.8.8.8'), true);
});
