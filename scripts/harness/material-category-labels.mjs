import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/materials/MegaMenuDirectory.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require(name){
 if(name==='react/jsx-runtime')return jsx;
 if(name==='react')return {useState:v=>[v,()=>{}],useEffect(){},useRef:v=>({current:v}),useCallback:f=>f};
 if(name==='lucide-react')return {ChevronRight:()=>null,ArrowRight:()=>null};
 if(name==='@/lib/country')return {countryFromLang:()=>({code:'ae'})};
 if(name==='@/contexts/SiteLocaleContext')return {useSiteLocale:()=>({lang:'en'})};
 return {};
}});
const label='Foamed Ceramic Architectural Components';
const html=renderToStaticMarkup(createElement(exports.default,{categories:[{key:'ceramic',label,productCount:125,image:'/test.webp',children:[]}],loading:false,selectedKey:null,onSelectCategory(){}}));
const checks=[
 ['full category label wraps',()=>assert.match(html,new RegExp('class="whitespace-normal break-words text-sm font-medium leading-5"[^>]*>'+label))],
 ['no label ellipsis',()=>assert(!/truncate|line-clamp/.test(html))],
 ['count stays on one line',()=>assert.match(html,/class="whitespace-nowrap text-xs text-stone-500">125 products/)],
 ['scroll remains enabled with hidden track',()=>assert.match(html,/lg:overflow-y-auto \[scrollbar-width:none\] \[&amp;::-webkit-scrollbar\]:hidden/)],
 ['category keyboard target retained',()=>assert.match(html,/role="button" tabindex="0"/)],
];
for(const [name,fn] of checks){fn();console.log('PASS '+name);}console.log(`${checks.length}/${checks.length} PASS`);
