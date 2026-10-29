#!/usr/bin/env node
'use strict';
// Publishes the two-stage contractor application workflow only. Historical/draft record snapshots are immutable here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const template=require('./contractor-two-stage-template.json');
const apiDir=process.env.TARMEER_API_DIR||path.resolve(__dirname,'../../server');
require(path.join(apiDir,'node_modules/dotenv')).config({path:path.join(apiDir,'.env'),quiet:true});
const host=process.env.DB_HOST;
if(!host||(!['localhost','127.0.0.1','::1'].includes(host)&&(!process.argv.includes('--production-server')||fs.realpathSync(apiDir)!=='/tarmeer/tarmeer_api')))throw Error('Use local MySQL, or SSH with the production API .env.');
const mysql=require(path.join(apiDir,'node_modules/mysql2/promise'));
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
(async()=>{const db=await mysql.createConnection({host,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'tarmeer',charset:'utf8mb4'});
 try{await db.beginTransaction();const [schemas]=await db.execute('SELECT * FROM survey_schema ORDER BY id FOR UPDATE');const row=schemas.find(row=>Number(row.id)===7);if(!row)throw Error('Active AE template is missing.');
 const old=typeof row.schema_json==='string'?JSON.parse(row.schema_json):row.schema_json;if(old.version!==template.version||old.country!=='ae')throw Error('Unexpected existing schema.');
 const [existingColumns]=await db.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='company_interviews'");
 const present=new Set(existingColumns.map(column=>column.COLUMN_NAME));
 const missing=[['contractor_stage',"VARCHAR(20) NOT NULL DEFAULT 'legacy'"],['contractor_review_status','VARCHAR(20) NULL'],['contractor_reviewed_at','DATETIME NULL'],['contractor_reviewed_by','INT NULL'],['contractor_qualification_snapshot','JSON NULL']].filter(([name])=>!present.has(name));
 const hash=digest(row.schema_json),same=JSON.stringify(old)===JSON.stringify(template);console.log(JSON.stringify({currentSha256:hash,alreadyPublished:same,missingColumns:missing.map(([name])=>name),sections:template.sections.length,fields:template.sections.flatMap(section=>section.fields).length}));
 if(!process.argv.includes('--apply')||(same&&!missing.length)){await db.rollback();return;}
 const expected=process.argv.find(arg=>arg.startsWith('--expected-sha256='))?.split('=')[1];if(expected!==hash)throw Error('Two-stage template changed since inspection. Inspect again before publishing.');
 const dir=process.env.VERIFICATION_BACKUP_DIR||path.join(apiDir,'backups');fs.mkdirSync(dir,{recursive:true,mode:0o700});const backup=path.join(dir,`contractor-two-stage-schema-${crypto.randomUUID()}.json`);fs.writeFileSync(backup,JSON.stringify({created_at:new Date().toISOString(),schemas,company_interviews_columns:existingColumns},null,2),{flag:'wx',mode:0o600});if(!fs.statSync(backup).size)throw Error('Backup empty.');
 for(const [name,type] of missing)await db.execute(`ALTER TABLE company_interviews ADD COLUMN \`${name}\` ${type}`);
 if(!same)await db.execute('UPDATE survey_schema SET schema_json = ? WHERE id = 7',[JSON.stringify(template)]);const [after]=await db.execute('SELECT schema_json FROM survey_schema WHERE id=7');if(digest(after[0].schema_json)!==digest(JSON.stringify(template)))throw Error('Template verification failed.');await db.commit();console.log(JSON.stringify({published:true,backup,addedColumns:missing.map(([name])=>name),historicalRecordsModified:0}));
 }catch(error){await db.rollback();throw error;}finally{await db.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
