// Run on the production host only; preserves original descriptions, images and prices.
const {createRequire}=require('node:module');
const fs=require('node:fs');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const root='/tarmeer/tarmeer_api';
if(!fs.existsSync(root+'/.env'))throw Error('Run through SSH on the production host.');
const r=createRequire(root+'/package.json');r('dotenv').config({path:root+'/.env',quiet:true});
const batch=JSON.parse(fs.readFileSync(process.env.CONTENT_BATCH||'/tmp/material-descriptions-20260930.json','utf8'));
const hash=s=>crypto.createHash('sha256').update(s||'').digest('hex');
(async()=>{
 const c=await r('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 try{
  await c.beginTransaction();const pending=[];
  assert.equal(new Set(batch.map(x=>x.id)).size,batch.length);
  for(const item of batch){
   assert(item.country==='ae'&&typeof item.after==='string'&&item.after.trim()&&!/[<>\u3400-\u9fff]/.test(item.after));
   const [rows]=await c.execute(`SELECT p.id,p.supplier_profile_id,p.description,p.description_translated,p.title,p.title_translated,p.image_url,p.image_urls,p.price,p.price_max,p.price_currency,p.price_unit,sp.country FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE p.id=? FOR UPDATE`,[item.id]);
   const row=rows[0];assert(row&&row.supplier_profile_id===item.supplier_id&&row.country===item.country,'Product ownership changed');
   assert.equal(hash(row.description),item.before_description_sha256,'Original description changed');
   if(row.description_translated===item.after)continue;
   assert.equal(row.description_translated,item.before_translated,'Concurrent translation change');
   pending.push({item,row});
  }
  if(!process.argv.includes('--apply')){await c.rollback();console.log(JSON.stringify({checked:batch.length,pending:pending.length}));return;}
  const backup='/tmp/material-descriptions-before-'+Date.now()+'.json';
  fs.writeFileSync(backup,JSON.stringify(pending.map(x=>x.row),null,2),{mode:0o600});
  for(const {item} of pending){
   const [result]=await c.execute('UPDATE supplier_products SET description_translated=? WHERE id=? AND supplier_profile_id=?',[item.after,item.id,item.supplier_id]);assert.equal(result.affectedRows,1);
   const [rows]=await c.execute('SELECT description,description_translated FROM supplier_products WHERE id=?',[item.id]);assert.equal(hash(rows[0].description),item.before_description_sha256);assert.equal(rows[0].description_translated,item.after);
  }
  await c.commit();console.log(JSON.stringify({updated:pending.length,backup}));
 }catch(e){await c.rollback();throw e;}finally{await c.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
