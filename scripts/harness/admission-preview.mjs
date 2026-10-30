import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '../..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const localRequire = specifier => {
    if (specifier === '@/lib/admission-preview') return load('src/lib/admission-preview.ts');
    if (specifier === '@/lib/verification') return load('src/lib/verification.ts');
    if (specifier === '@/content/contractor-admission-letter.json') return require(path.join(root, 'src/content/contractor-admission-letter.json'));
    if (specifier === './verification-field') return { VerificationFields: () => { throw Error('Company fields must not render before the checklist'); } };
    return require(specifier);
  };
  new Function('exports', 'require', source)(exports, localRequire);
  return exports;
}
const { admissionPreviewSections, admissionOption, admissionFileError, selectedAdmissionUploads } = load('src/lib/admission-preview.ts');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'scripts/migrations/contractor-two-stage-template.json'), 'utf8'));
const split = admissionPreviewSections(schema);
const items = split.checklists.flatMap(section => section.items);
let passed = 0;
function check(label, run) { run(); passed++; console.log(`PASS ${label}`); }
const pdf = { name: 'qualification.pdf', size: 100, type: 'application/pdf' };
check('qualification checklist precedes company fields without mutating the original schema', () => {
  const before = JSON.stringify(schema);
  assert.equal(items.length, 16);
  assert.ok(split.details.length > 0);
  assert.equal(JSON.stringify(schema), before);
  assert.equal(split.checklists.some(section => section.phase === 'profile'), false);
});
check('every checklist item has matching conditional uploads, including both project documents', () => {
  for (const item of items) {
    assert.ok(item.uploads.length > 0);
    for (const upload of item.uploads) assert.equal(upload.visibleWhen.field, item.field.key);
  }
  assert.equal(items.filter(item => item.uploads.length === 2).length, 3);
});
check('unchecked items require no local file controls', () => assert.deepEqual(selectedAdmissionUploads(schema, {}), []));
check('selected items reveal only their matching file controls', () => {
  const item = items[0];
  assert.deepEqual(selectedAdmissionUploads(schema, { [item.field.key]: [admissionOption(item.field)] }), item.uploads);
});
check('selected project reveals both agreement and photos', () => {
  const item = items.find(item => item.uploads.length === 2);
  assert.equal(selectedAdmissionUploads(schema, { [item.field.key]: [admissionOption(item.field)] }).length, 2);
});
check('PDF and image files obey schema MIME types', () => {
  const field = items[0].uploads[0];
  assert.equal(admissionFileError(field, [], [pdf]), null);
  assert.equal(admissionFileError(field, [], [{ ...pdf, name: 'photo.png', type: 'image/png' }]), null);
  assert.match(admissionFileError(field, [], [{ ...pdf, name: 'program.exe', type: 'application/octet-stream' }]), /accepted file type/);
});
check('oversize and empty files are rejected', () => {
  assert.match(admissionFileError(items[0].uploads[0], [], [{ ...pdf, size: 20 * 1024 * 1024 }]), /exceeds/);
  assert.match(admissionFileError(items[0].uploads[0], [], [{ ...pdf, size: 0 }]), /empty/);
});
check('adding another batch cannot exceed the per-item file count', () => assert.match(admissionFileError(items.flatMap(item => item.uploads).find(field => field.maxItems === 1), [pdf], [pdf]), /up to 1 file/));
check('schema extension and wildcard accept policies work', () => {
  assert.equal(admissionFileError({ key: 'fixture', label: 'Fixture', type: 'attachment', accept: '.pdf' }, [], [{ ...pdf, type: '' }]), null);
  assert.equal(admissionFileError({ key: 'fixture', label: 'Fixture', type: 'attachment', accept: 'image/*' }, [], [{ ...pdf, type: 'image/jpeg' }]), null);
});
check('retired checklist items and profile fields are excluded', () => {
  const copy = structuredClone(schema);
  const target = copy.sections.flatMap(section => section.fields).find(field => field.key === items[0].field.key);
  target.retired = true;
  const result = admissionPreviewSections(copy);
  assert.equal(result.checklists.flatMap(section => section.items).length, 15);
});
check('all non-retired qualification fields remain accounted for exactly once', () => {
  const keys = [...items.flatMap(item => [item.field.key, ...item.uploads.map(upload => upload.key)]), ...split.details.flatMap(section => section.fields.map(field => field.key))];
  const expected = schema.sections.filter(section => section.phase === 'qualification').flatMap(section => section.fields).filter(field => !field.retired).map(field => field.key);
  assert.deepEqual(keys.sort(), expected.sort());
});
check('document introduction and submission requirements match the original PDF wording', () => {
  const letter = require(path.join(root, 'src/content/contractor-admission-letter.json'));
  assert.equal(letter.title, 'CONTRACTOR REGISTRATION — REQUIRED DOCUMENTS');
  assert.equal(letter.subject, 'Subject: Submission of Mandatory Documents for Contractor Registration');
  assert.equal(letter.salutation, 'Dear Contractor,');
  assert.equal(letter.checklistHeading, 'DOCUMENT CHECKLIST');
  assert.equal(letter.introduction, 'To complete your company registration with TARMEER, please submit the following documents. All documents must be clear, complete, valid where applicable, and provided in scanned PDF format.');
  assert.equal(letter.submissionHeading, 'SUBMISSION REQUIREMENTS');
  assert.equal(letter.submissionRequirements, 'Please ensure every document is legible, complete, valid where applicable, and scanned into PDF format before submission.');
});
check('real React initial render shows all 16 checkboxes and no uploads or company inputs', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Preview = load('src/components/field/admission-preview.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Preview, { schema }));
  assert.equal((html.match(/type="checkbox"/g) || []).length, 16);
  assert.equal(html.includes('type="file"'), false);
  assert.equal(html.includes('type="text"'), false);
  assert.match(html, /Files stay in this browser tab/);
  assert.match(html, /Continue to company details/);
  const letter = require(path.join(root, 'src/content/contractor-admission-letter.json'));
  for (const key of ['title', 'subject', 'salutation', 'introduction', 'checklistHeading', 'submissionHeading', 'submissionRequirements']) assert.ok(html.includes(letter[key]), `source document ${key} is preserved verbatim`);
  assert.equal(html.includes('Your qualifications.'), false);
});
console.log(`Admission preview: ${passed}/${passed} PASS`);
