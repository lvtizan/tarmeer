import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../../src/app/field/login/page.tsx',import.meta.url),'utf8');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
function mount(role='field_staff'){
 const hooks=[],requests=[],storage=new Map(),routes=[];let cursor=0;
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,window:{location:{search:''}},localStorage:{setItem:(key,value)=>storage.set(key,value)},fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({token:'fixture-token',admin:{role}})};},require(name){
  if(name==='react')return{useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];}};
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='next/navigation')return{useRouter:()=>({replace:path=>routes.push(path)})};
  if(name==='lucide-react')return{Eye:'eye',EyeOff:'eye-off'};
  throw Error(name);
 }});
 const render=()=>{cursor=0;return nodes(exports.default());};
 const password=()=>render().find(n=>n.type==='input'&&n.props.id==='field-login-password');
 const toggle=()=>render().find(n=>n.type==='button'&&n.props['aria-controls']==='field-login-password');
 return{render,password,toggle,requests,storage,routes};
}
let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name);};
const page=mount();
check('password starts masked with an accessible Show password control',()=>{assert.equal(page.password().props.type,'password');assert.equal(page.toggle().props['aria-label'],'Show password');assert.equal(page.toggle().props['aria-pressed'],false);assert.equal(page.toggle().props.type,'button');});
page.password().props.onChange({target:{value:'Fixture#Only123'}});page.render().find(n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:'fixture@test.local'}});
page.toggle().props.onClick();
check('eye reveals the same password and updates its state and label',()=>{assert.equal(page.password().props.type,'text');assert.equal(page.password().props.value,'Fixture#Only123');assert.equal(page.toggle().props['aria-label'],'Hide password');assert.equal(page.toggle().props['aria-pressed'],true);});
check('toggling visibility performs no authentication request',()=>assert.equal(page.requests.length,0));
page.toggle().props.onClick();
check('eye masks the password again without clearing the input',()=>{assert.equal(page.password().props.type,'password');assert.equal(page.password().props.value,'Fixture#Only123');});
check('mobile eye target is 44px and cannot cover password text',()=>{assert(page.toggle().props.className.includes('min-h-11'));assert(page.toggle().props.className.includes('w-11'));assert(page.password().props.className.includes('pr-14'));assert.equal(page.password().props.autoComplete,'current-password');assert.equal(page.password().props.autoCapitalize,'none');assert.equal(page.password().props.autoCorrect,'off');assert.equal(page.password().props.spellCheck,false);});
page.toggle().props.onClick();await page.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
check('revealed password uses the unchanged login payload and field-staff session',()=>{assert.equal(page.requests.length,1);assert.equal(page.requests[0].url,'/api/admin/login');assert.deepEqual(JSON.parse(page.requests[0].options.body),{email:'fixture@test.local',password:'Fixture#Only123'});assert.equal(page.storage.get('field_token'),'fixture-token');assert.deepEqual(page.routes,['/field/survey']);});
const blocked=mount('customer');await blocked.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
check('visibility control does not relax the field-staff role gate',()=>{assert.equal(blocked.storage.size,0);assert.equal(blocked.routes.length,0);assert(blocked.render().some(n=>n.props.children==='This account does not have field staff access.'));});
console.log(`${count}/${count} PASS`);
