#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as procurement from '../../src/lib/materialsProcurement.ts';
import * as navigation from '../../src/lib/materialsNavigation.ts';
import * as library from '../../src/lib/supplierProductLibrary.ts';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const checks = [];
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) });

const adminForgot = read('src/app/admin/forgot-password/page.tsx');
const hubFeatured = read('src/components/materials/HubFeatured.tsx');
const hubSearchResults = read('src/components/materials/HubSearchResults.tsx');
const hubProductCard = read('src/components/materials/HubProductCard.tsx');

check(
  'admin forgot password uses the admin reset endpoint',
  adminForgot.includes('adminApi.forgotPassword') &&
    adminForgot.includes('setError(\'Failed to send reset email.\')') &&
    !adminForgot.includes('err instanceof Error ? err.message') &&
    !adminForgot.includes("fetch('/api/auth/forgot-password'") &&
    !adminForgot.includes('fetch("/api/auth/forgot-password"'),
);

const moduleExports = {};
const previewExports = {};
vm.runInNewContext(ts.transpileModule(read('src/components/materials/FullSlabPreview.tsx'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:previewExports,require(name){
 if(name==='react/jsx-runtime')return jsx;
 if(name.endsWith('/SmartImage'))return {default:({variant,...props})=>createElement('img',props)};
 throw Error(name);
}});
const gallery = {};
vm.runInNewContext(ts.transpileModule(read('src/lib/materialGallery.ts'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports:gallery,URL,require:()=>library});
const code = ts.transpileModule(hubProductCard, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports: moduleExports, require(name) {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'next/link') return { default: ({ children, ...props }) => createElement('a', props, children) };
  if (name === 'lucide-react') return { ArrowRight: () => null, Play: () => null };
  if (name.endsWith('/materialsNavigation')) return navigation;
  if (name.endsWith('/materialsProcurement')) return procurement;
  if (name.endsWith('/materialGallery')) return gallery;
  if (name.endsWith('/SmartImage')) return { default: ({variant, ...props}) => createElement('img', props) };
  if (name === './ProductPriceLine') return { default: () => createElement('p', null, 'Request a quote') };
  if (name === './MaterialImage') return { default: ({src, alt, fit}) => createElement('img', {src,alt,'data-fit':fit}) };
  if (name === './FullSlabPreview') return previewExports;
  throw new Error(`Unexpected import ${name}`);
}});
const fixture = { id: 23, title: 'Dining Chair', image_url: '/chair.webp', supplier_slug: 'supplier-7', supplier_name: 'Supplier', model: 'C-12' };
const render = (product = fixture, returnTo = '/materials?category=furniture&q=chair') => renderToStaticMarkup(createElement(moduleExports.default, {product,returnTo}));
const html = render();
const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
check('image and title directly open the selected product with browsing context', links.filter(link => link[1].startsWith('/materials/products/23?returnTo=')).length === 2);
check('supplier action is independent of the two product links', links.length === 3 && links.some(link => link[1] === '/materials/suppliers/supplier-7?from=products' && link[2].includes('View supplier')));
check('rendered product and supplier links never nest', !/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html));
check('invalid supplier slugs omit only the supplier link', ['https://evil.test', '../unsafe', 'bad/slash', ''].every(supplier_slug => { const result=render({...fixture,supplier_slug}); return !result.includes('/materials/suppliers/') && result.includes('/materials/products/23'); }));
check('safe return links retain legitimate filters and reject external/unsafe routes', procurement.safeMaterialsReturn('/materials?q=chair&category=furniture') === '/materials?q=chair&category=furniture' && ['https://evil.test/materials','//evil.test/materials','javascript:alert(1)','/admin'].every(value => procurement.safeMaterialsReturn(value) === '/materials?tab=products'));
check('missing titles are explicit review status rather than generic Material', render({...fixture,title:'Material'}).includes('Product 23 · Details under review'));
check('card exposes model and explicit sourcing identity', html.includes('Model: C-12') && html.includes('Via Tarmeer'));
const slab = {...fixture, title:'Coffee Gold — FYN1-1', model:'FYN1-1', specs:[{label:'Display format',value:'Full slab'}]};
const slabHtml = render(slab);
check('full slab shows square texture crop and a complete contained preview', slabHtml.includes('aspect-square') && slabHtml.includes('data-fit="cover"') && slabHtml.includes('aspect-[1/3]') && slabHtml.includes('object-contain') && slabHtml.includes('Full slab'));
check('full slab preview uses the same product image, not an application scene', (slabHtml.match(/src="\/chair.webp"/g)||[]).length === 2);
check('decorative slab preview does not add focusable or nested controls', slabHtml.includes('aria-hidden="true"') && !slabHtml.includes('<button') && (slabHtml.match(/<a\b/g)||[]).length === 3);
check('model already present in the title is not repeated', slabHtml.includes('FYN1-1') && !slabHtml.includes('Model: FYN1-1'));
check('ordinary materials retain their original image presentation', html.includes('aspect-[4/3]') && html.includes('data-fit="contain"') && !html.includes('Full slab'));
check('ordinary short model remains visible even when it occurs inside the title', render({...fixture,title:'Stone 10',model:'1'}).includes('Model: 1') && render({...fixture,title:'Marble',model:'A'}).includes('Model: A'));

