import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schema = JSON.parse(fs.readFileSync(path.join(root, 'scripts/migrations/contractor-two-stage-template.json'), 'utf8'));
const require = createRequire(import.meta.url);
const verification = require(path.join(root, 'server/dist/lib/verificationV7.js'));
const phases = phase => ({ ...schema, sections: schema.sections.filter(section => section.phase === phase) });
const fields = phase => phases(phase).sections.flatMap(section => section.fields);

assert.equal(schema.workflow, 'contractor-two-stage');
assert.equal(schema.country, 'ae');
assert.equal(schema.sections.every(section => ['qualification', 'profile'].includes(section.phase)), true);
assert.ok(schema.sections.some(section => section.phase === 'qualification'));
assert.ok(schema.sections.some(section => section.phase === 'profile'));

const qualification = fields('qualification');
const profile = fields('profile');
const qualificationKeys = new Set(qualification.map(field => field.key));
const profileByKey = new Map(profile.map(field => [field.key, field]));
const carriedFields = ['company_name', 'license_number_1', 'owner_phone', 'email', 'website', 'office_address'];
for (const key of carriedFields) {
  assert.ok(qualificationKeys.has(key), `qualification carries ${key}`);
  assert.ok(profileByKey.has(key), `profile reuses ${key}`);
  assert.equal(profileByKey.get(key).type, qualification.find(field => field.key === key).type, `${key} keeps same field type`);
}

for (const key of ['trade_license_evidence', 'project_1_agreement', 'project_1_photos', 'project_2_agreement', 'project_2_photos', 'project_3_agreement', 'project_3_photos']) {
  const field = qualification.find(item => item.key === key);
  assert.ok(field?.required, `${key} is a required admission attachment`);
  assert.equal(field.type, 'attachment');
}
for (const key of ['vat_documents','mohre_company_documents','mohre_worker_documents','workshop_rental_documents','bank_details_documents','iban_documents','emaar_documents','nakheel_documents','damac_documents','adnoc_documents']) {
  assert.ok(qualification.find(field=>field.key===key)?.required, `${key} is a required document checklist item`);
}
assert.equal(qualification.find(field=>field.key==='ejari_documents')?.required, undefined, 'Ejari remains conditional as described in the source document');
for (const key of ['specialist_civil', 'minimum_project_value', 'current_active_projects', 'after_service_agreement', 'security_cheque_acknowledgement']) {
  assert.ok(profileByKey.has(key), `profile includes ${key}`);
}

const qualificationError = verification.validateAnswersDetailed({}, phases('qualification'), true);
assert.equal(qualificationError?.field_key, 'company_name', 'qualification cannot submit without company name');
const profileError = verification.validateAnswersDetailed({}, phases('profile'), true);
assert.ok(profileError?.field_key, 'profile cannot submit without required profile details');

const interviewController=fs.readFileSync(path.join(root,'server/dist/controllers/fieldInterviewController.js'),'utf8');
const adminController=fs.readFileSync(path.join(root,'server/dist/controllers/fieldAdminController.js'),'utf8');
const fieldRoutes=fs.readFileSync(path.join(root,'server/dist/routes/field.js'),'utf8');
assert.match(fieldRoutes,/contractor-attachments/,'contractor forms use a dedicated private upload route');
assert.match(fieldRoutes,/attachments\/:filename/,'contractor evidence downloads have a token-checked route');
assert.match(interviewController,/Only profile-stage evidence can be changed after approval/,'profile saves cannot remove approved-stage evidence');
assert.match(adminController,/contractor_qualification_snapshot=\?/,'approval preserves the original reviewed answers and evidence');
assert.match(interviewController,/Company name and submitted trade licence numbers cannot be changed after admission approval/,'approved identity fields remain frozen while blank optional carry-over fields can be completed');
assert.match(adminController,/attachments FROM company_interviews/,'approval loads persisted application data and evidence under lock');

console.log('PASS contractor two-stage workflow contract: phases, carry-over, mandatory evidence, private upload/download, approval and post-approval boundaries');
