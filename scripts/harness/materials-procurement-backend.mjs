#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const helper=require('../../server/dist/lib/materialProcurement');
let passed=0;
const check=(label,fn)=>{fn();passed++;console.log(`PASS ${label}`)};
check('specs expose only explicit stock',()=>assert.equal(helper.metadata({specs:[{label:'Material',value:'Stone'}]}).availability,null));
check('model and days extracted',()=>assert.deepEqual([helper.metadata({specs:[{label:'型号',value:'SKU-4'},{label:'Lead time',value:'20 days'}]}).model,helper.metadata({specs:[{label:'Lead time',value:'20 days'}]}).lead_time_days],['SKU-4',20]));
check('ambiguous lead time remains unknown',()=>assert.equal(helper.metadata({specs:[{label:'Lead time',value:'20–30 days'}]}).lead_time_days,null));
check('price sort needs same currency and unit',()=>assert.ok(helper.feedFilters({sort:'price_asc',currency:'AED'}).error));
check('safe price sort',()=>assert.equal(helper.feedFilters({sort:'price_desc',currency:'AED',unit:'SQM'}).order,'p.price DESC, p.id DESC'));
check('SQL injection values stay parameters',()=>{const f=helper.feedFilters({q:"x' OR 1=1 --"});assert.equal(f.params.length,4);assert.ok(!f.clauses.join().includes("x'"))});
check('LIKE wildcards escaped',()=>assert.equal(helper.feedFilters({q:'a%b_'}).params[0],'%a\\%b\\_%'));
check('specification needs category',()=>assert.ok(helper.feedFilters({spec:'20mm'}).error));
check('specification length is bounded',()=>assert.ok(helper.feedFilters({category:'stone',spec:'x'.repeat(121)}).error));
check('specification search reads only JSON value',()=>{const f=helper.feedFilters({category:'stone',spec:'20mm'});assert.ok(f.clauses.join().includes("PATH '$.value'"));assert.ok(!f.clauses.join().includes('p.title'));});
check('specification SQL special characters are escaped parameters',()=>{const f=helper.feedFilters({category:'stone',spec:"a%_\\' OR 1=1 --"});assert.equal(f.params[0],"%a\\%\\_\\\\' OR 1=1 --%");assert.ok(!f.clauses.join().includes('OR 1=1'));});
check('all filters reject invalid quantities',()=>assert.ok(helper.feedFilters({lead_time_max:'NaN'}).error));
check('no invented stock from China origin',()=>assert.ok(!helper.feedFilters({origin:'china'}).clauses.join().includes('availability')));
check('translation and incomplete flags',()=>assert.deepEqual(helper.qualityFlags({title:'材料'}),['translation','incomplete']));
const fakeDb={execute:async()=>[[{value:'stone'}]]};
assert.ok(await helper.validateProduct(fakeDb,{title:'Material',category:'stone',image_url:'/uploads/test.webp'}));passed++;
assert.equal(await helper.validateProduct(fakeDb,{title:'Stone slab',category:'stone',image_url:'/uploads/test.webp'}),null);passed++;
assert.equal(await helper.validateProduct(fakeDb,{price:5},{partial:true}),null);passed++;
assert.ok(await helper.validateProduct(fakeDb,{image_url:'javascript:alert(1)'},{partial:true}));passed++;
const validProduct={title:'Stone slab',category:'stone',image_url:'/uploads/test.webp'};
for (const [label,body,options,rejected] of [
 ['AE English name alone accepted',{...validProduct,title:null,title_translated:'Stone feature wall panel'},{country:'ae'},false],
 ['AE both names absent rejected',{...validProduct,title:null,title_translated:null},{country:'ae'},true],
 ['AE model-only English without original rejected',{...validProduct,title:null,title_translated:'QS-XT-001'},{country:'ae'},true],
 ['VN still needs local original name',{...validProduct,title:null,title_translated:'Stone feature wall panel'},{country:'vn'},true],
 ['AE Chinese name needs translation',{...validProduct,title:'石材背景墙'},{country:'ae'},true],
 ['AE translated Chinese name accepted',{...validProduct,title:'石材背景墙',title_translated:'Stone feature wall panel'},{country:'ae'},false],
 ['AE bare SKU rejected',{...validProduct,title:'QS-XT-001'},{country:'ae'},true],
 ['AE spaced SKU rejected',{...validProduct,title:'QS XT 001'},{country:'ae'},true],
 ['AE translated bare SKU rejected',{...validProduct,title:'石材',title_translated:'SE-570#35'},{country:'ae'},true],
 ['AE descriptive type with SKU accepted',{...validProduct,title:'Stone moulding QS-XT-001'},{country:'ae'},false],
 ['AE blank translation cannot bypass Chinese gate',{...validProduct,title:'石材',title_translated:'   '},{country:'ae'},true],
 ['AE blank translation cannot bypass default name',{...validProduct,title:'Material',title_translated:''},{country:'ae'},true],
 ['VN is not subject to English gate',{...validProduct,title:'Đá ốp tường'},{country:'vn'},false],
 ['price-only edit preserves legacy title',{price:200},{country:'ae',partial:true,existing:{title:'石材'}},false],
 ['clearing translation on Chinese original rejected',{title_translated:''},{country:'ae',partial:true,existing:{title:'石材',title_translated:'Stone slab'}},true],
 ['partial translation uses original name',{title_translated:'Stone slab'},{country:'ae',partial:true,existing:{title:'石材'}},false],
]) { const result=await helper.validateProduct(fakeDb,body,options);check(label,()=>assert.equal(Boolean(result),rejected)); }
check('numeric price requires explicit currency',()=>assert.ok(helper.validatePriceContext({price:120,price_unit:'SQM'})));
check('numeric price requires explicit unit',()=>assert.ok(helper.validatePriceContext({price:120,price_currency:'AED'})));
check('valid price context accepted',()=>assert.equal(helper.validatePriceContext({price:120,price_currency:'AED',price_unit:'SQM'}),null));
check('quote without numeric price does not invent currency',()=>assert.equal(helper.validatePriceContext({price:null}),null));
for(const url of ['/uploads/','/images/','https://','https://evil.test/not-an-image.txt','https://user:password@cdn.test/photo.jpg','/uploads/placeholder.webp']) check(`invalid image URL ${url}`,()=>assert.equal(helper.validImageUrl(url),false));
check('signed CDN image accepted',()=>assert.equal(helper.validImageUrl('https://cdn.test/folder/image.avif?signature=xyz'),true));
check('invalid main image reaches review queue',()=>assert.ok(helper.qualityFlags({title:'Stone slab',category:'stone',image_url:'/uploads/',price:10,price_unit:'SQM',price_currency:'AED'}).includes('incomplete')));
const {supplierImagePathIsOwned}=require('../../server/dist/lib/supplierImageOwnership');
const publicRoot=await fs.mkdtemp(path.join(os.tmpdir(),'materials-owned-'));
try {
 for(const relative of ['uploads/suppliers/owner/photo.webp','uploads/suppliers/other/photo.webp','uploads/suppliers/products/12-12345678-1234-1234-1234-123456789abc.webp']) {await fs.mkdir(path.dirname(path.join(publicRoot,relative)),{recursive:true});await fs.writeFile(path.join(publicRoot,relative),'fixture');}
 assert.equal(await supplierImagePathIsOwned({id:1,slug:'owner'},'/uploads/suppliers/owner/photo.webp',null,12,publicRoot),true);passed++;
 assert.equal(await supplierImagePathIsOwned({id:1,slug:'owner'},'/uploads/suppliers/other/photo.webp',null,12,publicRoot),false);passed++;
 assert.equal(await supplierImagePathIsOwned({id:1,slug:'owner'},'/uploads/suppliers/products/12-12345678-1234-1234-1234-123456789abc.webp',null,12,publicRoot),true);passed++;
 assert.equal(await supplierImagePathIsOwned({id:1,slug:'owner'},'/uploads/suppliers/products/12-12345678-1234-1234-1234-123456789abc.webp',null,13,publicRoot),false);passed++;
 assert.equal(await supplierImagePathIsOwned({id:1,slug:'owner'},'/uploads/suppliers/owner/missing.webp',null,12,publicRoot),false);passed++;
} finally {await fs.rm(publicRoot,{recursive:true,force:true});}
const {ensureSourcingRequestSchema}=require('../../server/dist/lib/sourcingRequestSchema');
let enumType="enum('sample','legacy_custom')";const ddl=[];
const schemaDb={escape:value=>"'"+value+"'",query:async sql=>{
 ddl.push(sql);if(sql.startsWith('SHOW COLUMNS'))return [[{Field:'request_type',Type:enumType,Null:'YES',Default:'legacy_custom'},{Field:'request_context',Type:'json'},{Field:'request_key',Type:'varchar(64)'}]];
 if(sql.startsWith('SHOW INDEX'))return [[{Key_name:'uq_sourcing_request_key',Non_unique:0,Column_name:'request_key',Sub_part:null}]];
 if(sql.startsWith('ALTER TABLE sourcing_requests MODIFY request_type'))enumType="enum('sample','legacy_custom','quote')";
 return [[]];
}};
await ensureSourcingRequestSchema(schemaDb);check('schema migration preserves legacy enum default and nullability',()=>assert.ok(ddl.some(sql=>sql.includes("enum('sample','legacy_custom','quote') NULL DEFAULT 'legacy_custom'"))));
await assert.rejects(()=>ensureSourcingRequestSchema({query:async()=>{throw Error('DDL denied')}}),/DDL denied/);passed++;
const {startProductionServer}=require('../../server/dist/lib/startServer');
let listened=false,cleaned=false;
await assert.rejects(()=>startProductionServer({runAutoMigrate:async options=>{assert.equal(options.strict,true);await ensureSourcingRequestSchema({query:async()=>{throw Error('required schema denied')}})},listen:()=>{listened=true},cleanup:()=>{cleaned=true}}),/required schema denied/);
check('required schema failure prevents listening and cleans up',()=>{assert.equal(listened,false);assert.equal(cleaned,true)});
// Controller tests stub the pool, with no database/network writes.
const databasePath=require.resolve('../../server/dist/config/database');
const calls=[];let inserted=null;
const pool={execute:async(sql,args)=>{
 calls.push({sql,args});
 if(sql.startsWith('SELECT p.id')) return [[{id:4,title:'Chinese title',title_translated:'Stone slab',specs:[{label:'Model',value:'X-4'}],supplier_profile_id:8,country:'vn',company_name:'Factory Secret',name_zh:''}]];
 if(sql.startsWith('SELECT id, country'))return [[{id:args[0],country:'ae'}]];
 if(sql.startsWith('INSERT')){if(inserted){const e=new Error('duplicate');e.code='ER_DUP_ENTRY';throw e;}inserted={id:99,request_context:args[12]};return [{insertId:99}]};
 if(sql.startsWith('SELECT id, request_context'))return [[inserted]];
 throw Error(sql);
}};
require.cache[databasePath]={id:databasePath,filename:databasePath,loaded:true,exports:{__esModule:true,default:pool}};
const {submitSourcingRequest}=require('../../server/dist/controllers/sourcingRequestController');
const invoke=async body=>{const response={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};await submitSourcingRequest({body,country:'ae'},response);return response};
const base={request_type:'sourcing',name:'Test',phone:'+971500000000',product_id:4,supplier_profile_id:8,request_key:'test-request-123456',quantity:20,quantity_unit:'SQM'};
for (const [label,body] of [
 ['null body',null],['array body',[]],['primitive body','invalid'],
 ['object name',{...base,name:{text:'Buyer'}}],['array phone',{...base,phone:['+971500000000']}],
 ...['email','company_name','city','message','preferred_date','quantity_unit','source_page'].map(field=>[`object ${field}`,{...base,[field]:{value:'bad'}}]),
 ['string quantity_unknown',{...base,quantity_unknown:'true'}],['null quantity_unknown',{...base,quantity_unknown:null}],
 ['boolean product id',{...base,product_id:true}],['boolean supplier id',{...base,supplier_profile_id:true}],
 ['unsafe product id',{...base,product_id:Number.MAX_SAFE_INTEGER+1}],
 ['quote without product',{...base,request_type:'quote',product_id:null,quantity_unknown:true}],
 ]) { const rejected=await invoke(body);check(`${label} rejected`,()=>assert.equal(rejected.statusCode,400)); }
