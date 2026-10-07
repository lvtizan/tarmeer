#!/usr/bin/env node
'use strict';
// Run locally only with DB_HOST=localhost. Production: SSH into the API directory,
// use its existing .env, and supply --production-server. Complete row backup precedes writes.
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const serverDir=process.env.TARMEER_API_DIR || path.join(root,'server');
require(path.join(serverDir,'node_modules/dotenv')).config({path:path.join(serverDir,'.env')});
const host=process.env.DB_HOST;
const production=process.argv.includes('--production-server');
if (!host) throw new Error('DB_HOST must be explicitly set.');
if(!['localhost','127.0.0.1','::1'].includes(host) && (!production || fs.realpathSync(serverDir)!=='/tarmeer/tarmeer_api')) throw new Error('Production activation must run via SSH using /tarmeer/tarmeer_api/.env.');
const mysql=require(path.join(serverDir,'node_modules/mysql2/promise'));
const schema=require(path.join(serverDir,'dist/lib/verificationV7Schema.json'));
const helper=require(path.join(serverDir,'dist/lib/verificationV7'));
(async()=>{
 const db=await mysql.createConnection({host,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'tarmeer',charset:'utf8mb4'});
 try {
  const [records]=await db.execute('SELECT * FROM company_interviews ORDER BY id');
  const [schemas]=await db.execute('SELECT * FROM survey_schema ORDER BY id');
  const legacy=schemas.find(r=>Number(r.id)===1);
  if(!legacy) throw new Error('Legacy schema row 1 is required before activating V7.');
  const backupDir=process.env.VERIFICATION_BACKUP_DIR || path.join(serverDir,'backups');
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  const backup=path.join(backupDir,`verification-before-v7-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  fs.writeFileSync(backup,JSON.stringify({created_at:new Date().toISOString(),records,schemas},null,2),{flag:'wx',mode:0o600});
  console.log(`Backup complete: ${backup} (${records.length} interviews, ${schemas.length} schemas)`);
  await helper.ensureVerificationSchema(db);
  await db.beginTransaction();
  let lockedCount=0;
  try {
   // Lock the actual activation snapshot: live edits between the initial backup
   // and DDL are preserved and backed up before any answer-schema mutation.
   const [lockedRecords]=await db.execute('SELECT * FROM company_interviews ORDER BY id FOR UPDATE');
   const [lockedSchemas]=await db.execute('SELECT * FROM survey_schema ORDER BY id FOR UPDATE');
   const lockedLegacy=lockedSchemas.find(r=>Number(r.id)===1);
   if(!lockedLegacy) throw new Error('Legacy schema disappeared during activation.');
   const lockedBackup=backup+'.activation.tmp';
   fs.writeFileSync(lockedBackup,JSON.stringify({created_at:new Date().toISOString(),records,schemas,activation_records:lockedRecords,activation_schemas:lockedSchemas},null,2),{flag:'wx',mode:0o600});
   fs.renameSync(lockedBackup,backup);
   lockedCount=lockedRecords.length;
   const legacyJSON=JSON.stringify(helper.parseJSON(lockedLegacy.schema_json));
   await db.execute("UPDATE company_interviews SET schema_snapshot = ?, schema_version = 'legacy', updated_at = updated_at WHERE schema_snapshot IS NULL AND (schema_version IS NULL OR schema_version = 'legacy')",[legacyJSON]);
   const [existing]=await db.execute('SELECT schema_json FROM survey_schema WHERE id = 7 FOR UPDATE');
   if(!existing.length) await db.execute('INSERT INTO survey_schema (id,schema_json) VALUES (7,?)',[JSON.stringify(schema)]);
   else if(helper.parseJSON(existing[0].schema_json)?.version !== schema.version) throw new Error('Schema row 7 is occupied by another version; refusing overwrite.');
   const [after]=await db.execute('SELECT * FROM company_interviews ORDER BY id');
   const preservedKeys=Object.keys(lockedRecords[0]||{}).filter(k=>!['schema_version','schema_snapshot'].includes(k));
   if(after.length!==lockedRecords.length) throw new Error('Record count changed during migration.');
   for(let i=0;i<lockedRecords.length;i++) for(const key of preservedKeys) if(JSON.stringify(lockedRecords[i][key])!==JSON.stringify(after[i][key])) throw new Error(`Record ${lockedRecords[i].id} changed in ${key}; refusing activation.`);
   await db.commit();
  } catch(error) { await db.rollback(); throw error; }
  console.log(`PASS: ${lockedCount}/${lockedCount} legacy records unchanged; snapshots preserved; AE V7 activated.`);
 } finally {await db.end();}
})().catch(error=>{console.error(error);process.exitCode=1;});
