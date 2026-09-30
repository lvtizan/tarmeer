#!/usr/bin/env node
/* Run production writes ONLY via SSH with APP_ROOT=/tarmeer/tarmeer_api.
 * Default is a read-only preflight. --apply creates a full backup and updates in one transaction.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const appRoot = process.env.APP_ROOT || path.resolve(__dirname, '../../server');
require(path.join(appRoot, 'node_modules/dotenv')).config({path:path.join(appRoot,'.env'), quiet:true});
const mysql = require(path.join(appRoot,'node_modules/mysql2/promise'));
const records = JSON.parse(fs.readFileSync(process.env.CONTENT_BATCH || path.join(__dirname,'data/materials-content-20260930.json'),'utf8'));
const apply = process.argv.includes('--apply');
if (apply && appRoot !== '/tarmeer/tarmeer_api') throw new Error('Production content writes must run on the server with APP_ROOT=/tarmeer/tarmeer_api.');
const normalize = (key,value) => key==='specs' && typeof value==='string' ? JSON.parse(value) : value;
(async()=>{
 const db=await mysql.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:'utf8mb4'});
 try {
  await db.beginTransaction();
  const fields=['title_translated','description_translated','category','specs'];
  for(const record of records) {
   assert.deepEqual(Object.keys(record.after).sort(), [...fields].sort(), 'Only reviewed content fields may change');
   assert.deepEqual(Object.keys(record.before).sort(), [...fields].sort(), 'Every updated field requires a concurrent-change guard');
   assert.ok(Number.isSafeInteger(record.id) && record.id > 0);
   assert.equal(record.country,'ae');
  }
  const categories=[...new Set(records.map(r=>r.after.category))];
  const [enabled]=await db.execute(`SELECT value FROM product_categories WHERE is_enabled=1 AND value IN (${categories.map(()=>'?').join(',')}) FOR SHARE`,categories);
  assert.deepEqual(enabled.map(c=>c.value).sort(), [...categories].sort(), 'All target categories must still be enabled on this server');
  const ids=records.map(r=>r.id);
  assert.equal(new Set(ids).size,194);
  const [rows]=await db.execute(`SELECT p.*,sp.country,sp.slug FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE p.id IN (${ids.map(()=>'?').join(',')}) FOR UPDATE`,ids);
  assert.equal(rows.length,records.length,'Exact first batch must exist');
  let pending=0;
  for(const record of records){
   const row=rows.find(p=>p.id===record.id);
   assert.equal(row.supplier_profile_id,record.supplier_id); assert.equal(row.country,record.country); assert.equal(row.slug,record.slug); assert.equal(row.title,record.original_title);
   const actual=Object.fromEntries(Object.keys(record.before).map(key=>[key,normalize(key,row[key])]));
   if(isDeepStrictEqual(actual,record.after))continue;
   assert.deepEqual(actual,record.before,`Concurrent change to product ${record.id}; stop without overwriting`); pending++;
  }
  if(!apply){await db.rollback();console.log(JSON.stringify({preflight:'PASS',records:records.length,pending}));return;}
  const backup=`/tmp/materials-content-before-${Date.now()}.json`;
  fs.writeFileSync(backup,JSON.stringify(rows,null,2),{mode:0o600,flag:'wx'});
  for(const record of records){
   await db.execute('UPDATE supplier_products SET title_translated=?,description_translated=?,category=?,specs=? WHERE id=? AND supplier_profile_id=?',[record.after.title_translated,record.after.description_translated,record.after.category,JSON.stringify(record.after.specs),record.id,record.supplier_id]);
  }
  const [after]=await db.execute(`SELECT p.*,sp.country,sp.slug FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE p.id IN (${ids.map(()=>'?').join(',')})`,ids);
  for(const row of after){
   const record=records.find(r=>r.id===row.id),before=rows.find(p=>p.id===row.id);
   for(const [key,value] of Object.entries(record.after))assert.deepEqual(normalize(key,row[key]),value,`Product ${row.id} ${key}`);
   for(const key of Object.keys(before))if(!(key in record.after)&&key!=='updated_at')assert.deepEqual(row[key],before[key],`Protected field ${row.id}.${key}`);
  }
  await db.commit(); console.log(JSON.stringify({status:'PASS',updated:after.length,backup}));
 }catch(error){await db.rollback();throw error;}finally{await db.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
