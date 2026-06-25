import assert from 'node:assert';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseGoogleTranslate } = require('./translate.js');

test('parseGoogleTranslate: 拼接 data[0] 各段译文', () => {
  const body = JSON.stringify([[["Marble tiles ","大理石砖 ",null,null,3],["800x800","800x800",null,null,3]],null,"zh-CN"]);
  assert.equal(parseGoogleTranslate(body), 'Marble tiles 800x800');
});
test('parseGoogleTranslate: 畸形/空输入返回空串', () => {
  assert.equal(parseGoogleTranslate('not json'), '');
  assert.equal(parseGoogleTranslate('null'), '');
  assert.equal(parseGoogleTranslate(''), '');
  assert.equal(parseGoogleTranslate('[]'), '');
});
