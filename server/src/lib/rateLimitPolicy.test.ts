import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipApiRateLimit } from './rateLimitPolicy';

test('skips rate limiting for OPTIONS preflight requests', () => {
  assert.equal(shouldSkipApiRateLimit({
    nodeEnv: 'production',
    method: 'OPTIONS',
    path: '/api/projects',
    ip: '203.0.113.10',
  }), true);
});

test('skips rate limiting for health checks', () => {
  assert.equal(shouldSkipApiRateLimit({
    nodeEnv: 'production',
    method: 'GET',
    path: '/api/health',
    ip: '203.0.113.10',
  }), true);
});

test('skips local development traffic outside production', () => {
  assert.equal(shouldSkipApiRateLimit({
    nodeEnv: 'development',
    method: 'POST',
    path: '/api/projects',
    ip: '::ffff:127.0.0.1',
  }), true);
});

test('keeps production api traffic rate limited', () => {
  assert.equal(shouldSkipApiRateLimit({
    nodeEnv: 'production',
    method: 'POST',
    path: '/api/projects',
    ip: '203.0.113.10',
  }), false);
});
