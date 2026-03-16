import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPayloadTooLargeError,
  PAYLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_REQUEST_BODY_LIMIT,
} from './requestLimits';

test('upload request limit is large enough for base64 project image payloads', () => {
  assert.equal(UPLOAD_REQUEST_BODY_LIMIT, '20mb');
});

test('payload too large helper recognizes express body parser errors', () => {
  assert.equal(
    isPayloadTooLargeError({ type: 'entity.too.large' }),
    true,
  );
  assert.equal(
    isPayloadTooLargeError({ status: 413 }),
    true,
  );
  assert.equal(
    isPayloadTooLargeError({ statusCode: 413 }),
    true,
  );
  assert.equal(
    isPayloadTooLargeError({ message: 'other error' }),
    false,
  );
  assert.match(PAYLOAD_TOO_LARGE_MESSAGE, /reduce image size or image count/i);
});
