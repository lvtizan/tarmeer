import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const v = require('./verificationV7.js');
const schema = require('./verificationV7Schema.json');
const complete = {company:'ACME',contact:'Ali',phone:'+971501234567',address:'Dubai',inspector:'Visitor',visitDate:'2026-10-07',conclusion:'Ready for Project Matching',specialist_civil:['General Civil Works']};
test('evidence removal deltas preserve concurrent uploads and are idempotent',()=>{
 const existing=[{url:'/uploads/a',name:'A'},{url:'/uploads/b',name:'B'}];
 assert.deepEqual(v.removeEvidence(['/uploads/a'],JSON.stringify(existing)).attachments,[existing[1]]);
 assert.deepEqual(v.removeEvidence(['/uploads/a'],[existing[1]]).attachments,[existing[1]]);
 assert.deepEqual(v.removeEvidence([],existing).attachments,existing);
 for(const invalid of [null,'/uploads/a',[1],['a','a'],['x'.repeat(2001)],Array.from({length:101},(_,i)=>String(i))]) assert.ok(v.removeEvidence(invalid,existing).error);
});
test('catalogue: complete six steps, all named V7 input fields survive',()=>{
 assert.equal(schema.sections.length,6); assert.equal(schema.sections.flatMap(s=>s.fields).length,327);
 const fields=schema.sections.flatMap(s=>s.fields); assert.equal(new Set(fields.map(f=>f.key)).size,fields.length);
 for (const key of ['ownerName','commercialPhone','technicalPhone','workers_civil_extra_10','trade_subcontract_17','case3_value','areas','conclusion']) assert.ok(fields.some(f=>f.key===key),key);
});
test('complete validation accepts required information and zero worker counts',()=>{assert.equal(v.validateAnswers({...complete,workers_civil_0:'0'},schema,true),null)});
test('draft allows incomplete values but rejects invalid numbers/options/unknown keys',()=>{
 assert.equal(v.validateAnswers({},schema,false),null);
 for(const bad of [{employees:'-1'},{employees:'1.5'},{office:'bogus'},{unknown:'lost data'}]) assert.ok(v.validateAnswers(bad,schema,false));
});
test('complete validation enforces requirements, work choice and arithmetic',()=>{
 for(const bad of [{...complete,phone:''},{...complete,specialist_civil:[]},{...complete,typicalMin:'20',typicalMax:'10'},{...complete,employees:'2',designers:'3'},{...complete,trade_direct_0:'1',trade_available_0:'2'}]) assert.ok(v.validateAnswers(bad,schema,true));
});
test('nested areas bound and validate AE-only options',()=>{
 assert.equal(v.validateAnswers({...complete,areas:[{emirate:'Dubai',district:'JVC'}]},schema,true),null);
 assert.ok(v.validateAnswers({areas:[{emirate:'Hanoi'}]},schema,false));
 assert.ok(v.validateAnswers({areas:Array(31).fill({emirate:'Dubai'})},schema,false));
});
test('capability tokens are hashed and compared, never exposed by DTO',()=>{
 const token=v.createToken(); const hash=v.hashToken(token); assert.notEqual(token,hash); assert.ok(v.matchesToken(token,hash)); assert.equal(v.matchesToken('bad',hash),false);
 const dto=v.sanitizeInterview({id:1,draft_token_hash:hash,verification_data:complete}); assert.equal(dto.draft_token_hash,undefined); assert.deepEqual(dto.verification_data,complete);
});
test('country cannot be overridden for ordinary administrators',()=>{
 assert.equal(v.requestCountry({admin:{role:'sub_admin',country:'vn'},query:{country:'ae'},country:'ae'}),'vn');
 assert.equal(v.requestCountry({admin:{role:'super_admin',country:'vn'},query:{country:'ae'}}),'ae');
});
const fixedNow = new Date('2026-10-07T12:00:00Z');
test('Dubai date policies reject ancient and future claimed visits while permitting expired licenses',()=>{
 for(const value of ['0003-02-03','1899-12-31','2026-10-08','2026-02-30','2025-02-29','2026-13-01','2026-1-01']) assert.ok(v.validateAnswers({visitDate:value},schema,false,fixedNow),value);
 for(const value of ['1900-01-01','2024-02-29','2026-10-07']) assert.equal(v.validateAnswers({visitDate:value},schema,false,fixedNow),null,value);
 assert.ok(v.validateAnswers({expiry:'0002-03-03'},schema,false,fixedNow));
 assert.equal(v.validateAnswers({expiry:'2020-01-01'},schema,false,fixedNow),null);
 assert.equal(v.validateAnswers({expiry:'2056-10-07'},schema,false,fixedNow),null);
 assert.ok(v.validateAnswers({expiry:'2056-10-08'},schema,false,fixedNow));
});
test('established year, completed projects and earliest start have distinct metadata bounds',()=>{
 for(const year of ['0','0003','1899','2027','2026.5']) assert.ok(v.validateAnswers({year},schema,false,fixedNow),year);
 for(const year of ['1900','2026']) assert.equal(v.validateAnswers({year},schema,false,fixedNow),null,year);
 for(const key of ['case1_date','case2_date','case3_date']) {
  assert.ok(v.validateAnswers({[key]:'2026-10-08'},schema,false,fixedNow));
  assert.equal(v.validateAnswers({[key]:'2026-10-07'},schema,false,fixedNow),null);
 }
 assert.equal(v.validateAnswers({start:'2031-10-07'},schema,false,fixedNow),null);
 assert.ok(v.validateAnswers({start:'2031-10-08'},schema,false,fixedNow));
 assert.equal(v.validateAnswers({start:'2020-01-01'},schema,false,fixedNow),null);
});
test('Dubai midnight and leap anniversary bounds are deterministic',()=>{
 assert.equal(v.dateBounds({minYear:1900,maxYearsFromToday:0,timeZone:'Asia/Dubai'},new Date('2026-10-07T21:00:00Z')).max,'2026-10-08');
 assert.equal(v.dateBounds({minYear:1900,maxYearsFromToday:5,timeZone:'Asia/Dubai'},new Date('2024-02-29T10:00:00Z')).max,'2029-02-28');
});
test('old V7 snapshots receive date metadata without rewriting labels, options, custom fields or answers',()=>{
 const old=structuredClone(schema);
 for(const section of old.sections) for(const field of section.fields) {delete field.datePolicy;delete field.yearPolicy;}
 old.sections[0].fields.find(f=>f.key==='year').label='Operator custom year label';
 old.sections[0].fields.push({key:'custom_question',label:'Custom',type:'text',options:['kept']});
 const before=JSON.stringify(old);
 const enriched=v.withDatePolicies(old);
 assert.equal(JSON.stringify(old),before);
 assert.equal(enriched.sections[0].fields.find(f=>f.key==='year').label,'Operator custom year label');
 assert.deepEqual(enriched.sections[0].fields.at(-1),old.sections[0].fields.at(-1));
 assert.ok(v.validateAnswers({visitDate:'0003-02-03'},old,false,fixedNow));
 const data={visitDate:'0003-02-03',custom_question:'Retain original'};
 const dto=v.sanitizeInterview({schema_version:v.VERSION,schema_snapshot:old,verification_data:data});
 assert.deepEqual(dto.verification_data,data);assert.ok(dto.schema_snapshot.sections[4].fields.find(f=>f.key==='visitDate').datePolicy);
 assert.deepEqual(v.withDatePolicies([{key:'legacy',fields:[]}]),[{key:'legacy',fields:[]}]);
});
test('required, date and semantic errors carry an actual schema field key for navigation',()=>{
 const cases=[
  [{...complete,phone:''},'phone'],
  [{...complete,visitDate:'0003-02-03'},'visitDate'],
  [{...complete,specialist_civil:[]},'specialist_civil'],
  [{...complete,specializations:['Other Specialist Works'],otherSpecialization:''},'otherSpecialization'],
  [{...complete,typicalMin:'20',typicalMax:'10'},'typicalMin'],
  [{...complete,employees:'1',designers:'2'},'employees'],
  [{...complete,trade_direct_0:'1',trade_available_0:'2'},'trade_available_0'],
  [{...complete,employees:'1',trade_direct_0:'2'},'employees'],
 ];
 const fields=new Set(schema.sections.flatMap(s=>s.fields).map(f=>f.key));
 for(const [data,key] of cases) {
  const issue=v.validateAnswersDetailed(data,schema,true,fixedNow);
  assert.equal(issue.field_key,key);assert.ok(fields.has(issue.field_key));assert.equal(v.validateAnswers(data,schema,true,fixedNow),issue.error);
 }
 assert.equal(v.validateAnswersDetailed({unknown:'x'},schema,false,fixedNow).field_key,undefined);
});