const relatedExports={}; let relatedState=[],relatedCursor=0,lightboxProps;
const imageUrlExports={};
vm.runInNewContext(ts.transpileModule(read('src/lib/imageUrl.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:imageUrlExports});
vm.runInNewContext(ts.transpileModule(read('src/components/materials/MaterialProductCard.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:relatedExports,require(name){
 if(name==='react/jsx-runtime')return jsx;
 if(name==='react')return {useState(initial){const i=relatedCursor++; if(!(i in relatedState))relatedState[i]=initial;return [relatedState[i],value=>{relatedState[i]=value;}];}};
 if(name==='next/link')return {default:({children,...props})=>createElement('a',props,children)};
 if(name==='lucide-react')return {Play:()=>null,ZoomIn:()=>null};
 if(name.endsWith('/materialGallery'))return gallery;
 if(name.endsWith('/materialsProcurement'))return procurement;
 if(name.endsWith('/imageUrl'))return imageUrlExports;
 if(name.endsWith('/supplierConstants'))return {ORIGIN_LABEL:{china:'China'},ORIGIN_BADGE_CLASS:{china:''}};
 if(name.endsWith('/useProductCategoryLabels'))return {useProductCategoryLabels:()=>()=> 'Stone'};
 if(name.endsWith('/Lightbox'))return {default:props=>{lightboxProps=props;return createElement('div',{'data-lightbox':'true'});}};
 if(name==='./FullSlabPreview')return previewExports;
 if(name==='./MaterialImage')return {default:({src,alt,fit})=>createElement('img',{src,alt,'data-fit':fit})};
 if(name==='./ProductPriceLine')return {default:()=>createElement('p',null,'Request a quote')};
 throw Error(name);
}});
const relatedProduct={...slab,image_urls:['/chair.webp','/room.webp'],supplier_id:242,supplier_origin:'china'};
const relatedTree=product=>{relatedCursor=0;return relatedExports.default({product});};
const relatedHtml=renderToStaticMarkup(relatedTree(relatedProduct));
check('related slab cards match directory texture and full slab preview',relatedHtml.includes('aspect-square')&&relatedHtml.includes('data-fit="cover"')&&relatedHtml.includes('aspect-[1/3]')&&relatedHtml.includes('Full slab'));
check('related ordinary cards keep their original landscape full image',(()=>{const h=renderToStaticMarkup(relatedTree({...relatedProduct,specs:[]}));return h.includes('aspect-video')&&h.includes('data-fit="contain"')&&!h.includes('Full slab');})());
check('related cards retain separate zoom and product navigation',relatedHtml.includes('aria-label="Enlarge Coffee Gold — FYN1-1"')&&(relatedHtml.match(/href="\/materials\/products\/23"/g)||[]).length===2&&!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/.test(relatedHtml));
const nodes=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];
nodes(relatedTree(relatedProduct)).find(n=>n.type==='button').props.onClick();
const openedRelated=renderToStaticMarkup(relatedTree(relatedProduct));
check('related zoom opens the original full image and application gallery',openedRelated.includes('data-lightbox="true"')&&lightboxProps.index===0&&lightboxProps.shots[0].src==='/chair.webp'&&lightboxProps.shots[1].src==='/room.webp');
lightboxProps.onClose();
check('related zoom closes without losing product navigation',!renderToStaticMarkup(relatedTree(relatedProduct)).includes('data-lightbox="true"'));
check('related supplier and quote information remain available',relatedHtml.includes('Supplier #242')&&relatedHtml.includes('China')&&relatedHtml.includes('Request a quote'));

check(
  'popular product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubFeatured) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubFeatured),
);

check(
  'search product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubSearchResults) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubSearchResults),
);


const searchExports = {};
vm.runInNewContext(ts.transpileModule(hubSearchResults, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText, {exports:searchExports, require(name) {
  if(name==='react/jsx-runtime')return jsx;
  if(name==='next/link')return {default:({children,...props})=>createElement('a',props,children)};
  if(name==='./HubProductCard')return {default:moduleExports.default};
  throw new Error(name);
}});
const supplierResult=renderToStaticMarkup(createElement(searchExports.default,{type:'suppliers',results:[{id:7,slug:'supplier-7',company_name:'Stone Supplier',origin:'china',cover_image_url:null,first_product_image:null,logo_url:null}],total:1,query:'stone',loading:false}));
// Execute the real search controller mapping, then render its actual public response.
const controllerPath=path.join(ROOT,'server/dist/controllers/materialsMacroController.js');
const controllerRequire=createRequire(controllerPath);
const controllerExports={}; const queryCalls=[];
const searchRow={...slab,specs:JSON.stringify([...slab.specs,{label:'Brand',value:'Private Factory'}]),supplier_real_name:'Private Factory',supplier_real_name_zh:'私人工厂',supplier_categories:['stone'],title:slab.title};
let dbRows=[searchRow];
vm.runInNewContext(read('server/dist/controllers/materialsMacroController.js'),{exports:controllerExports,console,require(name){
 if(name==='../config/database')return {default:{async query(sql,params){queryCalls.push({sql,params});return [/COUNT\(\*\)/.test(sql)?[{total:dbRows.length}]:dbRows];}}};
 return controllerRequire(name);
}});
async function searchResponse(country='ae'){
 let body;
 await controllerExports.getMaterialSearch({query:{type:'products',q:'FYN1-1',country},country},{json(value){body=value;return this;},status(code){throw Error('Unexpected search status '+code);}});
 return body;
}
const response=await searchResponse();
const searchedSlabHtml=renderToStaticMarkup(createElement(searchExports.default,{type:'products',results:response.results,total:response.pagination.total,query:'FYN1-1',loading:false}));
check('real search response retains the full slab layout through the search-results component', searchedSlabHtml.includes('aspect-square') && searchedSlabHtml.includes('Full slab') && searchedSlabHtml.includes('data-fit="cover"'));
check('new public search specs redact supplier names', !JSON.stringify(response.results).includes('Private Factory') && !JSON.stringify(response.results).includes('私人工厂'));
check('search count and rows retain country query parameters',queryCalls.length===2 && queryCalls.every(call=>call.params[0]==='ae'&&call.sql.includes('sp.country=?')));
for(const specs of [null,'not-json','{}']){
 dbRows=[{...searchRow,specs}];
 const malformed=await searchResponse();
 check('search handles missing/malformed specification '+String(specs),Array.isArray(malformed.results[0].specs)&&malformed.results[0].specs.length===0);
}
check('supplier search renders a stable Tarmeer reference separately from category',supplierResult.includes('Tarmeer sourcing partner #7')&&supplierResult.includes('Stone Supplier')&&supplierResult.includes('/materials/suppliers/supplier-7'));
const megaSource=read('src/components/materials/MegaMenuDirectory.tsx');
check('desktop/mobile featured supplier and directory cards use the same public reference', (megaSource.match(/Tarmeer sourcing partner #\{s.id\}/g)||[]).length===2&&read('src/components/materials/MaterialsClient.tsx').includes('Tarmeer sourcing partner #{s.id}'));

let passed = 0;
for (const item of checks) {
  if (item.condition) {
    passed++;
    console.log(`✓ ${item.label}`);
  } else {
    console.error(`✗ ${item.label}`);
  }
}

console.log(`\nadmin-materials-clickability: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
