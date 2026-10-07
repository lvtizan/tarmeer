import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function client(status = 200, errorBody = { error: 'Draft not found.' }) {
  const values = new Map();
  const storage = {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: k => values.delete(k),
  };
  const calls = [];
  const source = ts.transpileModule(readFileSync(new URL('./adminApi.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {}, process: { env: {} }, window: {}, localStorage: storage, URLSearchParams, Headers, FormData, Blob,
    require: name => {
      assert.equal(name, '@/lib/storage');
      return { safeGetItem: storage.getItem, safeSetItem: storage.setItem, safeRemoveItem: storage.removeItem };
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: status < 400, status, json: async () => status >= 400 ? errorBody : url === '/api/field/interviews'
        ? { id: 41, draft_token: 'private-draft-token' } : { ok: true } };
    },
  };
  vm.runInNewContext(source, context);
  return { ...context.exports, calls, storage };
}

test('schema requests carry country and version without changing legacy defaults', async () => {
  const c = client();
  await c.fieldApi.getSurveySchema('vn', 'legacy');
  assert.equal(c.calls[0].url, '/api/field/survey-schema?country=vn&version=legacy');
  assert.equal(new Headers(c.calls[0].options.headers).get('x-country'), 'vn');
  await c.fieldApi.getSurveySchema();
  assert.equal(c.calls[1].url, '/api/field/survey-schema');
});

test('field request errors preserve HTTP status for safe stale-draft recovery', async () => {
  const c = client(404);
  await assert.rejects(c.fieldApi.getDraft(99, 'ae'), error => error.status === 404 && error.message === 'Draft not found.');
});

test('draft capability is reused for reads, writes, submit and attachments', async () => {
  const c = client();
  await c.fieldApi.createDraft({ country: 'ae', schema_version: 'tarmeer-verification-v7' });
  assert.equal(JSON.parse(c.calls[0].options.body).country, 'ae');
  await c.fieldApi.getDraft(41, 'ae');
  await c.fieldApi.saveDraft(41, { verification_data: {} }, 'ae');
  await c.fieldApi.submit(41, 'ae');
  await c.fieldApi.uploadAttachment(41, new File(['hello'], 'proof.pdf', { type: 'application/pdf' }), 'proof');
  for (const call of c.calls.slice(1)) {
    assert.equal(new Headers(call.options.headers).get('x-interview-token'), 'private-draft-token');
    assert.equal(new Headers(call.options.headers).get('x-country'), 'ae');
  }
  assert.equal(new Headers(c.calls.at(-1).options.headers).has('Content-Type'), false);
});

test('draft credentials never leak to another interview and can be cleared after completion', async () => {
  const c = client();
  await c.fieldApi.createDraft({ country: 'ae' });
  await c.fieldApi.getDraft(42, 'ae');
  assert.equal(new Headers(c.calls.at(-1).options.headers).get('x-interview-token'), null);
  c.fieldApi.clearDraftAccess(41);
  await c.fieldApi.getDraft(41, 'ae');
  assert.equal(new Headers(c.calls.at(-1).options.headers).get('x-interview-token'), null);
});

test('admin interview detail, update and delete carry selected country', async () => {
  const c = client();
  c.storage.setItem('admin_token', 'test-admin');
  await c.adminApi.getInterview(41, 'vn');
  await c.adminApi.updateInterview(41, { company_ref_id: 2, company_ref_source: 'profile' }, 'vn');
  await c.adminApi.deleteInterviews([41], 'vn');
  for (const call of c.calls) assert.match(call.url, /\?country=vn$/);
});

 test('photo and attachment upload preserve 401 for login recovery', async () => {
  const c = client(401);
  await assert.rejects(c.fieldApi.uploadPhoto(41, new Blob(['photo'])), error => error.status === 401);
  await assert.rejects(c.fieldApi.uploadAttachment(41, new File(['proof'], 'proof.pdf')), error => error.status === 401);
});

test('structured validation field key survives transport without inventing malformed keys', async () => {
  const c = client(400, {error:'Semantic validation failed.',field_key:'db_owned_dynamic_key'});
  await assert.rejects(c.fieldApi.saveDraft(41,{}), error=>error.fieldKey==='db_owned_dynamic_key' && error.status===400);
  const malformed=client(400,{error:'Invalid.',field_key:{secret:'ignored'}});
  await assert.rejects(malformed.fieldApi.submit(41), error=>error.fieldKey===undefined);
});
