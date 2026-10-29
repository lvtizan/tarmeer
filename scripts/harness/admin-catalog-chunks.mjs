import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdtempSync,rmSync} from 'node:fs';import path from 'node:path';import os from 'node:os';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'server/dist/app.js'));require('dotenv').config({path:path.join(root,'server/.env'),quiet:true});assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST));
const db=await require('mysql2/promise').createPool({host:process.env.DB_HOST,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',connectionLimit:4});const name=`catalog_chunk_test_${process.pid}`;const temp=mkdtempSync(path.join(os.tmpdir(),'catalog-chunk-'));const old=process.cwd();let server,count=0,created=0;
const check=(a,b)=>{assert.deepEqual(a,b);count++;};
try{
 await db.query(`CREATE DATABASE ${name}`);
 // Every named-lock connection uses qualified table names through this wrapper.
 await db.query(`CREATE TABLE ${name}.supplier_catalogs (id INT AUTO_INCREMENT PRIMARY KEY,supplier_profile_id INT,title VARCHAR(255),file_url VARCHAR(255),file_size INT,render_status VARCHAR(20),catalog_visible INT)`);
 const pool={getConnection:()=>db.getConnection(),execute:(sql,args)=>db.execute(sql.replace(/\bsupplier_catalogs\b/g,`${name}.supplier_catalogs`),args)};
 process.chdir(temp);const handler=require(path.join(root,'server/dist/lib/adminCatalogChunks')).createAdminCatalogChunkHandler(pool,async(req,res)=>{
  created++;const[result]=await pool.execute('INSERT INTO supplier_catalogs(supplier_profile_id,title,file_url,file_size,render_status,catalog_visible) VALUES (?,?,?,?,?,?)',[Number(req.params.id),req.body.title,'private://catalogs/test.pdf',req.file.size,'pending',0]);
  res.status(201).json({catalog:{id:result.insertId,title:req.body.title,file_size:req.file.size}});
 });
 const express=require('express'),multer=require('multer');const app=express();app.post('/suppliers/:id/catalog-chunks',(req,res,next)=>{req.admin={id:Number(req.headers['x-admin']||1)};next();},multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024}}).single('file'),handler);
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const hit=async(index,total,upload_id='1234567890abcdef',content=index===0?'%PDF-1.4 test':'last part',supplier=1)=>{const fd=new FormData();fd.append('file',new Blob([content]),'catalog.pdf');for(const[k,v]of Object.entries({chunk_index:index,total_chunks:total,upload_id,original_name:'catalog.pdf',title:'Catalog'}))fd.append(k,String(v));const r=await fetch(base+`/suppliers/${supplier}/catalog-chunks`,{method:'POST',body:fd});return{status:r.status,data:await r.json()};};
 check((await hit(0,2)).data,{done:false});const completed=await hit(1,2);check(completed.status,201);check(completed.data.catalog.file_size,Buffer.byteLength('%PDF-1.4 testlast part'));check(created,1);
 const retry=await hit(1,2);check(retry.status,200);check(retry.data.catalog.id,completed.data.catalog.id);check(created,1);
 const restart=await hit(0,2);check(restart.data.catalog.id,completed.data.catalog.id);check(created,1);
 check((await hit(0,1,'../../escape')).status,400);check((await hit(0,31)).status,400);
 check((await hit(0,1,'abcdefabcdefabcd','not a PDF')).status,400);check(created,1);
 check((await hit(0,2,'1111111111111111')).status,200);check((await hit(1,3,'1111111111111111')).status,409);
 // A different supplier cannot receive a previously completed supplier's receipt.
 const other=await hit(0,2,'1234567890abcdef',undefined,2);check(other.data,{done:false});
 console.log(`admin-catalog-chunks: ${count}/${count} PASS`);
}finally{process.chdir(old);await new Promise(r=>server?server.close(r):r());await db.query(`DROP DATABASE IF EXISTS ${name}`);await db.end();rmSync(temp,{recursive:true,force:true});}
