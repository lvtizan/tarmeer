#!/usr/bin/env node
// Real HTTP, authentication middleware, transactions and MySQL in a disposable LOCAL database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'server/dist/app.js'));
require('dotenv').config({path:path.join(root,'server/.env')});
if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))throw Error('Local database required.');
const dbName=`tarmeer_schema_editor_test_${process.pid}`;
process.env.DB_NAME=dbName;process.env.DEV_SKIP_EMAIL='true';process.env.CRM_INBOUND_URL='';
const mysql=require('mysql2/promise');
const conn=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
let server,pool,passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try{
 await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await conn.query(`USE \`${dbName}\``);
 await conn.query('CREATE TABLE survey_schema(id INT PRIMARY KEY,schema_json MEDIUMTEXT NOT NULL)');
 await conn.query("CREATE TABLE company_interviews(id INT AUTO_INCREMENT PRIMARY KEY,country VARCHAR(5),status VARCHAR(20),schema_version VARCHAR(60),schema_snapshot JSON,verification_data JSON)");
 await conn.query("CREATE TABLE admin_users(id INT AUTO_INCREMENT PRIMARY KEY,email VARCHAR(150),password VARCHAR(255),full_name VARCHAR(100),role VARCHAR(30),permissions JSON,is_active TINYINT DEFAULT 1,country VARCHAR(5) DEFAULT 'ae')");
 await conn.query('CREATE TABLE admin_activity_logs(id INT AUTO_INCREMENT PRIMARY KEY,admin_id INT,action VARCHAR(80),target_type VARCHAR(80),target_id INT,details JSON)');
 for(const [id,role,permission,country]of[[1,'super_admin',false,'ae'],[2,'sub_admin',true,'ae'],[3,'sub_admin',false,'ae'],[4,'field_staff',true,'ae'],[5,'sub_admin',true,'vn']])await conn.execute('INSERT INTO admin_users(id,email,full_name,role,permissions,country)VALUES(?,?,?,?,?,?)',[id,`fixture${id}@test.local`,'Fixture',role,JSON.stringify({can_edit_survey_schema:permission}),country]);
 const version='tarmeer-verification-v7';
 const schema={version,country:'ae',sections:[{key:'s',title:'Dynamic fixture',fields:[{key:'contact',label:'Original contact',type:'text',required:true,inputPolicy:{maxLength:80}},{key:'team',label:'Team',type:'repeat',fields:[{key:'member',label:'Member',type:'text'}]}]}]};
 const original=JSON.stringify(schema);await conn.execute('INSERT INTO survey_schema VALUES(7,?),(1,?)',[original,'[{"key":"legacy","fields":[]}]']);
 await conn.execute("INSERT INTO company_interviews(id,country,status,schema_version,schema_snapshot,verification_data)VALUES(1,'ae','draft',?,?,?),(2,'ae','submitted',?,?,?)",[version,original,JSON.stringify({contact:'Saved answer'}),version,original,JSON.stringify({contact:'Historical answer'})]);
 const express=require('express'),jwt=require('jsonwebtoken');
 const auth=require(path.join(root,'server/dist/middleware/adminAuth'));const controller=require(path.join(root,'server/dist/controllers/surveySchemaEditorController'));const admins=require(path.join(root,'server/dist/controllers/adminController'));pool=require(path.join(root,'server/dist/config/database')).default;
 const secret=require(path.join(root,'server/dist/config')).default.jwt.secret;
 const tokens=new Map([1,2,3,4,5].map(id=>[id,jwt.sign({adminId:id,type:'admin'},secret,{expiresIn:'5m'})]));
 const app=express();app.use(express.json());app.use((req,res,next)=>req.headers.authorization?auth.authenticateAdmin(req,res,()=>auth.requireAdmin(req,res,next)):next());
 app.get('/editor',controller.getSurveySchemaEditor);app.patch('/editor',auth.authenticateAdmin,auth.requireAdmin,controller.updateSurveySchemaEditor);
 app.post('/admins',auth.authenticateAdmin,auth.requireAdmin,auth.requireSuperAdmin,admins.createSubAdmin);app.patch('/admins/:id',auth.authenticateAdmin,auth.requireAdmin,auth.requireSuperAdmin,admins.updateAdmin);
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}`;
 const hit=async(method,url,id,body)=>{const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(id?{authorization:'Bearer '+tokens.get(id)}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,body:await r.json()};};
 const context=async(id=1)=>(await hit('GET','/editor?country=ae&draftId=1',id)).body;
 const mutation=async(action,extra={},id=1,ctx)=>{ctx||=await context(id);return hit('PATCH','/editor',id,{country:'ae',draftId:1,revision:ctx.revision,draftRevision:ctx.draftRevision,action,sectionKey:'s',fieldPath:['contact'],...extra});};
 await check('public and unpermitted roles cannot discover editor capabilities or write',async()=>{for(const id of [undefined,3,4,5]){assert.equal((await hit('GET','/editor?country=ae&draftId=1',id)).body.canEdit,false);assert.equal((await hit('PATCH','/editor',id,{country:'ae',action:'add'})).status,id?403:401);}});
 await check('permitted AE sub-admin receives schema and revisions; cross-country override is refused',async()=>{const c=await context(2);assert(c.canEdit);assert.equal(c.schema.sections[0].fields[0].label,'Original contact');assert.equal((await hit('PATCH','/editor',2,{country:'vn'})).status,403);});
 let lastMutation;
 await check('rename persists published template and active draft only, preserving keys/policies/answers',async()=>{const r=await mutation('rename',{label:'Renamed contact'},2);assert.equal(r.status,200);lastMutation=r.body;const [rows]=await conn.query('SELECT id,schema_snapshot,verification_data FROM company_interviews ORDER BY id');assert.equal(rows[0].schema_snapshot.sections[0].fields[0].label,'Renamed contact');assert.equal(rows[0].schema_snapshot.sections[0].fields[0].key,'contact');assert.equal(rows[0].schema_snapshot.sections[0].fields[0].inputPolicy.maxLength,80);assert.equal(rows[0].verification_data.contact,'Saved answer');assert.deepEqual(rows[1].schema_snapshot,schema);});
 let custom;
 await check('add text field survives reload in both template and active snapshot',async()=>{const r=await mutation('add',{label:'Custom note'},1,lastMutation);assert.equal(r.status,200);custom=r.body.schema.sections[0].fields[1];assert.match(custom.key,/^custom_[a-f0-9]{32}$/);assert.equal(custom.type,'text');assert.equal(custom.required,false);assert.equal((await context()).schema.sections[0].fields[1].key,custom.key);const [rows]=await conn.execute('SELECT schema_json FROM survey_schema WHERE id=7');assert.equal(JSON.parse(rows[0].schema_json).sections[0].fields[1].key,custom.key);});
 await check('custom answer remains persisted when field is soft-deleted',async()=>{await conn.execute('UPDATE company_interviews SET verification_data=? WHERE id=1',[JSON.stringify({contact:'Saved answer',[custom.key]:'Keep this answer'})]);const r=await mutation('delete',{fieldPath:[custom.key]});assert.equal(r.status,200);assert.equal(r.body.schema.sections[0].fields[1].retired,true);const [rows]=await conn.execute('SELECT verification_data FROM company_interviews WHERE id=1');assert.equal(rows[0].verification_data[custom.key],'Keep this answer');const helper=require(path.join(root,'server/dist/lib/verificationV7'));assert.equal(helper.validateAnswersDetailed(rows[0].verification_data,r.body.schema,false),null);});
 await check('nested add uses repeat child list instead of creating an unrelated top-level input',async()=>{const r=await mutation('add',{fieldPath:['team','member'],label:'Member note'});assert.equal(r.status,200);assert.equal(r.body.schema.sections[0].fields.find(f=>f.key==='team').fields[1].label,'Member note');});
 await check('stale published/draft revisions roll back instead of overwriting another edit',async()=>{const c=await context();assert.equal((await mutation('rename',{label:'First writer'},1,c)).status,200);assert.equal((await mutation('rename',{label:'Stale writer'},1,c)).status,409);assert.equal((await context()).schema.sections[0].fields[0].label,'First writer');});
 await check('two concurrent writers using one revision yield one commit and one conflict',async()=>{const c=await context();const r=await Promise.all([mutation('rename',{label:'Concurrent A'},1,c),mutation('rename',{label:'Concurrent B'},1,c)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);});
 await check('original deletion and submitted-draft editing are rejected with no historical rewrite',async()=>{assert.notEqual((await mutation('delete')).status,200);const c=await context();assert.equal((await mutation('rename',{draftId:2,label:'Forbidden'},1,c)).status,404);const [rows]=await conn.execute('SELECT schema_snapshot FROM company_interviews WHERE id=2');assert.deepEqual(rows[0].schema_snapshot,schema);});
 await check('admin permission assignment persists only recognized flags and older clients preserve new grant',async()=>{const created=await hit('POST','/admins',1,{email:'new-editor@test.local',password:'FixtureOnly#2026',fullName:'New editor',permissions:{can_edit_survey_schema:true,can_view_stats:true,forged:true}});assert.equal(created.status,201);const id=created.body.admin.id;assert.equal((await hit('PATCH','/admins/'+id,1,{permissions:{can_view_stats:false}})).status,200);const [rows]=await conn.execute('SELECT permissions FROM admin_users WHERE id=?',[id]);assert.equal(rows[0].permissions.can_edit_survey_schema,true);assert.equal(rows[0].permissions.can_view_stats,false);assert(!Object.hasOwn(rows[0].permissions,'forged'));});
 console.log(`${passed}/${passed} PASS — real HTTP + MySQL schema editing/auth/concurrency/history`);
}finally{
 if(server)await new Promise(r=>server.close(r));
 // Allow the existing nonblocking activity logger to drain before closing its pool.
 if(pool)await pool.end();
 await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);await conn.end();
}
