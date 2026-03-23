import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { extractClientIp, formatVisitorLocation, sanitizePagePath } from './visitorTracking';

function createRequest(headers: Record<string, string>, remoteAddress = ''): Request {
  return {
    headers,
    socket: {
      remoteAddress,
    },
  } as Request;
}

test('extractClientIp prefers cf-connecting-ip', () => {
  const req = createRequest({
    'cf-connecting-ip': '198.51.100.10',
    'x-real-ip': '198.51.100.11',
    'x-forwarded-for': '198.51.100.12',
  }, '198.51.100.13');

  assert.equal(extractClientIp(req), '198.51.100.10');
});

test('extractClientIp falls back to first x-forwarded-for ip and normalizes ipv6-prefixed ipv4', () => {
  const req = createRequest({
    'x-forwarded-for': '::ffff:203.0.113.20, 203.0.113.21',
  }, '::ffff:127.0.0.1');

  assert.equal(extractClientIp(req), '203.0.113.20');
});

test('formatVisitorLocation builds location string from headers', () => {
  const req = createRequest({
    'cf-ipcountry': 'AE',
    'x-vercel-ip-country-region': 'DU',
    'x-vercel-ip-city': 'Dubai',
  });

  assert.equal(formatVisitorLocation(req), 'AE / DU / Dubai');
});

test('sanitizePagePath returns slash for invalid values and truncates long path', () => {
  assert.equal(sanitizePagePath(''), '/');
  assert.equal(sanitizePagePath(null), '/');
  assert.equal(sanitizePagePath(' /designers '), '/designers');
  assert.equal(sanitizePagePath(`/${'a'.repeat(400)}`).length, 255);
});
