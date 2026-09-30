#!/usr/bin/env node
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'server/package.json'));
require('dotenv').config({path:path.join(root,'server/.env'),override:true,quiet:true});
if(!['localhost','127.0.0.1'].includes(process.env.DB_HOST)||process.env.DB_NAME!=='tarmeer')throw Error('Local tarmeer DB only');
const pool=require(path.join(root,'server/dist/config/database')).default;
const procurement=require(path.join(root,'server/dist/lib/materialProcurement'));
const admin=require(path.join(root,'server/dist/controllers/supplierAdminController'));
const feed=require(path.join(root,'server/dist/controllers/supplierProductController'));
const review=require(path.join(root,'server/dist/controllers/materialReviewController'));
const macro=require(path.join(root,'server/dist/controllers/materialsMacroController'));
const profile=require(path.join(root,'server/dist/controllers/supplierProfileController'));
const sourcing=require(path.join(root,'server/dist/controllers/sourcingRequestController'));
const invoke=async(fn,req)=>{const res={statusCode:200,status(c){this.statusCode=c;return this},json(data){this.body=data;return this}};await fn({query:{},params:{},country:'ae',admin:{id:null,role:'super_admin',country:'ae'},...req},res);return res};
const marker=`Procurement-${Date.now()}`;const suppliers=[],products=[],requests=[];let count=0;
const check=(label,condition)=>{assert.ok(condition,label);count++;console.log('PASS '+label)};
try {
 for(const country of ['ae','vn']){const [r]=await pool.execute("INSERT INTO supplier_profiles(company_name,slug,origin,status,country,is_published,categories) VALUES (?,?,'china','approved',?,1,'[\"stone\"]')",['HiddenFactory Secret',marker+'-'+country,country]);suppliers.push(r.insertId)}
 for(const [index,country] of ['ae','ae','vn'].entries()){
 const specs=[{label:'Model',value:marker+'-MODEL'},{label:'Material',value:'Stone'},{label:'Availability',value:index===1?'china_order':'uae_stock'},{label:'Lead time',value:'12 days'},{label:'Price basis',value:'20mm slab'},{label:'Finish',value:index===1?'Polished':'Honed 20%_special'}];
 const [r]=await pool.execute('INSERT INTO supplier_products(supplier_profile_id,title,title_translated,category,image_url,specs,price,price_unit,price_currency) VALUES (?,?,?,?,?,?,?,?,?)',[suppliers[country==='vn'?1:0],marker+'原名',marker+' Stone Slab','stone','/uploads/harness-test.webp',JSON.stringify(specs),index===1?50:100,'SQM',index===1?'USD':'AED']);products.push(r.insertId);
 }
 check('AE supplier publication accepts descriptive translated names',await procurement.validateSupplierPublication(pool,suppliers[0])===null);
 await pool.execute('UPDATE supplier_products SET title_translated=NULL WHERE id=?',[products[0]]);
 check('AE supplier publication blocks untranslated Chinese',Boolean(await procurement.validateSupplierPublication(pool,suppliers[0])));
 await pool.execute('UPDATE supplier_products SET title_translated=? WHERE id=?',[marker+' Stone Slab',products[0]]);
 let nameOnlyEdit=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{title:null,title_translated:marker+' Stone Slab'}});
 check('English-only product name saves without mandatory Chinese original',nameOnlyEdit.statusCode===200&&nameOnlyEdit.body.product.title===null&&nameOnlyEdit.body.product.title_translated===marker+' Stone Slab');
 await pool.execute('UPDATE supplier_products SET title=? WHERE id=?',[marker+'原名',products[0]]);
 const rejectEdit=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{title_translated:' '}});
 check('admin cannot bypass AE publication by clearing translated name',rejectEdit.statusCode===400);
 let r=await invoke(feed.listPublicProductsFeed,{query:{q:marker}});check('q filters feed and country',r.statusCode===200&&r.body.products.length===2&&r.body.pagination.total===2);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker+'-MODEL',material:'Stone',availability:'uae_stock',lead_time_max:'12',currency:'AED',unit:'SQM',price_min:'50',price_max:'110',sort:'price_asc'}});check('combined real specs and comparable price filters',r.statusCode===200&&r.body.products.length===1&&r.body.products[0].id===products[0]);
 check('model and basis serialized',r.body.products[0].model===marker+'-MODEL'&&r.body.products[0].price_basis==='20mm slab');
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,category:'stone',spec:'Honed 20%_',material:'Stone',currency:'AED',unit:'SQM',price_min:'50'}});check('category specifications combine with procurement filters and escaped values',r.statusCode===200&&r.body.products.length===1&&r.body.products[0].id===products[0]);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,category:'stone',spec:marker+' Stone Slab'}});check('specification does not match product title',r.statusCode===200&&r.body.pagination.total===0);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,category:'stone',spec:"' OR 1=1 --"}});check('specification SQL injection returns no rows',r.statusCode===200&&r.body.pagination.total===0);
 r=await invoke(feed.listPublicProductsFeed,{query:{spec:'20mm'}});check('specification requires category at endpoint',r.statusCode===400);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,lead_time_max:'11'}});check('lead time excludes beyond range',r.body.pagination.total===0);
 r=await invoke(feed.listPublicProductsFeed,{query:{sort:'price_asc'}});check('mixed price units rejected',r.statusCode===400);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,country:'vn'}});check('VN catalog isolated',r.body.products.length===1&&r.body.products[0].id===products[2]);
 r=await invoke(feed.getPublicProductDetail,{params:{id:String(products[2])}});check('foreign detail inaccessible',r.statusCode===404);
 r=await invoke(feed.listProducts,{params:{slug:marker+'-ae'}});check('supplier product model serialized',r.statusCode===200&&r.body.products[0].model===marker+'-MODEL');
 r=await invoke(profile.getPublicProfile,{params:{slug:marker+'-ae'}});check('supplier profile serializes metadata',r.statusCode===200&&r.body.products[0].model===marker+'-MODEL');
 for (const key of ['license_url','supplier_user_id','created_by_admin_id','weight_score']) check('public profile excludes '+key,!(key in r.body.supplier));
 r=await invoke(profile.listPublicSuppliers,{query:{limit:'100'}});check('public list uses supplier whitelist',r.statusCode===200&&r.body.suppliers.every(s=>!('license_url'in s)&&!('supplier_user_id'in s)&&!('weight_score'in s)));
 r=await invoke(macro.getMaterialSearch,{query:{q:'HiddenFactory',type:'suppliers'}});check('private supplier names cannot be probed through public search',r.statusCode===200&&r.body.results.length===0);
 r=await invoke(macro.getMaterialSearch,{query:{q:'Supplier #'+suppliers[0],type:'suppliers'}});check('public supplier reference remains searchable and redacted',r.statusCode===200&&r.body.results.length===1&&r.body.results[0].id===suppliers[0]&&!r.body.results[0].company_name.includes('HiddenFactory'));
 r=await invoke(macro.getMegaMenu,{});check('featured suppliers expose stable public references',r.statusCode===200&&r.body.macros.flatMap(c=>c.featuredSuppliers).every(s=>Number.isSafeInteger(s.id)&&s.id>0));
 r=await invoke(macro.getMaterialSearch,{query:{q:marker+'-MODEL'}});check('macro search includes model',r.statusCode===200&&r.body.results.length===2&&r.body.results[0].model===marker+'-MODEL');
 r=await invoke(review.listProductReview,{query:{issue:'duplicate',limit:'100'}});check('duplicate queue keeps both products',r.statusCode===200&&products.slice(0,2).every(id=>r.body.products.some(p=>p.id===id))&&!r.body.products.some(p=>p.id===products[2]));
 r=await invoke(review.listProductReview,{query:{country:'vn',issue:'duplicate',limit:'100'},admin:{role:'admin',country:'ae'}});check('ordinary admin cannot switch review country',r.body.products.some(p=>p.id===products[0])&&!r.body.products.some(p=>p.id===products[2]));
 const body={request_type:'quote',name:'Harness',phone:'+971500000000',product_id:products[0],supplier_profile_id:suppliers[0],request_key:marker+'-request',quantity_unknown:true,project_area:140};
 r=await invoke(sourcing.submitSourcingRequest,{body});check('quote written',r.statusCode===201);requests.push(r.body.id);
 r=await invoke(sourcing.submitSourcingRequest,{body});check('DB unique retry idempotent',r.statusCode===200&&r.body.id===requests[0]&&r.body.duplicate);
 r=await invoke(sourcing.adminListSourcingRequests,{query:{type:'quote',limit:'100'}});const saved=r.body.requests.find(v=>v.id===requests[0]);check('admin context retains snapshot and unknown quantity',saved?.request_context?.product_model===marker+'-MODEL'&&saved?.request_context?.quantity_unknown&&saved?.request_context?.project_area===140);
 check('admin hides internal fingerprint/key',saved&&!('request_key'in saved)&&!('fingerprint'in saved.request_context));
 for (const scenario of [
  {label:'single piece', request_type:'quote', quantity:1, quantity_unit:'piece', quantity_unknown:false},
  {label:'area purchase', request_type:'quote', quantity:80, quantity_unit:'m²', quantity_unknown:false},
  {label:'whole project', request_type:'sourcing', project_area:140},
 ]) {
  const payload={request_type:scenario.request_type,name:'Harness',phone:'+971500000000',request_key:marker+'-'+scenario.label.replaceAll(' ','-'),...(scenario.request_type==='quote'?{product_id:products[0],supplier_profile_id:suppliers[0]}:{}),...scenario};
  delete payload.label;
  r=await invoke(sourcing.submitSourcingRequest,{body:payload});check(scenario.label+' inquiry accepted',r.statusCode===201);requests.push(r.body.id);
  const receipt=r.body.id;
  r=await invoke(sourcing.adminListSourcingRequests,{query:{type:scenario.request_type,limit:'100'}});
  const received=r.body.requests.find(row=>row.id===receipt),context=received?.request_context;
  check(scenario.label+' receiver stores procurement context',context?.recipient==='Tarmeer'&&(scenario.request_type==='quote'?received.product_id===products[0]&&received.supplier_profile_id===suppliers[0]&&context.quantity===scenario.quantity&&context.quantity_unit===scenario.quantity_unit&&context.project_area===null:context.project_area===140&&received.product_id===null));
 }
 const foreignBody={...body,product_id:products[2],supplier_profile_id:suppliers[1],request_key:marker+'-foreign'};
 r=await invoke(sourcing.submitSourcingRequest,{body:foreignBody});requests.push(r.body.id);check('foreign quote fixture created',r.statusCode===201);
 const foreignId=r.body.id;
 r=await invoke(sourcing.adminListSourcingRequests,{query:{country:'vn',type:'quote',limit:'100'},admin:{role:'admin',country:'ae'}});check('forged country cannot read foreign inquiry',r.statusCode===200&&!r.body.requests.some(v=>v.id===foreignId)&&r.body.requests.some(v=>v.id===requests[0]));
 r=await invoke(sourcing.adminUpdateSourcingRequestStatus,{params:{id:String(foreignId)},query:{country:'vn'},body:{status:'completed'},admin:{role:'admin',country:'ae'}});check('forged country cannot update foreign inquiry',r.statusCode===404);
 const [foreignRows]=await pool.execute('SELECT status FROM sourcing_requests WHERE id=?',[foreignId]);check('foreign inquiry remains unchanged',foreignRows[0].status==='new');
 r=await invoke(sourcing.adminUpdateSourcingRequestStatus,{params:{id:String(requests[0])},query:{country:'vn'},body:{status:'contacted'},admin:{role:'admin',country:'ae'}});check('own inquiry update uses authenticated admin country',r.statusCode===200);
 r=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{price:120,price_currency:null}});check('admin numeric price cannot clear currency',r.statusCode===400);
 r=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{price:120,price_unit:' '}});check('admin numeric price cannot clear unit',r.statusCode===400);
 r=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{price:120}});check('price-only update preserves known currency and unit',r.statusCode===200&&r.body.product.price_currency==='AED'&&r.body.product.price_unit==='SQM'&&r.body.product.title_translated===marker+' Stone Slab');
 await pool.execute('UPDATE supplier_products SET price_currency=NULL WHERE id=?',[products[0]]);
 r=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{price:130}});check('legacy unknown currency must be selected for price edit',r.statusCode===400);
 r=await invoke(admin.adminUpdateProduct,{params:{id:String(suppliers[0]),productId:String(products[0])},body:{description:'Metadata edit'}});check('metadata-only edit tolerates legacy missing currency',r.statusCode===200);
 await pool.execute("UPDATE supplier_products SET price=150,price_unit='元/㎡',price_currency='CNY' WHERE id=?",[products[0]]);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,currency:'CNY',unit:'SQM',price_min:'140',price_max:'160',sort:'price_asc'}});check('legacy yuan per square metre participates in canonical comparable filters',r.statusCode===200&&r.body.products.length===1&&r.body.products[0].id===products[0]);
 await pool.execute("UPDATE supplier_products SET price_unit='M' WHERE id=?",[products[0]]);
 r=await invoke(feed.listPublicProductsFeed,{query:{q:marker,currency:'CNY',unit:'M',sort:'price_asc'}});check('metre prices remain individually filterable',r.statusCode===200&&r.body.products.length===1&&r.body.products[0].id===products[0]);
 r=await invoke(macro.getMacroProducts,{params:{key:'stone'}});check('category product cards retain supplier references',r.statusCode===200&&r.body.products.length>0&&r.body.products.every(p=>Number.isSafeInteger(p.supplier_id)&&p.supplier_id>0));
 const {getPageMeta,injectMeta}=require(path.join(root,'server/dist/lib/seoMetaInjector'));
 const ownMeta=await getPageMeta('/materials/suppliers/'+(marker+'-ae').toLowerCase(),'ae');check('supplier fallback SEO uses public reference without certification claims',ownMeta?.title.includes('Tarmeer sourcing partner #'+suppliers[0])&&!/verified|vetted/i.test(ownMeta.description));
 check('supplier fallback SEO rejects a foreign-country slug',await getPageMeta('/materials/suppliers/'+(marker+'-ae').toLowerCase(),'vn')===null);
 const hostileHtml=injectMeta('<html><head></head><body></body></html>',{title:'Test',description:'Test',canonical:'https://www.tarmeer.com/materials',ogImage:'',jsonLd:{name:'</script><script>alert(1)</script>'}});check('fallback JSON-LD cannot close its script element',!hostileHtml.includes('<script>alert(1)'));
 console.log(`${count}/${count} PASS`);
}finally{
 for(const id of requests)await pool.execute('DELETE FROM sourcing_requests WHERE id=?',[id]);
 for(const id of products)await pool.execute('DELETE FROM supplier_products WHERE id=?',[id]);
 for(const id of suppliers){await pool.execute("DELETE FROM activity_log WHERE target_type='supplier' AND target_id=?",[id]);await pool.execute('DELETE FROM supplier_profiles WHERE id=?',[id]);}
 await pool.end();
}
