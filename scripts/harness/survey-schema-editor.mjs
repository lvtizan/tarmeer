#!/usr/bin/env node
// Isolated controller contract tests for the inline V7 survey schema editor.
// No production connection and no persistent database writes are used here.
import assert from 'node:assert/strict';
import Module from 'node:module';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'server/dist/app.js'));
const verification = require(path.join(root, 'server/dist/lib/verificationV7.js'));

const schema = () => ({
  version: verification.VERSION,
  country: 'ae',
  sections: [{ key: 'company', fields: [
    { key: 'phone', label: 'Phone', labelEn: 'Phone', type: 'text', required: true, inputPolicy: { maxLength: 40 } },
    { key: 'repeat', label: 'Repeat', labelEn: 'Repeat', type: 'repeat', fields: [
      { key: 'child', label: 'Child', labelEn: 'Child', type: 'text', inputPolicy: { maxLength: 80 } },
    ] },
  ] }],
});

const state = {
  published: schema(),
  draft: schema(),
  row: { id: 19, country: 'ae', status: 'draft', schema_version: verification.VERSION },
  commits: 0,
  rollbacks: 0,
};

function rowsFor(sql) {
  if (sql.includes('survey_schema')) return [[{ schema_json: JSON.stringify(state.published) }]];
  if (sql.includes('company_interviews')) return [[{ ...state.row, schema_snapshot: JSON.stringify(state.draft) }]];
  throw new Error(`Unexpected select: ${sql}`);
}
const connection = {
  async beginTransaction() {},
  async commit() { state.commits += 1; },
  async rollback() { state.rollbacks += 1; },
  release() {},
  async execute(sql, values = []) {
    if (sql.startsWith('SELECT')) return rowsFor(sql);
    if (sql.startsWith('UPDATE survey_schema')) { state.published = JSON.parse(values[0]); return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE company_interviews')) { state.draft = JSON.parse(values[0]); return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected write: ${sql}`);
  },
};
const database = {
  execute: (...args) => connection.execute(...args),
  getConnection: async () => connection,
};

// Load the controller against a transaction-aware in-memory database. This
// specifically checks rollback paths without touching the local development DB.
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../config/database' && parent?.filename?.endsWith('surveySchemaEditorController.js')) return { default: database };
  if (request === './adminController' && parent?.filename?.endsWith('surveySchemaEditorController.js')) return { logActivity: async () => {} };
  return originalLoad.call(this, request, parent, isMain);
};
const editor = require(path.join(root, 'server/dist/controllers/surveySchemaEditorController.js'));
Module._load = originalLoad;
const permissionSource=readFileSync(path.join(root,'server/dist/controllers/adminController.js'),'utf8');
const helperSource=permissionSource.slice(permissionSource.indexOf('const SUB_ADMIN_PERMISSION_KEYS'),permissionSource.indexOf('// Check if system is installed'));
const adminController={safeSubAdminPermissions:vm.runInNewContext(helperSource+'\nsafeSubAdminPermissions',{exports:{}})};

function response() {
  return { code: 200, body: undefined, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function admin(role, country = 'ae', permissions = {}) { return { id: 1, role, country, permissions }; }
function reset() { state.published = schema(); state.draft = schema(); state.row = { id: 19, country: 'ae', status: 'draft', schema_version: verification.VERSION }; state.commits = 0; state.rollbacks = 0; }
function revisions() { return { revision: editor.revision(state.published), draftRevision: editor.revision(state.draft) }; }
function baseBody(action, extras = {}) {
  return { country: 'ae', draftId: 19, action, sectionKey: 'company', fieldPath: ['phone'], ...revisions(), ...extras };
}
async function patch(request) { const res = response(); await editor.updateSurveySchemaEditor(request, res); return res; }
async function context(request) { const res = response(); await editor.getSurveySchemaEditor(request, res); return res; }

let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`  \u001b[32m✓\u001b[0m ${name}`); }

