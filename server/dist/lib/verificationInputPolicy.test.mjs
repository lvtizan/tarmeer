import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const p=require('./verificationInputPolicy');
const v=require('./verificationV7');
const schema=require('./verificationV7Schema.json');
const fields=schema.sections.flatMap(section=>section.fields);
test('all 327 canonical fields and two repeat children declare policies',()=>{
 assert.equal(fields.length,327);assert.ok(fields.every(field=>field.inputPolicy));
 assert.ok(fields.find(field=>field.type==='repeat').fields.every(field=>field.inputPolicy));
 assert.equal(fields.filter(f=>f.inputPolicy.kind==='amount').length,8);assert.equal(fields.filter(f=>f.inputPolicy.kind==='area').length,3);
 for(const field of fields.filter(f=>['amount','area'].includes(f.inputPolicy.kind))) assert.equal(field.step,field.inputPolicy.kind==='amount'?0.01:0.001);
});
test('UAE mobiles/landlines, formatted international and Arabic digits retain their original answers',()=>{
 const good=['0501234567','0521234567','0541234567','0551234567','0561234567','0581234567','021234567','031234567','041234567','061234567','071234567','091234567','+971 50 123 4567','00971-4-123-4567','(050) 123-4567','٠٥٠١٢٣٤٥٦٧','۰۵۰۱۲۳۴۵۶۷'];
 const bad=['12345','0511234567','0571234567','0591234567','+9710501234567','+84 501234567','0500000000','040000000','050123456','05012345678','0501234567ext123','0501234567\n'];
 for(const value of good) assert.ok(p.validUAEPhone(value),value);
 for(const value of bad) assert.equal(p.validUAEPhone(value),false,value);
 for(const field of fields.filter(field=>field.inputPolicy.kind==='phone')) {
  assert.equal(v.validateAnswers({[field.key]:good[12]},schema,false),null);
  assert.equal(v.validateAnswersDetailed({[field.key]:'12345'},schema,false).field_key,field.key);
 }
});
test('meaningful names/addresses support Arabic, Chinese and 3M; IDs and narrative percentages stay legitimate',()=>{
 for(const field of fields.filter(field=>['name','address'].includes(field.inputPolicy.kind))) {
  const policy=field.inputPolicy;const valid=policy.kind==='address'?'123 Main Street':'3M';
  assert.equal(p.inputPolicyError(valid,policy),null,field.key);assert.ok(p.inputPolicyError('123456',policy),field.key);
  assert.ok(p.inputPolicyError('!@#$%',policy),field.key);assert.ok(p.inputPolicyError('A'.repeat(policy.maxLength+1),policy),field.key);
 }
 const name=fields.find(f=>f.key==='company').inputPolicy;
 for(const value of ['شركة دبي','阿联酋公司','3M','AB','王','A']) assert.equal(p.inputPolicyError(value,name),null,value);
 assert.equal(v.validateAnswers({address:'中山路'},schema,false),null);
 for(const key of ['license','paymentTerms','qualifications','teamNotes','verifyNotes']) assert.equal(v.validateAnswers({[key]:key==='license'?'123456':'50% / 30% / 20%'},schema,false),null,key);
 assert.equal(v.validateAnswers({verifyNotes:'Line one\nLine two'},schema,false),null);
 assert.ok(v.validateAnswers({company:'Good\nName'},schema,false));
});
test('all numeric fields enforce precision and caps, preserving monetary/area decimals and zero',()=>{
 for(const field of fields.filter(f=>['count','amount','area'].includes(f.inputPolicy.kind))) {
  const policy=field.inputPolicy;
  for(const value of ['0',String(policy.max)]) assert.equal(v.validateAnswers({[field.key]:value},schema,false),null,field.key);
  for(const value of ['-1','1e3',String(policy.max+1)]) assert.ok(v.validateAnswers({[field.key]:value},schema,false),field.key);
  assert.ok(v.validateAnswers({[field.key]:'0.'+'1'.repeat(policy.precision+1)},schema,false),field.key);
  if(policy.precision) assert.equal(v.validateAnswers({[field.key]:'1.'+'2'.repeat(policy.precision)},schema,false),null,field.key);
 }
});
test('free-text astral characters use Unicode code-point length at and above policy boundaries',()=>{
 for(const field of fields.filter(f=>f.inputPolicy.kind==='text' && !f.inputPolicy.requireLetter)) {
  const limit=field.inputPolicy.maxLength;
  const boundary='😀'.repeat(limit);
  assert.equal(v.validateAnswers({[field.key]:boundary},schema,false),null,field.key);
  assert.equal(v.validateAnswersDetailed({[field.key]:boundary+'😀'},schema,false).field_key,field.key);
 }
 assert.equal(v.validateAnswers({verifyNotes:'😀'.repeat(5001)},schema,false),null);
});
test('identifiers accept multilingual and numeric licences with conventional separators, rejecting meaningless content',()=>{
 for(const field of fields.filter(f=>f.inputPolicy.kind==='identifier')) {
  for(const value of ['123456','CN-123/2026','رخصة-١٢٣','#123','AB_12.34 / 56']) assert.equal(v.validateAnswers({[field.key]:value},schema,false),null,value);
  for(const value of ['😀','???','./#_-','<b>123</b>','123😀']) assert.equal(v.validateAnswersDetailed({[field.key]:value},schema,false)?.field_key,field.key,value);
 }
});
test('Google Maps aliases are exact, general website/social URLs permit handles, malicious lookalikes are rejected',()=>{
 for(const value of ['https://maps.app.goo.gl/Abcd','https://goo.gl/maps/Abcd','https://google.com/maps?q=Dubai','https://www.google.com/maps/place/Dubai','https://maps.google.com/?q=Dubai','https://google.ae/maps']) {
  assert.ok(p.validGoogleMaps(value),value);
 }
 for(const value of ['https://google.com.evil.test/maps','https://google.com@evil.test/maps','https://evil.test/maps','https://google.com/search?q=maps','javascript:alert(1)','https://goo.gl/notmaps/id']) assert.equal(p.validGoogleMaps(value),false,value);
 const website=fields.find(f=>f.inputPolicy.kind==='website').inputPolicy;
 for(const value of ['https://example.com','http://example.com/team','https://instagram.com/contractor','@contractor.dubai']) assert.equal(p.inputPolicyError(value,website),null,value);
 for(const value of ['javascript:alert(1)','https://user:pass@example.com','http://localhost','not a website']) assert.ok(p.inputPolicyError(value,website),value);
});
test('enumerations and nested district policies reject tampering without adding optional requirements',()=>{
 for(const field of fields) for(const blank of ['', '  ']) assert.equal(v.validateAnswers({[field.key]:blank},schema,false),null,field.key);
 assert.ok(v.validateAnswers({office:'Unknown'},schema,false));assert.ok(v.validateAnswers({factory:['None','None']},schema,false));
 assert.ok(v.validateAnswers({areas:[{emirate:'Dubai',district:'12345'}]},schema,false));
 assert.equal(v.validateAnswers({areas:[{emirate:'Dubai',district:'JVC'}]},schema,false),null);
});
