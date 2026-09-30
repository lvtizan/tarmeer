import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { countryFromLang } from '../../lib/country.ts';

const source = fs.readFileSync(new URL('./MaterialsClient.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
const supplier = (id, name) => ({ id, company_name:name, slug:name, categories:['stone'], product_count:1, origin:'china' });
function harness({ lang = 'vi', initialSuppliers = [], query = '' } = {}) {
  const hooks = [], effects = [], requests = [], navigations = [];
  let cursor = 0, tree, dirty = false, params = new URLSearchParams(query);
  const router = { replace(url) { navigations.push(url); params = new URLSearchParams(url.split('?')[1] || ''); dirty = true; } };
  const exports = {};
  vm.runInNewContext(code, { exports, process:{env:{}}, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({url,options,resolve,reject})); },
    require(name) {
      if (name === 'react/jsx-runtime') return jsx;
      if (name === 'react') return {
        useState(value) { const i=cursor++; if (!(i in hooks)) hooks[i]=typeof value==='function'?value():value; return [hooks[i], update => {const next=typeof update==='function'?update(hooks[i]):update; if(!Object.is(next,hooks[i])) {hooks[i]=next;dirty=true;} }]; },
        useRef(value) {const i=cursor++;return hooks[i]??={current:value};},
        useEffect(effect,deps) { const i=cursor++, prior=hooks[i]; if (!prior || !deps || deps.some((value,index)=>!Object.is(value,prior.deps?.[index]))) { hooks[i]={deps,cleanup:prior?.cleanup};effects.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=effect();});} },
      };
      if (name==='next/navigation') return {useRouter:()=>router,useSearchParams:()=>params};
      if (name==='next/link') return {default:'a'};
      if (name==='lucide-react') return new Proxy({}, {get:()=>()=>null});
      if (name.endsWith('/country')) return {countryFromLang};
      if (name.endsWith('/SiteLocaleContext')) return {useSiteLocale:()=>({lang})};
      if (name.endsWith('/supplierConstants')) return {supplierPublicTitle:()=> 'Stone supplier',ORIGIN_LABEL:{china:'China'},ORIGIN_BADGE_CLASS:{china:''}};
      if (name.endsWith('/imageUrl')) return {resolveVariantUrl:x=>x,resolveImageUrl:x=>x};
      if (name.endsWith('/AdminSelect')) return {default:()=>null};
      if (name.endsWith('/constants')) return {GOOGLE_MAPS_URL:'https://maps.example/ae'};
      throw new Error(name);
    },
  });
  function render() {cursor=0;dirty=false;tree=exports.default({initialSuppliers});return tree;}
  function flush() {for(let i=0;i<20;i++){while(effects.length)effects.shift()();if(!dirty)return;render();}throw new Error('Effect loop');}
  function visit(fn,node=tree) {if(node==null||node===false)return;if(Array.isArray(node)){node.forEach(n=>visit(fn,n));return;}fn(node);if(typeof node==='object')visit(fn,node.props?.children??null);}
  const ids=()=>{const result=[];visit(n=>{if(n?.type?.name==='SupplierCard')result.push(n.props.s.id);});return result;};
  const text=()=>{const result=[];visit(n=>{if(typeof n==='string')result.push(n);});return result.join(' ');};
  async function respond(request,data,status=200){request.resolve({ok:status<400,status,json:async()=>data});await new Promise(resolve=>setImmediate(resolve));flush();}
  function list(country){return requests.filter(r=>r.url.includes('/suppliers?')&&r.options.headers['x-country']===country).at(-1);}
  render();
  return {requests,navigations,flush,ids,text,respond,list,switchCountry(next){lang=next;render();},find(predicate){let hit;visit(n=>{if(typeof n==='object'&&predicate(n))hit=n;});return hit;}};
}

