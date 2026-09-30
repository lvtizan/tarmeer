import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readProcurementFilters, safeMaterialsReturn, materialProductTitle, mergeProcurementFilters, restoreDirectoryPages, materialsPositionKey } from './materialsProcurement.ts';
test('procurement filters round-trip through shareable URLs without unrelated parameters', () => {
 const params = new URLSearchParams({q:'WPC 203',category:'boards',currency:'AED',unit:'SQM',sort:'price_asc',page:'7',country:'vn',availability:'uae_stock'});
 assert.deepEqual(readProcurementFilters(params), {q:'WPC 203',category:'boards',currency:'AED',unit:'SQM',availability:'uae_stock',sort:'price_asc'});
 assert.deepEqual(readProcurementFilters(new URLSearchParams(readProcurementFilters(params))),readProcurementFilters(params));
});
test('return context cannot be an external URL, protocol URL or arbitrary local route', () => {
 for(const value of ['https://evil.test/materials','//evil.test/materials','javascript:alert(1)','/admin','/materials/../admin',null]) assert.equal(safeMaterialsReturn(value),'/materials?tab=products');
 assert.equal(safeMaterialsReturn('/materials?category=stone&q=QS%20XT'),'/materials?category=stone&q=QS%20XT');
});
test('legacy placeholders identify the exact review record rather than inventing product facts', () => {
 assert.equal(materialProductTitle({id:8,title:'Material'}),'Product 8 · Details under review');
 assert.equal(materialProductTitle({id:9,title:'Stone wall panel — QS-XT-9'}),'Stone wall panel — QS-XT-9');
});

test('removing parent filters clears dependent price and specification constraints', () => {
 const current={category:'stone',spec:'600 x 600',currency:'AED',unit:'SQM',price_min:'100',price_max:'200',sort:'price_asc',q:'marble'};
 assert.deepEqual(mergeProcurementFilters(current,{currency:''}),{category:'stone',spec:'600 x 600',unit:'SQM',q:'marble'});
 assert.deepEqual(mergeProcurementFilters(current,{unit:''}),{category:'stone',spec:'600 x 600',currency:'AED',q:'marble'});
 const withoutCategory=mergeProcurementFilters(current,{category:''});
 assert.equal(withoutCategory.spec,undefined); assert.equal(withoutCategory.price_min,'100');
});


test('cache-miss deep return rebuilds all recorded pages before scroll can consume the result', async () => {
 const calls=[];
 const result=await restoreDirectoryPages(async page=>{calls.push(page);return {products:[{id:page*2-1},{id:page*2}],pagination:{page,limit:2,total:8,totalPages:4}}},3);
 assert.deepEqual(calls,[1,2,3]); assert.deepEqual(result.products.map(p=>p.id),[1,2,3,4,5,6]); assert.equal(result.pagination.page,3);
});
test('deep return respects a shortened catalog, failed page and cancelled selection', async () => {
 const page=n=>({products:[{id:n}],pagination:{page:n,limit:1,total:2,totalPages:2}});
 assert.equal((await restoreDirectoryPages(async n=>page(n),8)).pagination.page,2);
 const failed=await restoreDirectoryPages(async n=>n===2?{...page(n),error:'Retry'}:page(n),2);
 assert.equal(failed.error,'Retry');
 const calls=[];await restoreDirectoryPages(async n=>{calls.push(n);return page(n)},2,()=>false);assert.deepEqual(calls,[1]);
});

test('shared and returned URLs use the same position key despite equivalent encoding/order', () => {
 assert.equal(materialsPositionKey('?q=Stone%20Slab&tab=products'),materialsPositionKey('?tab=products&q=Stone+Slab'));
 assert.notEqual(materialsPositionKey('?q=Stone%2BSlab'),materialsPositionKey('?q=Stone+Slab'));
});
