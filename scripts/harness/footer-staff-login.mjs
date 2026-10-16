import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const translations={};vm.runInNewContext(compile(read('src/i18n/sections/footer.ts')),{exports:translations});
const constants={};vm.runInNewContext(compile(read('src/lib/constants.ts')),{exports:constants});
const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
function render(lang='en',pathname='/'){
 const exports={};vm.runInNewContext(compile(read('src/components/Footer.tsx')),{exports,require(name){
  if(name==='react')return{useState:initial=>[initial,()=>{}]};
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='next/navigation')return{usePathname:()=>pathname};
  if(name==='next/link')return{default:'a'};
  if(name.endsWith('/constants'))return constants;
  if(name.endsWith('/SiteLocaleContext'))return{useSiteLocale:()=>({lang,tr:{footer:translations.footer[lang]}})};
  if(name==='lucide-react')return{MapPin:'map-icon'};
  if(name.endsWith('/analytics'))return{trackAnalyticsEvent(){}};
  if(name==='./FeedbackModal')return{default:'feedback'};
  throw Error(name);
 }});return nodes(exports.default({whatsAppLink:'https://wa.me/971588388922'}));
}
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
const en=render();const link=en.find(n=>n.props.href==='/field/login');
check('public footer exposes an English same-origin staff login link',()=>{assert(link);assert.equal(link.props.children,'Staff Login');assert.equal(link.props.prefetch,false);});
check('mobile link is visible without a desktop-only class and has a 44px tap target',()=>{assert(link.props.className.includes('min-h-11'));assert(!link.props.className.includes('hidden'));assert(en.some(n=>n.props.className?.includes('flex-wrap')));});
const vi=render('vi');
check('VN footer localizes staff login while preserving both locked Zalo / WhatsApp contacts',()=>{
 assert.equal(vi.find(n=>n.props.href==='/field/login').props.children,'Đăng nhập nhân viên');
 const contacts=vi.filter(n=>n.type==='a'&&String(n.props.href).startsWith('https://wa.me/'));
 assert.equal(contacts.length,2);
 for(const number of ['+84 886 770 218','+84 888 175 938'])assert(contacts.some(n=>[n.props.children].flat(Infinity).join('').includes('Zalo / WhatsApp: '+number)));
});
check('staff/admin/private screens retain hidden site footer',()=>{for(const path of ['/field/login','/field/survey','/admin','/auth'])assert.equal(render('en',path).length,0);});
check('staff login accepts the intended roles and routes directly to the survey',()=>{const login=read('src/app/field/login/page.tsx');assert(login.includes("data.admin?.role !== 'field_staff' && data.admin?.role !== 'super_admin'"));assert(login.includes("localStorage.setItem('field_token'"));assert(login.includes(" : '/field/survey'"));});
console.log(`${count}/${count} PASS`);