await test('anonymous GET exposes no edit capability or schema', async () => {
  const res = await context({ query: { country: 'ae', draftId: 19 } });
  assert.deepEqual(res.body, { canEdit: false });
});
await test('revisions ignore database JSON object-key normalisation but retain array order', async () => {
  assert.equal(editor.revision({ z: { b: 2, a: 1 }, a: [{ y: 2, x: 1 }] }), editor.revision({ a: [{ x: 1, y: 2 }], z: { a: 1, b: 2 } }));
  assert.notEqual(editor.revision({ items: ['first', 'second'] }), editor.revision({ items: ['second', 'first'] }));
});
await test('schema-edit permission is granted only by a real boolean and unknown permission keys are dropped', async () => {
  assert.equal(adminController.safeSubAdminPermissions({ can_edit_survey_schema: 'true', invented: true }).can_edit_survey_schema, false);
  assert.equal(adminController.safeSubAdminPermissions({ can_edit_survey_schema: 1 }).can_edit_survey_schema, false);
  assert.equal(adminController.safeSubAdminPermissions({ can_edit_survey_schema: true }).can_edit_survey_schema, true);
  assert.equal('invented' in adminController.safeSubAdminPermissions({ invented: true }), false);
});
await test('field_staff cannot edit even with a forged schema permission', async () => {
  const res = await context({ query: { country: 'ae', draftId: 19 }, admin: admin('field_staff', 'ae', { can_edit_survey_schema: true }) });
  assert.deepEqual(res.body, { canEdit: false });
  const denied = await patch({ body: baseBody('rename', { label: 'Blocked' }), admin: admin('field_staff', 'ae', { can_edit_survey_schema: true }) });
  assert.equal(denied.code, 403); assert.equal(state.commits, 0);
});
await test('sub-admin requires its AE country and exact permission; super-admin must explicitly choose AE', async () => {
  let res = await context({ query: { country: 'ae', draftId: 19 }, admin: admin('sub_admin', 'vn', { can_edit_survey_schema: true }) });
  assert.deepEqual(res.body, { canEdit: false });
  res = await context({ query: { country: 'ae', draftId: 19 }, admin: admin('sub_admin', 'ae', {}) });
  assert.deepEqual(res.body, { canEdit: false });
  res = await context({ query: { country: 'ae', draftId: 19 }, admin: admin('sub_admin', 'ae', { can_edit_survey_schema: true }) });
  assert.equal(res.body.canEdit, true); assert.ok(res.body.schema); assert.equal(res.body.schema.sections[0].fields[0].key, 'phone');
  res = await context({ query: { draftId: 19 }, admin: admin('super_admin', 'vn') });
  assert.deepEqual(res.body, { canEdit: false });
});
await test('rename updates published schema and this draft atomically, preserving keys and policies', async () => {
  reset();
  const res = await patch({ body: baseBody('rename', { label: 'Phone / WhatsApp' }), admin: admin('super_admin', 'vn') });
  assert.equal(res.code, 200); assert.equal(state.commits, 1);
  for (const source of [state.published, state.draft]) {
    const field = source.sections[0].fields[0];
    assert.equal(field.key, 'phone'); assert.equal(field.label, 'Phone / WhatsApp'); assert.equal(field.labelEn, 'Phone / WhatsApp'); assert.deepEqual(field.inputPolicy, { maxLength: 40 });
  }
  assert.equal(res.body.revision, editor.revision(state.published)); assert.equal(res.body.draftRevision, editor.revision(state.draft));
});
await test('add supports nested paths, uses one generated custom key, inherits visibility but not groupKey', async () => {
  reset();
  for (const source of [state.published, state.draft]) {
    const child = source.sections[0].fields[1].fields[0];
    child.group = 'trades'; child.visibleWhen = { key: 'enabled', equals: true }; child.groupKey = 'hidden-controller';
  }
  const res = await patch({ body: baseBody('add', { label: 'Extra detail', fieldPath: ['repeat', 'child'] }), admin: admin('sub_admin', 'ae', { can_edit_survey_schema: true }) });
  assert.equal(res.code, 200);
  const a = state.published.sections[0].fields[1].fields[1]; const b = state.draft.sections[0].fields[1].fields[1];
  assert.match(a.key, /^custom_[a-f0-9]{32}$/); assert.equal(a.key, b.key); assert.equal(a.custom, true); assert.equal(a.required, false); assert.deepEqual(a.inputPolicy, { maxLength: 2000 });
  assert.equal(a.group, 'trades'); assert.deepEqual(a.visibleWhen, { key: 'enabled', equals: true }); assert.equal('groupKey' in a, false);
});
await test('stale revisions conflict before writes and transaction rolls back', async () => {
  reset();
  const body = baseBody('rename', { label: 'Stale' }); body.revision = '0'.repeat(64);
  const res = await patch({ body, admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 409); assert.equal(state.commits, 0); assert.equal(state.rollbacks, 1); assert.equal(state.published.sections[0].fields[0].label, 'Phone');
});
await test('only generated custom fields can be soft-deleted and historical answers remain valid', async () => {
  reset();
  let res = await patch({ body: baseBody('delete'), admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 409); assert.equal(state.published.sections[0].fields[0].retired, undefined);
  reset();
  res = await patch({ body: baseBody('add', { label: 'Retire me' }), admin: admin('super_admin', 'ae') });
  const custom = state.draft.sections[0].fields[1];
  const deleteBody = { ...baseBody('delete', { fieldPath: [custom.key] }) };
  res = await patch({ body: deleteBody, admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 200); assert.equal(state.published.sections[0].fields[1].retired, true); assert.equal(state.draft.sections[0].fields[1].retired, true);
  assert.equal(verification.validateAnswersDetailed({ phone: 'x', [custom.key]: 'old historical answer' }, state.draft, false), null);
  assert.ok(verification.validateAnswersDetailed({ phone:'x',[custom.key]:{arbitrary:'object'} },state.draft,false)?.error);
  assert.ok(verification.validateAnswersDetailed({ phone:'x',[custom.key]:'x'.repeat(2001) },state.draft,false)?.error);
  assert.ok(verification.validateAnswersDetailed({ unknown: 'x' }, state.draft, false)?.error.includes('Unknown'));
});
await test('draft status/version/country and label controls fail closed without mutating row 1 or answers', async () => {
  reset(); state.row.status = 'submitted';
  let res = await patch({ body: baseBody('rename', { label: 'Nope' }), admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 404); assert.equal(state.commits, 0); assert.equal(state.published.sections[0].fields[0].label, 'Phone');
  reset(); state.row.country = 'vn';
  res = await patch({ body: baseBody('rename', { label: 'Nope' }), admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 404);
  reset(); state.row.schema_version = 'legacy';
  res = await patch({ body: baseBody('rename', { label: 'Nope' }), admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 404);
  reset();
  res = await patch({ body: baseBody('rename', { label: 'bad\u0000name' }), admin: admin('super_admin', 'ae') });
  assert.equal(res.code, 400); assert.equal(state.published.sections[0].fields[0].label, 'Phone');
});

console.log('─'.repeat(48));
console.log(`\u001b[32m survey-schema-editor: ${passed}/10 checks passed\u001b[0m`);
