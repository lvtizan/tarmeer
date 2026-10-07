import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const v = require('./verificationV7.js');
const schema = require('./verificationV7Schema.json');
const complete = {company:'ACME',contact:'Ali',phone:'+971501234567',address:'Dubai',inspector:'Visitor',visitDate:'2026-10-07',conclusion:'Ready for Project Matching',specialist_civil:['General Civil Works']};
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
