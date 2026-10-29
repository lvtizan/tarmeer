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
const checklistItems=qualification.filter(field=>field.type==='checkbox'&&field.appearance==='document-checklist');
assert.equal(checklistItems.length,16,'all 13 registration documents and 3 projects are separate PDF checklist items');
for(const item of checklistItems){
  assert.equal(item.appearance,'document-checklist',`${item.key} uses the PDF checklist control`);
  assert.equal(item.required,undefined,`${item.key} can remain unchecked`);
  assert.ok(qualification.some(field=>field.type==='attachment'&&field.visibleWhen?.field===item.key),`${item.key} reveals its matching upload`);
}
for(const project of [1,2,3]){
  const gate=`project_${project}_documents`;
  for(const suffix of ['agreement','photos']){
    const attachment=qualification.find(field=>field.key===`project_${project}_${suffix}`);
    assert.equal(attachment?.visibleWhen?.field,gate,`Project ${project} ${suffix} is gated by its checklist box`);
  }
}
const ejari=checklistItems.find(field=>field.key==='ejari_documents');
const ejariUpload=qualification.find(field=>field.visibleWhen?.field===ejari.key);
const ejariOnly={sections:[{phase:'qualification',fields:[ejariUpload]}]};
assert.equal(verification.contractorEvidenceError(ejariOnly,'qualification',{},[]),null,'unchecked optional document needs no file');
assert.equal(verification.contractorEvidenceError(ejariOnly,'qualification',{[ejari.key]:['I can provide this document']},[])?.field_key,ejariUpload.key,'checked document requires its matching upload');
assert.equal(verification.contractorEvidenceError(ejariOnly,'qualification',{},[{field_key:ejariUpload.key}])?.field_key,ejariUpload.key,'unchecked document evidence cannot be submitted');
assert.equal(verification.contractorEvidenceError(ejariOnly,'qualification',{[ejari.key]:['I can provide this document']},[{field_key:ejariUpload.key}]),null,'checked document with matching evidence passes');
for(const project of [1,2,3]){
  const gate=`project_${project}_documents`;
  const attachments=qualification.filter(field=>field.visibleWhen?.field===gate);
  assert.equal(attachments.length,2,`project ${project} has agreement and photo uploads`);
  const projectOnly={sections:[{phase:'qualification',fields:attachments}]};
  assert.equal(verification.contractorEvidenceError(projectOnly,'qualification',{},[{field_key:attachments[0].key}])?.field_key,attachments[0].key,`unchecked project ${project} evidence is rejected`);
  assert.equal(verification.contractorEvidenceError(projectOnly,'qualification',{[gate]:['I can provide this document']},[{field_key:attachments[0].key},{field_key:attachments[1].key}]),null,`checked project ${project} with both materials passes`);
  assert.equal(verification.contractorEvidenceError(projectOnly,'qualification',{[gate]:['I can provide this document']},[{field_key:attachments[1].key}])?.field_key,attachments[0].key,`attachments-only re-submit cannot remove project ${project} agreement`);
}
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
for (const key of ['trade_license_documents','ejari_documents','vat_documents','mohre_company_documents','mohre_worker_documents','workshop_rental_documents','bank_details_documents','iban_documents','emaar_documents','nakheel_documents','damac_documents','adnoc_documents','other_registration_documents','project_1_documents','project_2_documents','project_3_documents']) {
  assert.equal(qualification.find(field=>field.key===key)?.required, undefined, `${key} is optional until checked`);
}
for (const field of qualification.filter(item=>item.type==='attachment'&&item.visibleWhen)) {
  assert.equal(field.required,true,`${field.key} becomes required after its checkbox is selected`);
}
for (const key of ['specialist_civil', 'minimum_project_value', 'current_active_projects', 'after_service_agreement', 'security_cheque_acknowledgement']) {
  assert.ok(profileByKey.has(key), `profile includes ${key}`);
}

const qualificationError = verification.validateAnswersDetailed({}, phases('qualification'), true);
assert.equal(qualificationError?.field_key, 'company_name', 'qualification cannot submit without company name');
const profileError = verification.validateAnswersDetailed({}, phases('profile'), true);
assert.ok(profileError?.field_key, 'profile cannot submit without required profile details');

const interviewController=fs.readFileSync(path.join(root,'server/dist/controllers/fieldInterviewController.js'),'utf8');
const adminController=fs.readFileSync(path.join(root,'server/dist/controllers/fieldAdminController.js'),'utf8');
const fieldInput=fs.readFileSync(path.join(root,'src/components/field/verification-field.tsx'),'utf8');
const surveyComponent=fs.readFileSync(path.join(root,'src/components/field/verification-survey.tsx'),'utf8');
const fieldRoutes=fs.readFileSync(path.join(root,'server/dist/routes/field.js'),'utf8');
assert.match(fieldRoutes,/contractor-attachments/,'contractor forms use a dedicated private upload route');
assert.match(fieldRoutes,/attachments\/:filename/,'contractor evidence downloads have a token-checked route');
assert.match(interviewController,/Only profile-stage evidence can be changed after approval/,'profile saves cannot remove approved-stage evidence');
assert.match(interviewController,/req\.body\.verification_data !== undefined \|\| req\.body\.attachments !== undefined/,'attachments-only re-submit runs contractor evidence validation');
assert.match(interviewController,/effectiveData=req\.body\.verification_data\|\|verification\.parseJSON\(current\.verification_data\)/,'attachments-only re-submit validates against saved answers');
assert.match(adminController,/contractor_qualification_snapshot=\?/,'approval preserves the original reviewed answers and evidence');
assert.match(interviewController,/Company name and submitted trade licence numbers cannot be changed after admission approval/,'approved identity fields remain frozen while blank optional carry-over fields can be completed');
assert.match(adminController,/attachments FROM company_interviews/,'approval loads persisted application data and evidence under lock');
assert.match(fieldInput,/type="checkbox" checked=\{checked\}/,'PDF checklist rows render as actual square checkboxes');
assert.match(surveyComponent,/removedEvidenceUrls\.current\.add\(item\.url\)/,'unchecking a document removes its uploaded file from the submitted evidence list');

console.log('PASS contractor two-stage workflow contract: phases, carry-over, mandatory evidence, private upload/download, approval and post-approval boundaries');
