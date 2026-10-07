#!/usr/bin/env node
'use strict';
// Metadata-only V7 input-policy upgrade. Production must run over SSH with the existing API .env.
const fs=require('fs');
const path=require('path');
const serverDir=process.env.TARMEER_API_DIR || path.resolve(__dirname,'../../server');
require(path.join(serverDir,'node_modules/dotenv')).config({path:path.join(serverDir,'.env')});
const host=process.env.DB_HOST;
if(!host) throw new Error('DB_HOST must be explicitly configured.');
if(!['localhost','127.0.0.1','::1'].includes(host) && (!process.argv.includes('--production-server') || fs.realpathSync(serverDir)!=='/tarmeer/tarmeer_api')) throw new Error('Production migration must run via SSH using /tarmeer/tarmeer_api/.env.');
const mysql=require(path.join(serverDir,'node_modules/mysql2/promise'));
const canonical=require(path.join(serverDir,'dist/lib/verificationV7Schema.json'));
const canonicalFields=new Map(canonical.sections.flatMap(section=>section.fields).map(field=>[field.key,field]));
const policy=require(path.join(serverDir,'dist/lib/verificationV7'));
function stripIntentionalMetadata(schema) {
    const copy=structuredClone(schema);
    for(const section of copy?.sections||[]) for(const field of section.fields||[]) {
        const source=canonicalFields.get(field.key);
        if(!source || source.type!==field.type) continue;
        if(source.datePolicy) delete field.datePolicy;
        if(source.yearPolicy) delete field.yearPolicy;
        if(source.inputPolicy) delete field.inputPolicy;
        if(['amount','area'].includes(source.inputPolicy?.kind)) delete field.step;
        for(const child of field.fields||[]) {
            const original=source.fields?.find(candidate=>candidate.key===child.key && candidate.type===child.type);
            if(original?.inputPolicy) delete child.inputPolicy;
        }
    }
    return copy;
}
function upgrade(schema) {
    const parsed=policy.parseJSON(schema);
    if(parsed?.version!==policy.VERSION || parsed.country!=='ae') throw new Error('Only valid AE V7 schemas may receive input policies.');
    const next=policy.withValidationPolicies(parsed);
    if(JSON.stringify(stripIntentionalMetadata(parsed))!==JSON.stringify(stripIntentionalMetadata(next))) throw new Error('Non-policy schema metadata would change; refusing migration.');
    return next;
}
(async()=>{
 const db=await mysql.createConnection({host,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'tarmeer',charset:'utf8mb4'});
 try {
  await db.beginTransaction();
  try {
   const [catalogue]=await db.execute('SELECT * FROM survey_schema WHERE id = 7 FOR UPDATE');
   if(catalogue.length!==1) throw new Error('V7 schema row 7 is required; this script does not activate V7.');
   const [records]=await db.execute('SELECT * FROM company_interviews WHERE schema_version = ? AND country = ? ORDER BY id FOR UPDATE',[policy.VERSION,'ae']);
   const backupDir=process.env.VERIFICATION_BACKUP_DIR || path.join(serverDir,'backups');
   fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
   const backup=path.join(backupDir,`verification-v7-before-input-policies-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
   fs.writeFileSync(backup,JSON.stringify({created_at:new Date().toISOString(),catalogue,records},null,2),{flag:'wx',mode:0o600});
   console.log(`Backup complete: ${backup} (${records.length} AE V7 records)`);
   const catalogueJSON=JSON.stringify(upgrade(catalogue[0].schema_json));
   const catalogueTimestamp=Object.hasOwn(catalogue[0],'updated_at')?', updated_at = updated_at':'';
   await db.execute(`UPDATE survey_schema SET schema_json = ?${catalogueTimestamp} WHERE id = 7`,[catalogueJSON]);
   for(const row of records) {
    if(!row.schema_snapshot) throw new Error(`Record ${row.id} has no V7 snapshot; refusing to invent a historical schema.`);
    const snapshot=JSON.stringify(upgrade(row.schema_snapshot));
    await db.execute('UPDATE company_interviews SET schema_snapshot = ?, updated_at = updated_at WHERE id = ? AND schema_version = ? AND country = ?',[snapshot,row.id,policy.VERSION,'ae']);
   }
   const [afterCatalogue]=await db.execute('SELECT * FROM survey_schema WHERE id = 7');
   for(const key of Object.keys(catalogue[0])) if(key!=='schema_json' && JSON.stringify(catalogue[0][key])!==JSON.stringify(afterCatalogue[0][key])) throw new Error(`Catalogue column ${key} changed; rolling back.`);
   const [after]=await db.execute('SELECT * FROM company_interviews WHERE schema_version = ? AND country = ? ORDER BY id',[policy.VERSION,'ae']);
   if(after.length!==records.length) throw new Error('Record count changed; rolling back.');
   for(let i=0;i<records.length;i++) for(const key of Object.keys(records[i])) if(key!=='schema_snapshot' && JSON.stringify(records[i][key])!==JSON.stringify(after[i][key])) throw new Error(`Record ${records[i].id} column ${key} changed; rolling back.`);
   await db.commit();
   console.log(`PASS: ${records.length}/${records.length} AE V7 records preserve every answer and timestamp; metadata upgraded only.`);
  } catch(error) {await db.rollback();throw error;}
 } finally {await db.end();}
})().catch(error=>{console.error(error);process.exitCode=1;});
