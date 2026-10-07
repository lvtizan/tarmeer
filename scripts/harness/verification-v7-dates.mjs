#!/usr/bin/env node
// AE-only real HTTP + local MySQL date-policy regression; never contacts production.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'server/dist/app.js'));
require('dotenv').config({path:path.join(root,'server/.env')});
if(process.env.DB_HOST!=='localhost') throw new Error('Date harness requires DB_HOST=localhost.');
process.env.DB_NAME='tarmeer_v7_dates_harness';process.env.DEV_SKIP_EMAIL='true';process.env.CRM_INBOUND_URL='';
const mysql=require('mysql2/promise');
const conn=await mysql.createConnection({host:'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
await conn.query('CREATE DATABASE IF NOT EXISTS tarmeer_v7_dates_harness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
await conn.query('USE tarmeer_v7_dates_harness');
const v=require(path.join(root,'server/dist/lib/verificationV7'));
const schema=require(path.join(root,'server/dist/lib/verificationV7Schema.json'));
const source=readFileSync(path.join(root,'server/dist/lib/autoMigrate.js'),'utf8');
await conn.query(source.match(/sql: `(CREATE TABLE IF NOT EXISTS company_interviews [\s\S]*?)`,/)[1]);
await v.ensureVerificationSchema(conn);
const [columns]=await conn.query('SHOW COLUMNS FROM company_interviews');const existing=new Set(columns.map(c=>c.Field));
for(const [key,type] of Object.entries({country:"VARCHAR(5) NOT NULL DEFAULT 'ae'",company_ref_source:'VARCHAR(20) NULL',photos:'JSON NULL',attachments:'JSON NULL',location_pin:'JSON NULL',qa_answers:'JSON NULL',filled_by:'VARCHAR(120) NULL'})) if(!existing.has(key)) await conn.query(`ALTER TABLE company_interviews ADD COLUMN ${key} ${type}`);
await conn.query('ALTER TABLE company_interviews MODIFY interviewer_id INT NULL');
await conn.query('CREATE TABLE IF NOT EXISTS survey_schema (id INT PRIMARY KEY, schema_json MEDIUMTEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)');
await conn.query("CREATE TABLE IF NOT EXISTS admin_users (id INT PRIMARY KEY,full_name VARCHAR(100),country VARCHAR(5) DEFAULT 'ae')");
await conn.query('CREATE TABLE IF NOT EXISTS company_profiles (id INT PRIMARY KEY,company_name VARCHAR(200),country VARCHAR(5),deleted_at DATETIME NULL)');
await conn.query('CREATE TABLE IF NOT EXISTS uae_companies (id INT PRIMARY KEY,name_en VARCHAR(200),country VARCHAR(5))');
await conn.query("INSERT INTO admin_users(id,full_name,country) VALUES(1,'Date harness reviewer','ae') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name)");
const legacy=[{key:'section_1',title:'Preserved legacy',fields:[{key:'old_key',label:'Old',type:'text'}]}];
await conn.execute('INSERT INTO survey_schema(id,schema_json) VALUES(1,?) ON DUPLICATE KEY UPDATE schema_json=VALUES(schema_json)',[JSON.stringify(legacy)]);
const strip=s=>{const copy=structuredClone(s);for(const section of copy.sections) for(const field of section.fields) {delete field.datePolicy;delete field.yearPolicy;delete field.inputPolicy;if(['amount','area'].includes(schema.sections.flatMap(s=>s.fields).find(f=>f.key===field.key)?.inputPolicy?.kind)) field.step=1;for(const child of field.fields||[]) delete child.inputPolicy;}return copy;};
const oldSchema=strip(schema);oldSchema.sections[0].fields.find(f=>f.key==='year').label='Custom operator year label';oldSchema.sections[0].fields.push({key:'custom_question',label:'Custom question',type:'text',options:['preserved']});
await conn.execute('INSERT INTO survey_schema(id,schema_json) VALUES(7,?) ON DUPLICATE KEY UPDATE schema_json=VALUES(schema_json)',[JSON.stringify(oldSchema)]);
const today=v.dateBounds({minYear:1900,maxYearsFromToday:0,timeZone:'Asia/Dubai'}).max;
const baseline={company:'AE DATE HARNESS',contact:'Ali',phone:'+971501234567',address:'Dubai',inspector:'Inspector',visitDate:today,conclusion:'Ready for Project Matching',specialist_civil:['General Civil Works'],year:'2020'};
const historicalData={...baseline,visitDate:'0003-02-03',expiry:'0002-03-03',custom_question:'Historical answer unchanged'};
const [old]=await conn.execute("INSERT INTO company_interviews(company_name,status,country,schema_version,schema_snapshot,verification_data,draft_token_hash) VALUES('AE DATE HARNESS historical','draft','ae',?,?,?,?)",[v.VERSION,JSON.stringify(oldSchema),JSON.stringify(historicalData),v.hashToken('a'.repeat(64))]);
const [legacyRow]=await conn.execute("INSERT INTO company_interviews(company_name,status,country,schema_version,schema_snapshot,section_1) VALUES('AE DATE HARNESS legacy','submitted','ae','legacy',?,?)",[JSON.stringify(legacy),JSON.stringify({old_key:'Legacy date 0002 untouched'})]);
const ids=[old.insertId,legacyRow.insertId];
let pool,server,pass=0;const backupDir=mkdtempSync(path.join(os.tmpdir(),'tarmeer-date-backup-'));
const check=async(name,fn)=>{await fn();pass++;console.log(`PASS ${name}`);};
try {
 const ctrl=require(path.join(root,'server/dist/controllers/fieldInterviewController.js'));
 const admin=require(path.join(root,'server/dist/controllers/fieldAdminController.js'));
 pool=require(path.join(root,'server/dist/config/database.js')).default;
 await new Promise(resolve=>setTimeout(resolve,150));
 const express=require('express');const app=express();app.use(express.json());app.use((req,res,next)=>{req.country='ae';if(req.headers['x-harness-editor']){req.admin={role:'super_admin',country:'ae',full_name:'Date harness reviewer'};req.adminId=1;}next();});
 app.get('/schema',ctrl.getSurveySchema);app.get('/draft',ctrl.getMyDraft);app.post('/draft',ctrl.createDraft);app.patch('/draft/:id',ctrl.saveDraft);app.post('/submit/:id',ctrl.submitInterview);app.post('/resubmit/:id',ctrl.reSubmitInterview);app.patch('/admin/:id',admin.editInterview);
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const hit=async(url,method='GET',body,headers={})=>{const response=await fetch(base+url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 const oldHeaders={'x-interview-token':'a'.repeat(64)};
 await check('old V7 snapshot read and draft validation receive policies before metadata migration',async()=>{
  const result=await hit('/draft?id='+old.insertId,'GET',undefined,oldHeaders);assert.equal(result.status,200);
  assert.ok(result.data.draft.schema_snapshot.sections[4].fields.find(f=>f.key==='visitDate').datePolicy);assert.deepEqual(result.data.draft.verification_data,historicalData);
  const invalid=await hit('/draft/'+old.insertId,'PATCH',{verification_data:{visitDate:'0003-02-03'}},oldHeaders);assert.equal(invalid.status,400);assert.equal(invalid.data.field_key,'visitDate');
 });
 await check('metadata migration backs up, preserves answers/legacy/timestamps/custom schema and is idempotent',async()=>{
  const [before]=await conn.execute('SELECT * FROM company_interviews WHERE id IN (?,?) ORDER BY id',[old.insertId,legacyRow.insertId]);
  for(let i=0;i<2;i++) {const result=spawnSync(process.execPath,[path.join(root,'scripts/migrations/upgrade-verification-v7-input-policies.cjs')],{env:{...process.env,VERIFICATION_BACKUP_DIR:backupDir},encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  const [after]=await conn.execute('SELECT * FROM company_interviews WHERE id IN (?,?) ORDER BY id',[old.insertId,legacyRow.insertId]);
  for(let i=0;i<before.length;i++) for(const key of Object.keys(before[i])) if(key!=='schema_snapshot'||before[i].schema_version==='legacy') assert.deepEqual(after[i][key],before[i][key],key);
  assert.deepEqual(strip(after[0].schema_snapshot),oldSchema);assert.ok(after[0].schema_snapshot.sections[4].fields.find(f=>f.key==='expiry').datePolicy);assert.equal(readdirSync(backupDir).length,2);
  const [catalogue]=await conn.execute('SELECT schema_json FROM survey_schema WHERE id=7');assert.deepEqual(strip(JSON.parse(catalogue[0].schema_json)),oldSchema);
 });
 await check('a historical invalid draft can be corrected without losing unrelated old answers',async()=>{
  const corrected=await hit('/draft/'+old.insertId,'PATCH',{verification_data:{visitDate:today,expiry:'2020-01-01'}},oldHeaders);assert.equal(corrected.status,200);
  const loaded=(await hit('/draft?id='+old.insertId,'GET',undefined,oldHeaders)).data.draft;assert.equal(loaded.verification_data.custom_question,'Historical answer unchanged');assert.equal(loaded.verification_data.expiry,'2020-01-01');
 });
 const created=await hit('/draft','POST',{country:'ae',schema_version:v.VERSION});assert.equal(created.status,201);const draft=created.data;ids.push(draft.id);const headers={'x-interview-token':draft.draft_token};
 await check('atomic evidence removal preserves concurrently appended uploads, retries and other tabs',async()=>{
  const a={url:'/uploads/field-attachments/a.png',name:'A'},b={url:'/uploads/field-attachments/b.png',name:'B'},c={url:'/uploads/field-attachments/c.png',name:'Concurrent'};
  await conn.execute('UPDATE company_interviews SET attachments=? WHERE id=?',[JSON.stringify([a,b]),draft.id]);
  await conn.beginTransaction();await conn.execute('SELECT id FROM company_interviews WHERE id=? FOR UPDATE',[draft.id]);
  const removal=hit('/draft/'+draft.id,'PATCH',{removed_attachment_urls:[a.url]},headers);
  const append=pool.execute("UPDATE company_interviews SET attachments=JSON_ARRAY_APPEND(attachments,'$',CAST(? AS JSON)) WHERE id=?",[JSON.stringify(c),draft.id]);
  await conn.commit();const [result]=await Promise.all([removal,append]);assert.equal(result.status,200);
  let [rows]=await conn.execute('SELECT attachments FROM company_interviews WHERE id=?',[draft.id]);assert.deepEqual(rows[0].attachments,[b,c]);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{removed_attachment_urls:[a.url]},headers)).status,200);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{removed_attachment_urls:[b.url],attachments:[c]},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{removed_attachment_urls:[1]},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{removed_attachment_urls:[b.url]},headers)).status,200);
  [rows]=await conn.execute('SELECT attachments FROM company_interviews WHERE id=?',[draft.id]);assert.deepEqual(rows[0].attachments,[c]);
 });
 const dateAfter=date=>{const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);return next.toISOString().slice(0,10);};
 await check('draft save rejects impossible/ancient/future visit/completion dates and attributes errors',async()=>{
  for(const [key,value] of [['visitDate','0003-02-03'],['visitDate','2026-02-30'],['visitDate',dateAfter(today)],['case1_date',dateAfter(today)],['case2_date','1899-12-31'],['case3_date','2025-02-29'],['expiry','0002-03-03']]) {
   const response=await hit('/draft/'+draft.id,'PATCH',{verification_data:{[key]:value}},headers);assert.equal(response.status,400,key+' '+value);assert.equal(response.data.field_key,key);
  }
 });
 await check('expiry and start enforce separate future horizons while allowing historical dates',async()=>{
  for(const [key,years] of [['expiry',30],['start',5]]) {
   const max=v.dateBounds({minYear:1900,maxYearsFromToday:years,timeZone:'Asia/Dubai'}).max;
   for(const value of ['1900-01-01','2020-01-01',max]) assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{[key]:value}},headers)).status,200,key+' '+value);
   const bad=await hit('/draft/'+draft.id,'PATCH',{verification_data:{[key]:dateAfter(max)}},headers);assert.equal(bad.status,400);assert.equal(bad.data.field_key,key);
  }
 });
 await check('established year min/current-year boundaries hold on draft save',async()=>{
  const year=Number(today.slice(0,4));
  for(const value of ['0','3','1899',String(year+1)]) {const response=await hit('/draft/'+draft.id,'PATCH',{verification_data:{year:value}},headers);assert.equal(response.status,400);assert.equal(response.data.field_key,'year');}
  for(const value of ['1900',String(year)]) assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{year:value}},headers)).status,200);
 });
 await check('submit semantic failures carry work/arithmetic field keys and become valid after correction',async()=>{
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{...baseline,specialist_civil:[]}},headers)).status,200);
  let response=await hit('/submit/'+draft.id,'POST',undefined,headers);assert.equal(response.status,400);assert.equal(response.data.field_key,'specialist_civil');
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{specialist_civil:['General Civil Works'],typicalMin:'20',typicalMax:'10'}},headers)).status,200);
  response=await hit('/submit/'+draft.id,'POST',undefined,headers);assert.equal(response.status,400);assert.equal(response.data.field_key,'typicalMin');
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{typicalMax:'30'}},headers)).status,200);
  assert.equal((await hit('/submit/'+draft.id,'POST',undefined,headers)).status,200);
 });
 await check('admin edit and protected resubmit reject semantic dates with field key and preserve stored values',async()=>{
  const auth={'x-harness-editor':'1'};
  for(const [url,key,value] of [['/admin/'+draft.id,'visitDate','0003-02-03'],['/resubmit/'+draft.id,'expiry','0002-03-03']]) {
   const response=await hit(url,url.startsWith('/admin')?'PATCH':'POST',{verification_data:{[key]:value}},auth);assert.equal(response.status,400);assert.equal(response.data.field_key,key);
  }
  const [rows]=await conn.execute('SELECT verification_data FROM company_interviews WHERE id=?',[draft.id]);assert.equal(rows[0].verification_data.visitDate,today);assert.notEqual(rows[0].verification_data.expiry,'0002-03-03');
 });
 await check('all four UAE contact phone fields accept formatting/Arabic digits and reject bad prefixes/lengths',async()=>{
  const auth={'x-harness-editor':'1'};
  for(const field of schema.sections.flatMap(s=>s.fields).filter(f=>f.inputPolicy.kind==='phone')) {
   for(const value of ['0501234567','+971 50 123 4567','00971-4-123-4567','٠٥٠١٢٣٤٥٦٧']) assert.equal((await hit('/admin/'+draft.id,'PATCH',{verification_data:{[field.key]:value}},auth)).status,200,field.key+' '+value);
   for(const value of ['12345','0511234567','0571234567','0591234567','+9710501234567','0500000000','050123456']) {const response=await hit('/admin/'+draft.id,'PATCH',{verification_data:{[field.key]:value}},auth);assert.equal(response.status,400,value);assert.equal(response.data.field_key,field.key);}
  }
 });
 await check('meaningful identity/address, numeric IDs and percentages persist correctly through HTTP',async()=>{
  const auth={'x-harness-editor':'1'};
  for(const key of ['company','contact','ownerName','commercialName','technicalName','inspector','address','facilityAddress']) {const response=await hit('/admin/'+draft.id,'PATCH',{verification_data:{[key]:'12345'}},auth);assert.equal(response.status,400,key);assert.equal(response.data.field_key,key);}
  const response=await hit('/admin/'+draft.id,'PATCH',{verification_data:{company:'3M',contact:'阿明',address:'شارع دبي 123',license:'123456',paymentTerms:'50% / 30% / 20%',qualifications:'2026 / 2027',verifyNotes:'First line\nSecond line'}},auth);assert.equal(response.status,200);
  const [rows]=await conn.execute('SELECT verification_data FROM company_interviews WHERE id=?',[draft.id]);assert.equal(rows[0].verification_data.license,'123456');assert.equal(rows[0].verification_data.address,'شارع دبي 123');
 });
 await check('decimal currency/area, all count caps, map aliases and enum tampering are enforced',async()=>{
  const auth={'x-harness-editor':'1'};
  const cases=[['minimum','12.34',200],['minimum','12.345',400],['case1_area','12.345',200],['case1_area','12.3456',400],['workers_civil_0','100001',400],['workers_civil_0','0',200],['map','https://www.google.com/maps?q=Dubai',200],['map','https://maps.app.goo.gl/Abc',200],['map','https://google.com.evil.test/maps',400],['website','@contractor.dubai',200],['office','Tampered choice',400],['factory',['None','None'],400],['areas',[{emirate:'Dubai',district:'12345'}],400]];
  for(const [key,value,status] of cases) {const response=await hit('/admin/'+draft.id,'PATCH',{verification_data:{[key]:value}},auth);assert.equal(response.status,status,key+' '+String(value));if(status===400) assert.equal(response.data.field_key,key);}
 });
 console.log(`\n${pass}/${pass} PASS — Dubai-only dates/year/metadata migration/structured error HTTP+MySQL`);
} finally {
 if(server) await new Promise(resolve=>server.close(resolve));
 await conn.execute(`DELETE FROM interview_edit_logs WHERE interview_id IN (${ids.map(()=>'?').join(',')})`,ids).catch(()=>{});
 await conn.execute(`DELETE FROM company_interviews WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
 if(pool) await pool.end();await conn.end();rmSync(backupDir,{recursive:true,force:true});
}
