import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const jsx=(type,props,key)=>({type,props:props||{},key});
const flatten=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(flatten)];
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name);};
function mount(initialFullscreen=false){
 const hooks=[],listeners=new Map();let cursor=0,effects=[],dirty=false,tree,dom=[],mode;
 const document={body:{style:{overflow:'auto'}},activeElement:null};
 class Element{constructor(node){this.node=node;this.isConnected=true;this.style={};}focus(){document.activeElement=this;}getClientRects(){return [1];}querySelectorAll(){return dom.filter(d=>d.node.type==='button');}}
 document.activeElement=new Element({type:'button',props:{'aria-label':'External catalog entry'}});
 const external=document.activeElement;
 const react={
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],value=>{const v=typeof value==='function'?value(hooks[i]):value;if(!Object.is(v,hooks[i])){hooks[i]=v;dirty=true;}}];},
  useRef(initial){const i=cursor++;return hooks[i] ||= {current:initial};},
  useCallback(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps))hooks[i]={deps,fn};return hooks[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(!same(hooks[i]?.deps,deps)){const old=hooks[i];hooks[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn();});}},
 };
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/components/materials/CatalogReader.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,document,HTMLElement:Element,URL,fetch:()=>new Promise(()=>{}),getComputedStyle:n=>({opacity:n.node.props.className?.includes('opacity-0')?'0':'1'}),window:{addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:(event,fn)=>{if(listeners.get(event)===fn)listeners.delete(event);}},
 require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='react-dom')return {createPortal:n=>n};if(name==='lucide-react')return new Proxy({},{get:()=> 'icon'});if(name.endsWith('/imageUrl'))return {resolveImageUrl:x=>x};throw Error(name);},
 });
 let closed=false;const catalogs=[{id:17,title:'Catalog'}];
 const props={catalogs,initialFullscreen,...(initialFullscreen?{onClose:()=>{closed=true;}}:{})};
 function render(){
  for(let pass=0;pass<10;pass++){
   cursor=0;effects=[];dirty=false;tree=exports.default(props);
   // Portal transitions replace the DOM; disconnect the old trigger before effects.
   const nextMode=tree.props.role==='dialog';const replace=mode!==nextMode;mode=nextMode;
   if(replace){dom.forEach(d=>{d.isConnected=false;});if(document.activeElement&&!document.activeElement.isConnected)document.activeElement=document.body;}
   dom=flatten(tree).filter(n=>typeof n.type==='string').map((n,i)=>{const d=!replace&&dom[i]?.node.type===n.type?dom[i]:new Element(n);d.node=n;return d;});
   for(const d of dom)if(d.node.props.ref)d.node.props.ref.current=d;
   effects.forEach(fn=>fn());if(!dirty)return;
  }throw Error('Reader did not settle');
 }
 render();
 return {render,document,external,get closed(){return closed;},button:label=>dom.find(d=>d.node.props['aria-label']===label),root:()=>dom.find(d=>d.node.props.role==='dialog'),key(key,shiftKey=false){let prevented=false;listeners.get('keydown')?.({key,shiftKey,preventDefault(){prevented=true;}});return prevented;},unmount(){hooks.forEach(h=>h?.cleanup?.());}};
}
for(const method of ['Escape','close']){
 const view=mount();const trigger=view.button('Fullscreen');trigger.focus();trigger.node.props.onClick({currentTarget:trigger});view.render();
 check(`inline ${method}: fullscreen locks scroll and focuses dialog`,()=>{assert.equal(view.document.body.style.overflow,'hidden');assert.equal(view.document.activeElement,view.root());});
 if(method==='Escape')view.key('Escape');else view.button('Exit fullscreen').node.props.onClick({});view.render();
 check(`inline ${method}: restores focus to recreated Fullscreen button`,()=>{assert.equal(view.document.activeElement,view.button('Fullscreen'));assert.equal(view.document.body.style.overflow,'auto');});
 view.unmount();
}
const card=mount(true);
check('dialog mode traps reverse Tab inside reader',()=>{assert(card.key('Tab',true));assert.notEqual(card.document.activeElement,card.external);});
card.key('Escape');card.unmount();
check('dialog mode Escape calls close and restores external card focus and previous overflow',()=>{assert(card.closed);assert.equal(card.document.activeElement,card.external);assert.equal(card.document.body.style.overflow,'auto');});
console.log(`${count}/${count} PASS`);
