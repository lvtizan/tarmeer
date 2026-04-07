import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..').replace('/dist', '/src');

function read(path: string) {
  return readFileSync(resolve(SRC, path), 'utf-8');
}

test('admin user queries do not require users.updated_at', () => {
  const controller = read('controllers/userAdminController.ts');

  assert.doesNotMatch(
    controller,
    /FROM users[\s\S]*updated_at|updated_at[\s\S]*FROM users/
  );
});
