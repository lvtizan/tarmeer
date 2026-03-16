import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegisterEmailStatus } from './registerEmailPolicy';

test('buildRegisterEmailStatus marks verification email as required success', () => {
  const result = buildRegisterEmailStatus({
    verificationSent: true,
    notificationQueued: false,
  });

  assert.equal(result.emailSent, true);
  assert.equal(result.message, 'Registration successful! Please check your email to verify your account.');
});

test('buildRegisterEmailStatus reports verification send failures to client', () => {
  const result = buildRegisterEmailStatus({
    verificationSent: false,
    notificationQueued: false,
  });

  assert.equal(result.emailSent, false);
  assert.equal(result.message, 'Registration created, but verification email could not be delivered. Please retry sending verification email.');
});
