import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as library from '../../src/lib/supplierProductLibrary.ts';
import * as procurement from '../../src/lib/materialsProcurement.ts';
import * as navigation from '../../src/lib/materialsNavigation.ts';
const fixture={id:17,title:'Stone Panel',title_translated:'Stone Panel',image_url:'/panel.webp',image_urls:['/panel.webp'],category:'stone',supplier_id:9,supplier_slug:'partner-9',supplier_name:'Stone Supplier',specs:[{label:'Collection',value:'Natural Stone'}]};
let count=0;
const check=(label,value)=>{assert.ok(value,label);console.log('PASS '+label);count++};
function component(file,state) {
 const exports={}; let index=0;
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/components/materials/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require(name){
  if(name==='react/jsx-runtime')return jsx;
  if(name==='react')return {useEffect(){},useMemo:fn=>fn(),useState:value=>[state?state[index++]:value,()=>{}]};
  if(name==='next/link')return {default:({children,...props})=>createElement('a',props,children)};
  if(name==='lucide-react')return new Proxy({}, {get:()=>()=>null});
  if(name.endsWith('/supplierProductLibrary'))return library;
  if(name.endsWith('/materialsProcurement'))return procurement;
  if(name.endsWith('/materialsNavigation'))return navigation;
  if(name.endsWith('/materialDescription'))return {sanitizeDescription:()=>''};
  if(name.endsWith('/FilterSidebar')||name.endsWith('/Lightbox'))return {default:()=>null};
  if(name.endsWith('/country'))return {countryFromLang:()=>({code:'ae'})};
  if(name.endsWith('/SiteLocaleContext'))return {useSiteLocale:()=>({lang:'en'})};
  if(name.endsWith('/materialMacros'))return {PREMIUM_MATERIALS:[],fetchMacroProducts:()=>{throw Error('Unexpected effect during static render')}};
  if(name==='./MaterialImage')return {default:({src,alt})=>createElement('img',{src,alt,'data-material-image':'true'})};
  if(name==='./ProductPriceLine')return {default:()=>createElement('p',null,'Request a quote')};
  throw Error(name);
 }});return exports.default;
}
for(const [name,Component,props]of[
 ['supplier library',component('SupplierProductLibrary.tsx'),{products:[fixture],categoryLabel:()=> 'Stone',onOpenProduct(){},enableProductDetails:true}],
 ['category grid',component('MacroProductGrid.tsx',[[fixture],1,false,null]),{macroKey:'stone',label:'Stone'}],
]){
 const html=renderToStaticMarkup(createElement(Component,props));
 check(name+' image and title both link to exact product',(html.match(/href="\/materials\/products\/17(?:[?"][^>]*)/g)||[]).length===2);
 check(name+' retains separate accessible image zoom',html.includes('aria-label="Enlarge Stone Panel"'));
 check(name+' uses shared image state component',html.includes('data-material-image="true"'));
 check(name+' has no nested links or image controls',!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<(?:a|button)\b/.test(html));
 if(name==='category grid')check('category card displays sourcing reference',html.includes('Via Tarmeer · Supplier #9')&&html.includes('View Supplier'));
}
const nonAe=renderToStaticMarkup(createElement(component('SupplierProductLibrary.tsx'),{products:[fixture],categoryLabel:()=> 'Stone',onOpenProduct(){},enableProductDetails:false}));
check('non-AE supplier gallery does not link to the AE-only detail route',!nonAe.includes('/materials/products/')&&nonAe.includes('aria-label="View Stone Panel"'));
check('translated Collection field preserves original series browsing',library.getSupplierProductSeries(fixture,()=> 'Stone')==='Natural Stone');
console.log(`${count}/${count} PASS`);