let response=await invoke({...base,request_type:'quote',quantity:null,quantity_unit:null});check('quote must provide quantity or mark unknown',()=>assert.equal(response.statusCode,400));
response=await invoke({...base,request_type:'sample',quantity:null,quantity_unit:null});check('sample must provide quantity or mark unknown',()=>assert.equal(response.statusCode,400));
response=await invoke({...base,supplier_profile_id:9});check('mismatched product supplier rejected',()=>assert.equal(response.statusCode,400));
response=await invoke({...base,quantity:-1});check('negative quantity rejected',()=>assert.equal(response.statusCode,400));
response=await invoke(base);check('request accepted',()=>assert.equal(response.statusCode,201));
check('server snapshot and reference country',()=>{const args=calls.find(c=>c.sql.startsWith('INSERT')).args;assert.equal(args[11],'vn');const context=JSON.parse(args[12]);assert.equal(context.product_title,'Stone slab');assert.equal(context.product_model,'X-4');assert.equal(context.recipient,'Tarmeer')});
response=await invoke(base);check('identical retry returns same receipt',()=>assert.deepEqual(response.body,{id:99,duplicate:true}));
response=await invoke({...base,quantity:30});check('different payload cannot reuse request key',()=>assert.equal(response.statusCode,409));
const {redactPublicSupplier}=require('../../server/dist/lib/supplierRedact');
check('public supplier whitelist excludes uploaded licenses and all account/internal fields',()=>{
 const source={id:8,slug:'partner-8',origin:'china',country:'ae',categories:['stone'],company_name:'Secret Factory',description:'Secret Factory stone',cover_image_url:'/cover.webp',product_count:2,license_url:'/private-license.pdf',supplier_user_id:6,created_by_admin_id:3,weight_score:99,new_private_field:'never expose'};
 const publicRow=redactPublicSupplier(source);
 for(const key of ['license_url','supplier_user_id','created_by_admin_id','weight_score','new_private_field'])assert.ok(!(key in publicRow));
 assert.equal(publicRow.id,8);assert.equal(publicRow.product_count,2);assert.equal(publicRow.cover_image_url,'/cover.webp');assert.equal(publicRow.description,'our supplier stone');
});
const {listProductReview}=require('../../server/dist/controllers/materialReviewController');
for(const [admin,query] of [[{role:'admin',country:'sa'},{country:'vn'}],[{role:'super_admin',country:'ae'},{country:'sa'}]]) {
 const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
 await listProductReview({admin,query},res);
 check('review SA access honors authenticated role '+admin.role,()=>{assert.equal(res.statusCode,200);assert.deepEqual(calls.at(-1).args,['sa']);});
}
console.log(`${passed}/${passed} PASS`);
