import assert from 'node:assert/strict';
import {test} from 'node:test';
import {materialEventBody} from './materialsAnalytics.ts';
test('procurement analytics use only enumerated IDs, exclude URL queries and contact data',()=>{
 const body=materialEventBody('materials_inquiry_success','ae','session-fixture',490,true);
 assert.deepEqual(body,{eventName:'materials_inquiry_success',referrer:'',pagePath:'/materials/products/490',payload:{country:'ae',session_id:'session-fixture',product_id:490,internal:true}});
 assert.deepEqual(Object.keys(body.payload),['country','session_id','product_id','internal']);
 assert.equal(materialEventBody('materials_directory_view','ae','session-fixture').pagePath,'/materials');
});

test('empty explicit referrer defeats backend HTTP Referer fallback', async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../server/dist/controllers/statsController.js',import.meta.url),'utf8');
 const match=source.match(/const referrer = ([\s\S]*?);/g)?.find(value=>value.includes('req.body'));
 assert.ok(match, 'Read actual controller referrer selection');
 const body=materialEventBody('materials_inquiry_start','ae','test-session',15);
 const req={body,headers:{referer:'https://www.tarmeer.com/materials?q=private-contact'}};
 const referrer=Function('req',`${match} return referrer;`)(req);
 assert.equal(referrer,'');
});
