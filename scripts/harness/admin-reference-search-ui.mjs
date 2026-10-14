import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const jsx = (type, props) => ({ type, props: props || {} });
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const empty = {homeownerLeads:[],companyLeads:[],users:[],registeredCompanies:[],directoryCompanies:[],suppliers:[],partnerCompanies:[]};
let passed=0;
const check=(label,fn)=>{fn();console.log('PASS '+label);passed++;};
function mount(props = {}) {
  let cursor=0, country='ae', role='super_admin', permission=true, tree, timer=0;
  const hooks=[], effects=[], timers=new Map(), calls=[], routes=[];
  let global=async()=>empty;
  let reference=async()=>({suppliers:[{id:162,name:'Original Factory'}],products:[{id:1943,title:'Original chandelier',supplierId:162,supplierName:'Original Factory'}]});
  const react={
    useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},
    useRef(initial){const i=cursor++;return hooks[i]||=( {current:initial});},
    useCallback(fn){cursor++;return fn;},
    useEffect(fn,deps){const i=cursor++;const old=hooks[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();hooks[i]={deps};effects.push(()=>{hooks[i].cleanup=fn();});}},
  };
  // Stable callback identity as React does, so request completion doesn't restart the debounce.
  react.useCallback=(fn,deps)=>{const i=cursor++;const old=hooks[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))hooks[i]={fn,deps};return hooks[i].fn;};
  const hasPermission=()=>permission;
  const router={push:path=>routes.push(path)};
  const api={globalSearch:async q=>{calls.push(['global',q]);return global(q);},referenceSearch:async(q,c)=>{calls.push(['reference',q,c]);return reference(q,c);}};
  const exports={};
  vm.runInNewContext(ts.transpileModule(read('src/components/admin/AdminGlobalSearch.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require(name){
      if(name==='react')return react;
      if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
      if(name==='next/navigation')return{useRouter:()=>router};
      if(name==='lucide-react')return{};
      if(name.endsWith('/adminApi'))return{adminApi:api};
      if(name.endsWith('/AdminCountryContext'))return{useAdminCountry:()=>({country})};
      if(name.endsWith('/AdminContext'))return{useAdmin:()=>({hasPermission,admin:{role}})};
      if(name.endsWith('/CopyButton'))return{default:'copy'};
      throw Error(name);
    },document:{addEventListener(){},removeEventListener(){}},setTimeout(fn){timers.set(++timer,fn);return timer;},clearTimeout(id){timers.delete(id);},
  });
  function render(){cursor=0;tree=exports.default(props);effects.splice(0).forEach(fn=>fn());return nodes(tree);}
  function input(q){render().find(n=>n.type==='input').props.onChange({target:{value:q}});render();}
  async function flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());await new Promise(r=>setImmediate(r));render();}
  render();return{input,flush,render,calls,routes,setCountry(c){country=c;render();},setPermission(p){permission=p;render();},setRole(r){role=r;render();},setReference(fn){reference=fn;},setGlobal(fn){global=fn;}};
}
const app=mount();app.input('Supplier #162');await app.flush();
check('explicit supplier reference calls scoped admin lookup without legacy fuzzy query',()=>assert.deepEqual(app.calls,[['reference','Supplier #162','ae']]));
check('original supplier and product names are shown to staff',()=>{const n=app.render();assert(n.some(x=>x.props.children==='Original Factory'));assert(n.some(x=>x.props.children==='Original chandelier'));});
const supplierButton=app.render().find(n=>n.type==='button'&&nodes(n).some(x=>x.props.children==='Original Factory'));
supplierButton.props.onClick();
check('supplier result opens internal original supplier record',()=>assert.equal(app.routes.at(-1),'/admin/suppliers/162'));
app.input('Product 1943');await app.flush();app.render().find(n=>n.type==='button'&&nodes(n).some(x=>x.props.children==='Original chandelier')).props.onClick();
check('product result opens owning supplier with exact product focus',()=>assert.equal(app.routes.at(-1),'/admin/suppliers/162?productId=1943#products'));
app.input('162');await app.flush();
check('bare number supports exact references and preserves existing numeric phone/text search',()=>{assert(app.calls.some(c=>c[0]==='global'&&c[1]==='162'));assert(app.calls.some(c=>c[0]==='reference'&&c[1]==='162'));});
app.input('1');await app.flush();
check('single digit reference is searchable',()=>assert(app.calls.some(c=>c[0]==='reference'&&c[1]==='1')));
app.input('Alice');await app.flush();
check('ordinary name search keeps existing behavior without reference requests',()=>assert.equal(app.calls.at(-1)[0],'global'));
const denied=mount();denied.setPermission(false);denied.input('Supplier #162');await denied.flush();
check('staff without supplier permission do not request original references',()=>assert.equal(denied.calls.length,0));
const failed=mount();failed.setReference(async()=>{throw Error('403');});failed.input('Product 1943');await failed.flush();
check('request error is explicit rather than reported as no results',()=>assert(failed.render().some(n=>n.props.role==='alert')));
const race=mount();let resolve;race.setReference(()=>new Promise(r=>{resolve=r;}));race.input('Supplier #162');await race.flush();race.setCountry('vn');
resolve({suppliers:[{id:162,name:'STALE AE FACTORY'}],products:[]});await new Promise(r=>setImmediate(r));
check('country switch rejects stale original factory response',()=>assert(!race.render().some(n=>n.props.children==='STALE AE FACTORY')));
race.setReference(async()=>({suppliers:[],products:[]}));await race.flush();
check('new country lookup uses selected country',()=>assert.equal(race.calls.at(-1)[2],'vn'));
const supplierOnly=mount();supplierOnly.setGlobal(async()=>{throw Error('Supplier-only administrator');});supplierOnly.input('162');await supplierOnly.flush();
check('supplier-only staff can use bare ID even when legacy broad search is forbidden',()=>assert(supplierOnly.render().some(n=>n.props.children==='Original Factory')));
const changed=mount();let oldResolve;changed.setReference(()=>new Promise(r=>{oldResolve=r;}));changed.input('Supplier #162');await changed.flush();changed.input('Alice');oldResolve({suppliers:[{id:162,name:'OLD QUERY RESULT'}],products:[]});await new Promise(r=>setImmediate(r));
check('editing query immediately invalidates a pending original-name response',()=>assert(!changed.render().some(n=>n.props.children==='OLD QUERY RESULT')));
const restricted=mount({referenceOnly:true});restricted.input('162');await restricted.flush();
check('supplier-scoped layout exposes reference-only search without broad queries',()=>{assert(read('src/app/admin/layout.tsx').includes('<AdminGlobalSearch referenceOnly={supplierScoped} />'));assert.deepEqual(restricted.calls,[['reference','162','ae']]);assert(restricted.render().some(n=>n.props.children==='Original Factory'));});
const scoped=mount({referenceOnly:true});scoped.setRole('sub_admin');scoped.input('162');await scoped.flush();
check('non-super staff omit UI country and rely on authenticated account scope (VN/SA compatible)',()=>assert.deepEqual(scoped.calls,[['reference','162',undefined]]));
const short=mount();short.input('A');await short.flush();
check('one-letter non-reference input does not claim an unperformed search found nothing',()=>{assert.equal(short.calls.length,0);assert(!short.render().some(n=>n.props.children?.includes?.('未找到')));});
const page=read('src/app/admin/suppliers/[id]/page.tsx');
check('supplier detail filters exact product and offers restoring the full catalog',()=>{assert(page.includes('products.filter(p => !focusedProductId || p.id === focusedProductId)'));assert(page.includes("next.delete('productId')"));assert(page.includes('本供应商中未找到商品 #'));assert(page.includes('Product {p.id}'));});
console.log(`${passed}/${passed} PASS`);
