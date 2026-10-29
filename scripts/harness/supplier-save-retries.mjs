import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../server/dist/app.js',import.meta.url));
require('dotenv').config({path:'server/.env',quiet:true});
assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST));
const pool=require('mysql2/promise').createPool({host:process.env.DB_HOST,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',connectionLimit:5});
const {withCatalogChunkLock}=require('./lib/catalogChunkLock');
const source=readFileSync('server/dist/controllers/supplierAdminController.js','utf8');
const routes=readFileSync('server/dist/routes/admin.js','utf8');
const products=[];let inserts=0;
const db={execute:async(sql,args)=>{
 if(sql.startsWith('SELECT id, slug'))return [[{id:1,slug:'one',country:'ae'}]];
 if(sql.includes('WHERE supplier_profile_id = ? AND image_url = ?'))return [products.filter(p=>p.supplier_profile_id===Number(args[0])&&p.image_url===args[1])];
 if(sql.startsWith('INSERT INTO supplier_products')){await new Promise(r=>setTimeout(r,15));const id=++inserts;products.push({id,supplier_profile_id:Number(args[0]),image_url:args[4]});return [{insertId:id}];}
 if(sql.startsWith('SELECT * FROM supplier_products WHERE id'))return [products.filter(p=>p.id===args[0])];
 if(sql.startsWith('UPDATE supplier_profiles'))return [{}];
 throw Error(sql);
}};
const script=source.slice(source.indexOf('async function adminAddProduct('),source.indexOf('async function adminDeleteProduct('));
const handler=vm.runInNewContext(script+';adminAddProduct',{database_1:{default:db},supplierImagePathIsOwned:async()=>true,productPriceRange_1:{parseProductPrice:()=>({kind:'valid',value:1}),validateProductPriceRange:()=>null},SUPPORTED_PRICE_CURRENCIES:['AED'],logSupplierAction:async()=>{},console,require:()=>({validateProduct:async()=>null,validatePriceContext:()=>null})});
const hit=async()=>{let payload;await withCatalogChunkLock(pool,1,()=>handler({params:{id:'1'},body:{from_draft:true,image_url:'/uploads/owned.webp',price_currency:'AED'}},{status(){return this;},json(data){payload=data;}}),'admin-product');return payload;};
try {
 const first=await hit(); // Simulate successful POST followed by failed draft acknowledgement.
 const retry=await hit();assert.equal(first.product.id,retry.product.id);assert.equal(inserts,1);
 const simultaneous=await Promise.all([hit(),hit()]);assert.equal(simultaneous[0].product.id,simultaneous[1].product.id);assert.equal(inserts,1);
 let active=0,max=0;
 await Promise.all([1,2].map(()=>withCatalogChunkLock(pool,2,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,20));active--;},'admin-catalog')));
 assert.equal(max,1);
 assert.match(routes,/withCatalogChunkLock\(require\('\.\.\/lib\/supplierWriteLockPool'\)/);
 assert.match(routes,/supplierWriteLock\('admin-product', supplierAdminController_1.adminAddProduct\)/);
 assert.match(routes,/supplierWriteLock\('admin-catalog', supplierAdminController_1.adminAddCatalog\)/);
 assert.match(readFileSync('server/dist/lib/adminCatalogChunks.js','utf8'),/},'admin-catalog'\)/);
 console.log('supplier-save-retries: 9/9 PASS');
}finally{await pool.end();}
