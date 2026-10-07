#!/usr/bin/env node
// Real browser-side TS validation versus server validation, across the authoritative catalogue.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const context={exports:{},URL,Date,Intl};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/verification.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const client=context.exports,server=require('../../server/dist/lib/verificationV7.js');
const catalogue=require('../../server/dist/lib/verificationV7Schema.json');
const now=new Date('2026-10-07T12:00:00Z');
let count=0,fields=0;
function probe(field,value,expected){
 const tested={...field,required:false,visibleWhen:undefined};
 const schema={version:catalogue.version,country:'ae',sections:[{key:'test',title:'Test',fields:[tested]}]};
 const data={[field.key]:value};
 const front=Object.keys(client.validateVerification(schema,data,now,false)).length===0;
 const back=server.validateAnswersDetailed(data,schema,false,now)===null;
 assert.equal(front,back,`PARITY ${field.key}/${JSON.stringify(value)} frontend=${front} backend=${back}`);
 if(expected!==undefined)assert.equal(back,expected,`EXPECTATION ${field.key}/${JSON.stringify(value)}`);
 count++;
}
for(const section of catalogue.sections)for(const field of section.fields){
 fields++;assert.ok(field.inputPolicy,`Policy missing ${field.key}`);
 if(field.type==='attachment'){probe(field,'',true);continue;}
 probe(field,'',true);probe(field,'   ',true);
 const policy=field.inputPolicy;
 if(field.type==='date'){
  probe(field,'2026-10-07',true);probe(field,'0003-02-03',false);probe(field,'2025-02-29',false);probe(field,'2024-02-29',true);
  probe(field,'2026-10-08',field.datePolicy.maxYearsFromToday>0);probe(field,'2100-01-01',false);
 }else if(field.yearPolicy){
  for(const value of ['1900','2026'])probe(field,value,true);
  for(const value of ['0002','0000','2027','2e3','02026'])probe(field,value,false);
 }else if(field.type==='number'){
  probe(field,'0',true);probe(field,'12',true);probe(field,String(policy.max),true);
  for(const value of ['-1','1e2','NaN',String(policy.max+1)])probe(field,value,false);
  if(policy.precision){probe(field,'12.'+'1'.repeat(policy.precision),true);probe(field,'12.'+'1'.repeat(policy.precision+1),false);}else probe(field,'1.5',false);
 }else if(field.type==='radio'){
  const option=field.options[0];probe(field,typeof option==='string'?option:option.value,true);probe(field,'FAKE_UNLISTED_OPTION',false);
 }else if(field.type==='checkbox'){
  const option=field.options[0],value=typeof option==='string'?option:option.value;
  probe(field,[value],true);probe(field,['FAKE_UNLISTED_OPTION'],false);probe(field,[value,value],false);
 }else if(field.type==='repeat'){
  assert.ok(field.fields.every(child=>child.inputPolicy),'Nested policy coverage');
  probe(field,[{emirate:'Dubai',district:'JVC'}],true);probe(field,[{emirate:'NOT_AN_EMIRATE',district:'JVC'}],false);
  probe(field,[{emirate:'Dubai',district:'123456'}],false);probe(field,[{emirate:'Dubai',district:'x'.repeat(10001)}],false);
 }else if(policy.kind==='phone'){
  for(const value of ['0501234567','+971501234567','00971501234567','+971 4 123 4567','٠٥٠١٢٣٤٥٦٧'])probe(field,value,true);
  for(const value of ['hello','123456','0511234567','0500000000','+9710501234567','+966501234567','050123456789'])probe(field,value,false);
 }else if(policy.kind==='map'){
  for(const value of ['https://maps.app.goo.gl/TestMap','https://goo.gl/maps/TestMap','https://maps.google.com/?q=Dubai','https://www.google.com/maps?q=Dubai'])probe(field,value,true);
  for(const value of ['https://example.com/maps','https://google.com:444/maps','https://google.com.evil.example/maps','https://google.com@evil.example/maps','javascript:alert(1)','123456'])probe(field,value,false);
 }else if(policy.kind==='website'){
  probe(field,'https://example.com/company',true);if(policy.allowHandle)probe(field,'@tarmeer',true);
  probe(field,'javascript:alert(1)',false);probe(field,'https://user:pass@example.com',false);probe(field,'https://x.localhost',false);
 }else if(policy.kind==='identifier'){
  for(const value of ['123456','CN-123/2026','رخصة-١٢٣','#123'])probe(field,value,true);
  for(const value of ['😀','???','<b>123</b>'])probe(field,value,false);
 }else if(policy.kind==='email'){
  probe(field,'qa@example.com',true);probe(field,'bad email',false);probe(field,'x'.repeat(policy.maxLength+1)+'@example.com',false);
 }else{
  probe(field,'Valid business description',true);
  probe(field,'شارع دبي',true);if(policy.minLength<=2)probe(field,'华为',true);
  if(policy.kind==='name')probe(field,'王',true);if(policy.kind==='address')probe(field,'中山路',true);
  probe(field,'123456',!policy.requireLetter);
  probe(field,'x'.repeat(policy.maxLength+1),false);probe(field,'bad\u0000text',false);
  if(field.type==='textarea')probe(field,'Valid\nmultiline',true);
  if(policy.kind==='text'&&!policy.requireLetter){probe(field,'😀'.repeat(policy.maxLength),true);probe(field,'😀'.repeat(policy.maxLength+1),false);}
 }
}
assert.equal(fields,327);
console.log(`${count}/${count} validation parity checks PASS across ${fields} fields (+ nested policies)`);
