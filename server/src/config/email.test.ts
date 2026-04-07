import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmailTransportOptions } from './email';
import config from './index';

test('buildEmailTransportOptions uses direct SMTP transport without pooling', () => {
  const options = buildEmailTransportOptions();

  assert.equal(options.host, config.smtp.host);
  assert.equal(options.port, config.smtp.port);
  assert.equal(options.secure, config.smtp.port === 465 || config.smtp.secure);
  assert.equal(options.auth.user, config.smtp.user);
  assert.equal(options.auth.pass, config.smtp.pass);
  assert.equal(options.connectionTimeout, 10000);
  assert.equal(options.greetingTimeout, 10000);
  assert.equal(options.socketTimeout, 30000);
  assert.equal(options.tls.servername, config.smtp.host);
  assert.ok(!('pool' in options));
});
