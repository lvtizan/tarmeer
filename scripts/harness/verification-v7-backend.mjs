#!/usr/bin/env node
// Self-contained real-MySQL/HTTP tests. Dedicated LOCAL database, no external notifications.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'server/dist/app.js'));
const dotenv=require('dotenv'); dotenv.config({path:path.join(root,'server/.env')});
if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST)) throw Error('Harness requires an explicitly configured local DB_HOST.');
process.env.DB_NAME='tarmeer_v7_harness'; process.env.DEV_SKIP_EMAIL='true';process.env.CRM_INBOUND_URL='';
const mysql=require('mysql2/promise');
const conn=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
await conn.query('CREATE DATABASE IF NOT EXISTS tarmeer_v7_harness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
await conn.query('USE tarmeer_v7_harness');
const source=readFileSync(path.join(root,'server/dist/lib/autoMigrate.js'),'utf8');
const table=source.match(/sql: `(CREATE TABLE IF NOT EXISTS company_interviews [\s\S]*?)`,/)[1];await conn.query(table);
const helper=require(path.join(root,'server/dist/lib/verificationV7'));
await helper.ensureVerificationSchema(conn);
const [cols]=await conn.query('SHOW COLUMNS FROM company_interviews');const existing=new Set(cols.map(r=>r.Field));
for(const [k,t] of Object.entries({country:"VARCHAR(5) NOT NULL DEFAULT 'ae'",company_ref_source:'VARCHAR(20) NULL',photos:'JSON NULL',attachments:'JSON NULL',location_pin:'JSON NULL',qa_answers:'JSON NULL',filled_by:'VARCHAR(120) NULL'})) if(!existing.has(k)) await conn.query(`ALTER TABLE company_interviews ADD COLUMN ${k} ${t}`);
await conn.query('ALTER TABLE company_interviews MODIFY interviewer_id INT NULL');
await conn.query('CREATE TABLE IF NOT EXISTS survey_schema (id INT PRIMARY KEY, schema_json MEDIUMTEXT NOT NULL)');
await conn.query("CREATE TABLE IF NOT EXISTS admin_users (id INT PRIMARY KEY, full_name VARCHAR(100), country VARCHAR(5) DEFAULT 'ae')");
await conn.query('CREATE TABLE IF NOT EXISTS company_profiles (id INT PRIMARY KEY, company_name VARCHAR(200), country VARCHAR(5), deleted_at DATETIME NULL)');
await conn.query('CREATE TABLE IF NOT EXISTS uae_companies (id INT PRIMARY KEY, name_en VARCHAR(200), country VARCHAR(5))');
await conn.query("INSERT INTO admin_users(id,full_name,country) VALUES(1,'Harness reviewer','ae') ON DUPLICATE KEY UPDATE full_name=VALUES(full_name)");
await conn.query("INSERT INTO company_profiles(id,company_name,country) VALUES(101,'Harness AE','ae'),(102,'Harness VN','vn') ON DUPLICATE KEY UPDATE country=VALUES(country)");
const legacySource=readFileSync(path.join(root,'server/dist/routes/admin.js'),'utf8');
const literal=legacySource.match(/const DEFAULT_SURVEY_SCHEMA = JSON.stringify\((\[[^\n]+\])\);/)[1];
const legacy=JSON.parse(literal);
await conn.execute('INSERT INTO survey_schema(id,schema_json) VALUES(1,?) ON DUPLICATE KEY UPDATE schema_json=VALUES(schema_json)',[JSON.stringify(legacy)]);
const [old]=await conn.execute("INSERT INTO company_interviews(company_name,status,interviewer_id,country,section_1,section_9) VALUES('HARNESS legacy preserved','submitted',1,'ae',?,?)",[JSON.stringify({unknown_old_key:'Do not lose this'}),JSON.stringify({emirates_served:['Dubai']})]);
const ids=[old.insertId];const temp=mkdtempSync(path.join(os.tmpdir(),'verification-v7-backup-'));
let server,pool,pass=0;
function check(name,fn){return Promise.resolve().then(fn).then(()=>{pass++;console.log(`PASS ${name}`);});}
try {
 await check('migration backup, snapshots and idempotence',async()=>{
  for(let i=0;i<2;i++){const p=spawnSync(process.execPath,[path.join(root,'scripts/migrations/activate-verification-v7.cjs')],{env:{...process.env,VERIFICATION_BACKUP_DIR:temp},encoding:'utf8'});assert.equal(p.status,0,p.stderr);}
  const [rows]=await conn.execute('SELECT * FROM company_interviews WHERE id=?',[old.insertId]);assert.deepEqual(rows[0].section_1,{unknown_old_key:'Do not lose this'});assert.equal(rows[0].schema_version,'legacy');assert.deepEqual(rows[0].schema_snapshot,legacy);assert.equal(readdirSync(temp).length,2);
 });
 const ctrl=require(path.join(root,'server/dist/controllers/fieldInterviewController.js'));
 const admin=require(path.join(root,'server/dist/controllers/fieldAdminController.js'));
 pool=require(path.join(root,'server/dist/config/database.js')).default;
 // Module-load compatibility migrations run before test requests.
 await new Promise(r=>setTimeout(r,150));
 const express=require('express');const app=express();app.use(express.json());
 app.use((req,res,next)=>{req.country=req.headers['x-country']||'ae';if(req.headers['x-harness-role']){req.admin={role:req.headers['x-harness-role'],country:req.headers['x-harness-admin-country']||'ae',full_name:'Harness reviewer'};req.adminId=1;}next();});
 app.get('/schema',ctrl.getSurveySchema);app.post('/draft',ctrl.createDraft);app.get('/draft',ctrl.getMyDraft);app.patch('/draft/:id',ctrl.saveDraft);app.post('/draft/:id/submit',ctrl.submitInterview);
 app.post('/draft/:id/attachments',ctrl.guardDraftUpload,ctrl.uploadAttachmentMiddleware,ctrl.uploadAttachment);
 app.get('/admin',admin.listInterviews);app.get('/admin/:id',admin.getInterview);app.patch('/admin/:id',admin.editInterview);app.post('/resubmit/:id',ctrl.reSubmitInterview);
 app.use((e,req,res,next)=>res.status(400).json({error:e.message}));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function hit(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{...(body && !(body instanceof FormData)?{'content-type':'application/json'}:{}),...headers},body:body?body instanceof FormData?body:JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 let draft;
 await check('AE activation, VN/SA/legacy schema isolation',async()=>{
  assert.equal((await hit('/schema?version='+helper.VERSION)).data.schema.version,helper.VERSION);
  for(const country of ['vn','sa']) assert.deepEqual((await hit('/schema?country='+country)).data.schema,legacy);
  assert.deepEqual((await hit('/schema?version=legacy')).data.schema,legacy);
 });
 await check('cached AE forms without a version keep legacy schema and draft after activation',async()=>{
  assert.deepEqual((await hit('/schema')).data.schema,legacy);
  const r=await hit('/draft','POST',{});assert.equal(r.status,201);ids.push(r.data.id);
  assert.equal(r.data.schema_version,'legacy');assert.equal(r.data.draft_token,undefined);assert.deepEqual(r.data.schema_snapshot,legacy);
 });
 await check('AE draft created with private token and immutable schema snapshot',async()=>{
  const r=await hit('/draft','POST',{country:'ae',schema_version:helper.VERSION});assert.equal(r.status,201);draft=r.data;ids.push(draft.id);assert.equal(draft.draft_token.length,64);assert.equal(draft.schema_snapshot.version,helper.VERSION);
 });
 const headers={'x-interview-token':draft.draft_token};
 await check('enumerable IDs cannot read/save/submit/upload V7 without capability',async()=>{
  assert.equal((await hit('/draft?id='+draft.id)).status,403);assert.equal((await hit('/draft/'+draft.id,'PATCH',{company_name:'Attack'})).status,403);assert.equal((await hit('/draft/'+draft.id+'/submit','POST')).status,403);const data=new FormData();data.append('file',new Blob(['x'],{type:'image/png'}),'x.png');assert.equal((await hit('/draft/'+draft.id+'/attachments','POST',data)).status,403);
 });
 const schema=draft.schema_snapshot;const answers={};
 for(const field of schema.sections.flatMap(s=>s.fields)){
  if(field.type==='attachment') continue;
  answers[field.key]=field.type==='checkbox'?[]:field.type==='repeat'?[{emirate:'Dubai',district:'JVC'}]:'';
 }
 Object.assign(answers,{company:'HARNESS V7 persisted',contact:'Ali',phone:'+971501234567',address:'Dubai',inspector:'Inspector',visitDate:'2026-10-07',conclusion:'Ready for Project Matching',specialist_civil:['General Civil Works'],workers_civil_0:'0',employees:'4',trade_direct_0:'2',trade_available_0:'1',case3_name:'Project 3',ownerName:'Optional owner',commercialPhone:'+97150',specialist_civil_detail_10:'Extra work',workers_civil_extra_10:'2'});
 await check('strict validation rejects unsupported fields, negative counts and incomplete submission',async()=>{
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{employees:'-1'}},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:{lost_field:'x'}},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id+'/submit','POST',undefined,headers)).status,400);
 });
 await check('all 320 ordinary answers persist exactly and legacy columns untouched',async()=>{
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{verification_data:answers},headers)).status,200);
  const r=await hit('/draft?id='+draft.id,'GET',undefined,headers);assert.equal(r.status,200);assert.deepEqual(r.data.draft.verification_data,answers);assert.equal(r.data.draft.draft_token_hash,undefined);assert.equal(r.data.draft.section_1,null);
 });
 await check('V7 list projects service areas from immutable snapshot without changing legacy columns',async()=>{
  const response=await hit('/admin?country=ae','GET',undefined,{'x-harness-role':'super_admin'});
  assert.equal(response.status,200);
  const current=response.data.interviews.find(row=>row.id===draft.id);
  assert.deepEqual(current.service_areas,[{emirate:'Dubai',district:'JVC'}]);assert.equal(current.schema_snapshot,undefined);assert.equal(current.section_9,null);
  const historical=response.data.interviews.find(row=>row.id===old.insertId);
  assert.equal(historical.service_areas,null);assert.deepEqual(historical.section_9,{emirates_served:['Dubai']});
 });
 await check('concurrent partial saves merge without losing disjoint answers',async()=>{
  const edits=await Promise.all([hit('/draft/'+draft.id,'PATCH',{verification_data:{gaps:'Saved concurrently'}},headers),hit('/draft/'+draft.id,'PATCH',{verification_data:{verifyNotes:'Other concurrent field'}},headers)]);
  assert.deepEqual(edits.map(x=>x.status),[200,200]);
  const row=(await hit('/draft?id='+draft.id,'GET',undefined,headers)).data.draft;
  assert.equal(row.verification_data.gaps,'Saved concurrently');assert.equal(row.verification_data.verifyNotes,'Other concurrent field');
  answers.gaps='Saved concurrently';answers.verifyNotes='Other concurrent field';
 });
 await check('same-country explicit reference accepted, missing source/cross-country rejected',async()=>{
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{company_ref_id:101},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{company_ref_id:102,company_ref_source:'profile'},headers)).status,400);
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{company_ref_id:101,company_ref_source:'profile'},headers)).status,200);
 });
 let attachment;
 await check('real evidence upload type/category validation and metadata round-trip',async()=>{
  const invalid=new FormData();invalid.append('field_key','Office Evidence');invalid.append('file',new Blob(['<script>bad</script>'],{type:'image/png'}),'fake.png');assert.equal((await hit('/draft/'+draft.id+'/attachments','POST',invalid,headers)).status,400);
  const valid=new FormData();valid.append('field_key','Office Evidence');valid.append('file',new Blob([Buffer.from('89504e470d0a1a0a00000000','hex')],{type:'image/png'}),'evidence.png');const r=await hit('/draft/'+draft.id+'/attachments','POST',valid,headers);assert.equal(r.status,200);attachment=r.data;assert.equal(attachment.field_key,'Office Evidence');
  assert.equal((await hit('/draft/'+draft.id,'PATCH',{attachments:[{url:'https://evil.example/file'}]},headers)).status,400);
  const stored=(await hit('/draft?id='+draft.id,'GET',undefined,headers)).data.draft;assert.equal(stored.attachments.length,1);
 });
 await check('concurrent evidence uploads append without dropping metadata',async()=>{
  const result=await Promise.all(Array.from({length:3},(_,i)=>{const data=new FormData();data.append('field_key','Project 1');data.append('file',new Blob([Buffer.from('89504e470d0a1a0a00000000','hex')],{type:'image/png'}),`parallel-${i}.png`);return hit('/draft/'+draft.id+'/attachments','POST',data,headers);}));
  assert.deepEqual(result.map(x=>x.status),[200,200,200]);
  const row=(await hit('/draft?id='+draft.id,'GET',undefined,headers)).data.draft;assert.equal(row.attachments.length,4);assert.equal(new Set(row.attachments.map(x=>x.url)).size,4);
 });
 await check('submit then country-scoped admin rendering/editing with audit snapshot',async()=>{
  const submissions=await Promise.all([hit('/draft/'+draft.id+'/submit','POST',undefined,headers),hit('/draft/'+draft.id+'/submit','POST',undefined,headers)]);
  assert.equal(submissions.filter(x=>x.status===200).length,1);assert.ok(submissions.some(x=>[404,409].includes(x.status)));
  const [initialLogs]=await conn.execute("SELECT id FROM interview_edit_logs WHERE interview_id=? AND edit_summary='Initial submission'",[draft.id]);assert.equal(initialLogs.length,1);
  const denied={'x-harness-role':'sub_admin','x-harness-admin-country':'vn'};assert.equal((await hit('/admin/'+draft.id+'?country=ae','GET',undefined,denied)).status,404);assert.equal((await hit('/admin/'+draft.id,'PATCH',{verification_data:{gaps:'attack'}},denied)).status,404);
  const allowed={'x-harness-role':'super_admin'};let r=await hit('/admin/'+draft.id,'GET',undefined,allowed);assert.equal(r.status,200);assert.deepEqual(r.data.interview.verification_data,answers);assert.equal(r.data.interview.draft_token_hash,undefined);
  assert.equal((await hit('/admin/'+draft.id,'PATCH',{verification_data:{gaps:'Need document'}},allowed)).status,200);r=await hit('/admin/'+draft.id,'GET',undefined,allowed);assert.equal(r.data.interview.verification_data.gaps,'Need document');assert.ok(r.data.edit_logs.length>=2);
  const [logs]=await conn.execute('SELECT snapshot_before FROM interview_edit_logs WHERE interview_id=? AND snapshot_before IS NOT NULL',[draft.id]);assert.equal(logs[0].snapshot_before.verification_data.company,answers.company);
 });
 await check('failed audit insert rolls back administrator answer mutation',async()=>{
  await conn.query("CREATE TRIGGER harness_v7_audit_failure BEFORE INSERT ON interview_edit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Harness audit failure'");
  try {
   const auth={'x-harness-role':'super_admin'};
   const result=await hit('/admin/'+draft.id,'PATCH',{verification_data:{gaps:'Must rollback'}},auth);assert.equal(result.status,500);
   const [row]=await conn.execute('SELECT verification_data FROM company_interviews WHERE id=?',[draft.id]);assert.equal(row[0].verification_data.gaps,'Need document');
  } finally {await conn.query('DROP TRIGGER harness_v7_audit_failure');}
 });
 await check('protected resubmit preserves exact data, rejects country changes and invalid totals',async()=>{
  const auth={'x-harness-role':'field_staff'};
  assert.equal((await hit('/resubmit/'+draft.id,'POST',{verification_data:{employees:'0'}},auth)).status,400);
  assert.equal((await hit('/resubmit/'+draft.id,'POST',{company_ref_id:102,company_ref_source:'profile'},auth)).status,400);
  assert.equal((await hit('/resubmit/'+draft.id,'POST',{verification_data:{verifyNotes:'Verified again'}},auth)).status,200);
  const [row]=await conn.execute('SELECT verification_data FROM company_interviews WHERE id=?',[draft.id]);assert.equal(row[0].verification_data.verifyNotes,'Verified again');assert.equal(row[0].verification_data.case3_name,'Project 3');
 });
 console.log(`\n${pass}/${pass} PASS — V7 real HTTP + MySQL persistence/isolation/backup/evidence/audit`);
} finally {
 if(server) await new Promise(r=>server.close(r));
 const [files]=await conn.execute(`SELECT attachments FROM company_interviews WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
 for(const row of files) for(const item of row.attachments||[]) {const file=path.join(root,'server/public',item.url);if(item.url.startsWith('/uploads/field-attachments/')) rmSync(file,{force:true});}
 await conn.execute(`DELETE FROM interview_edit_logs WHERE interview_id IN (${ids.map(()=>'?').join(',')})`,ids).catch(()=>{});
 await conn.execute(`DELETE FROM company_interviews WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
 if(pool) await pool.end();await conn.end();rmSync(temp,{recursive:true,force:true});
}