test('VN SSR hydration requests supplier and category data with both country query and header', async () => {
  const h=harness({initialSuppliers:[supplier(901,'vn-ssr')]});
  assert.deepEqual(h.ids(),[901]);h.flush();
  assert.equal(h.requests.length,2);
  for(const request of h.requests){assert.equal(new URL(request.url,'https://local.test').searchParams.get('country'),'vn');assert.equal(request.options.headers['x-country'],'vn');}
  await h.respond(h.list('vn'),{suppliers:[supplier(902,'vn-refreshed')]});
  assert.deepEqual(h.ids(),[902]);
  assert.match(h.text(),/Vietnam/);assert.doesNotMatch(h.text(),/Sharjah|in UAE|China and the UAE/);
});

test('country switch clears filters and old cards synchronously; late AE result cannot overwrite VN',async()=>{
  const h=harness({lang:'en',initialSuppliers:[supplier(100,'ae-ssr')],query:'origin=china&category=stone&search=stone'});
  h.flush();const ae=h.list('ae');
  h.switchCountry('vi');assert.deepEqual(h.ids(),[],'no old cards even before effects run');h.flush();
  assert.ok(h.navigations.length);const url=new URL(h.navigations.at(-1),'https://local.test');
  for(const key of ['origin','category','search'])assert.equal(url.searchParams.has(key),false);
  const vn=h.list('vn');await h.respond(vn,{suppliers:[supplier(200,'vn-result')]});
  assert.deepEqual(h.ids(),[200]);
  await h.respond(ae,{suppliers:[supplier(101,'late-ae')]});
  assert.deepEqual(h.ids(),[200]);
  assert.equal(ae.options.signal.aborted,true);
});

test('late prior-country errors do not replace new-country data; current errors are explicit and retryable',async()=>{
  const h=harness({lang:'en'});h.flush();const ae=h.list('ae');h.switchCountry('vi');h.flush();
  await h.respond(h.list('vn'),{suppliers:[supplier(200,'vn-result')]});
  ae.reject(new Error('Old AE network error'));await new Promise(resolve=>setImmediate(resolve));h.flush();
  assert.deepEqual(h.ids(),[200]);assert.doesNotMatch(h.text(),/Could not load suppliers/);
  // A fresh VN request failure must never fall back to AE SSR content or an empty-data message.
  h.switchCountry('en');h.flush();h.switchCountry('vi');h.flush();await h.respond(h.list('vn'),{},503);
  assert.deepEqual(h.ids(),[]);assert.match(h.text(),/Could not load suppliers/);assert.doesNotMatch(h.text(),/No suppliers found/);
  const before=h.requests.length;
  h.find(n=>n.type==='button'&&n.props.children==='Retry suppliers').props.onClick();h.flush();
  assert.ok(h.requests.length>before);assert.equal(h.list('vn').options.headers['x-country'],'vn');
});

test('current-country empty results render an empty state, not an error or previous suppliers',async()=>{
  const h=harness({initialSuppliers:[supplier(901,'vn-ssr')]});h.flush();await h.respond(h.list('vn'),{suppliers:[]});
  assert.deepEqual(h.ids(),[]);assert.match(h.text(),/No suppliers found/);assert.doesNotMatch(h.text(),/Could not load suppliers/);
});

test('late category responses cannot overwrite the current-country filter labels',async()=>{
  const h=harness({lang:'en'});h.flush();
  const ae=h.requests.find(r=>r.url.includes('/product-categories?'));
  h.switchCountry('vi');h.flush();
  const vn=h.requests.filter(r=>r.url.includes('/product-categories?')).at(-1);
  await h.respond(vn,{categories:[{value:'tiles',label:'VN current categories'}]});
  await h.respond(ae,{categories:[{value:'tiles',label:'AE obsolete categories'}]});
  assert.match(h.text(),/VN current categories/);assert.doesNotMatch(h.text(),/AE obsolete categories/);
  assert.equal(ae.options.signal.aborted,true);
});
