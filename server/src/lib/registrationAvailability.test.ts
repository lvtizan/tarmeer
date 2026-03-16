import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistrationAvailabilityResult } from './registrationAvailability';

test('buildRegistrationAvailabilityResult reports duplicate email first', () => {
  const result = buildRegistrationAvailabilityResult({
    emailExists: true,
    phoneExists: false,
  });

  assert.equal(result.emailAvailable, false);
  assert.equal(result.phoneAvailable, true);
  assert.equal(result.error, 'Email already registered');
});

test('buildRegistrationAvailabilityResult reports duplicate phone', () => {
  const result = buildRegistrationAvailabilityResult({
    emailExists: false,
    phoneExists: true,
  });

  assert.equal(result.emailAvailable, true);
  assert.equal(result.phoneAvailable, false);
  assert.equal(result.error, 'Phone already registered');
});

test('buildRegistrationAvailabilityResult accepts unique email and phone', () => {
  const result = buildRegistrationAvailabilityResult({
    emailExists: false,
    phoneExists: false,
  });

  assert.equal(result.emailAvailable, true);
  assert.equal(result.phoneAvailable, true);
  assert.equal(result.error, null);
});
