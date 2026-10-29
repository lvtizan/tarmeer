import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from 'node:test';
import {createUploadPreparation,imageUploadConcurrency} from '../../src/lib/uploadPreparation.ts';

const source=readFileSync(new URL('../../src/components/ui/ImageUploadZone.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flatten=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(flatten)];
const text=node=>typeof node==='string'||typeof node==='number'?String(node):node?.props?[node.props.children].flat(Infinity).map(text).join(''):'';
const file=name=>new File(['test-image'],name,{type:'image/jpeg'});
function mount(plans={},extra={},browser){
 const hooks=[],requests=[],prepared=[];let cursor=0,tree,props;const effects=[];
 const jsx=(type,props)=>({type,props:props||{}});
 const react={useState(value){const index=cursor++;if(!(index in hooks))hooks[index]=value;return[hooks[index],next=>{hooks[index]=typeof next==='function'?next(hooks[index]):next;}];},useRef(value){const index=cursor++;return hooks[index]??=( {current:value});},useEffect(effect,deps){const index=cursor++;if(!hooks[index]||!deps.every((value,i)=>Object.is(value,hooks[index][i])))effects.push(effect);hooks[index]=deps;}};
 const exports={};
 const dependencies={
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{Paperclip:'clip',X:'x',FileText:'file'},
  '@/lib/dropFiles':{getDroppedFiles:async()=>({files:[]})},'@/lib/imageUrl':{resolveImageUrl:x=>x},
  '@/lib/uploadImageCompression':{prepareImageForUpload:async f=>{prepared.push(f.name);return{file:f,originalName:f.name,compressed:false};}},
  '@/lib/uploadPasteRouting':{createPasteZoneRegistry:()=>({mount(){},unmount(){},isCurrent(){return true;}}),getPasteFiles:()=>[],isWithinFileLimit:(f,limit)=>limit===undefined||f.size<=limit},
  '@/lib/uploadPreparation':{createUploadPreparation,imageUploadConcurrency},
  '@/lib/uploadRequest':{xhrPost:async(url,headers,body,progress)=>{const f=body.get('file');requests.push({name:f.name,url,headers,body});progress?.(50);const action=plans[f.name]?.shift();if(action instanceof Error)throw action;if(typeof action==='function')return action();return{url:`/uploads/${f.name}`,original_name:f.name};}},
 };
 vm.runInNewContext(compiled,{exports,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];},FormData,File,Blob,URL,crypto,navigator:browser,document:{addEventListener(){},removeEventListener(){}},setTimeout:fn=>{queueMicrotask(fn);return 0;}});
 const states=[];props={value:['/uploads/existing.webp'],onUpload:urls=>{props.value=Array.from(urls);},uploadUrl:'/upload',getHeaders:()=>({Authorization:'Bearer test-only'}),onUploadStateChange:v=>states.push(v),...extra};
 function render(){cursor=0;tree=exports.default(props);effects.splice(0).forEach(effect=>effect());return flatten(tree);}
 render();
 return{requests,prepared,props,states,render,get retry(){return render().find(n=>n.type==='button'&&text(n).startsWith('重试失败'));},async wait(){for(let i=0;i<100;i++){await new Promise(r=>setImmediate(r));if(states.at(-1)===false)return;}throw Error('Upload never settled');},async select(files){render().find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files,value:'file'}});await this.wait();},async retryFailed(){this.retry.props.onClick();await this.wait();}};
}
const statusError=(status)=>Object.assign(Error(`HTTP ${status}`),{status});

test('partial failure retains success; manual retry sends only failed file',async()=>{const m=mount({'bad.jpg':[statusError(400)]});await m.select([file('good.jpg'),file('bad.jpg')]);assert.deepEqual(m.props.value,['/uploads/existing.webp','/uploads/good.jpg']);assert.equal(m.requests.length,2);assert.ok(m.retry);await m.retryFailed();assert.deepEqual(m.requests.map(r=>r.name),['good.jpg','bad.jpg','bad.jpg']);assert.deepEqual(m.props.value,['/uploads/existing.webp','/uploads/good.jpg','/uploads/bad.jpg']);assert.equal(m.retry,undefined);});
test('transient error retries automatically without recompressing',async()=>{const m=mount({'slow.jpg':[Error('Network failure')]});await m.select([file('slow.jpg')]);assert.deepEqual(m.prepared,['slow.jpg']);assert.equal(m.requests.length,2);assert.equal(m.retry,undefined);});
test('failed automatic retry remains available for manual recovery',async()=>{const m=mount({'lost.jpg':[Error('Network failure'),Error('Network failure')]});await m.select([file('lost.jpg')]);assert.equal(m.requests.length,2);assert.ok(m.retry);await m.retryFailed();assert.equal(m.requests.length,3);assert.equal(m.props.value.length,2);});
test('new batch preserves prior failures and successes',async()=>{const m=mount({'bad.jpg':[statusError(403)]});await m.select([file('bad.jpg')]);await m.select([file('next.jpg')]);assert.ok(m.retry);await m.retryFailed();assert.deepEqual(m.props.value,['/uploads/existing.webp','/uploads/next.jpg','/uploads/bad.jpg']);});
test('disabled form cannot retry or start uploads',async()=>{const m=mount({'bad.jpg':[statusError(400)]});await m.select([file('bad.jpg')]);m.props.disabled=true;assert.equal(m.retry.props.disabled,true);await m.retryFailed();assert.equal(m.requests.length,1);});
test('4xx errors are not retried automatically',async()=>{for(const status of [400,401,403,413,429]){const m=mount({'reject.jpg':[statusError(status)]});await m.select([file('reject.jpg')]);assert.equal(m.requests.length,1);assert.ok(m.retry);}});
test('concurrent completion preserves selection order',async()=>{let finishFirst;const m=mount({'first.jpg':[()=>new Promise(resolve=>{finishFirst=resolve;})]});const pending=m.select([file('first.jpg'),file('second.jpg')]);await new Promise(r=>setImmediate(r));assert.deepEqual(m.props.value,['/uploads/existing.webp','/uploads/second.jpg']);finishFirst({url:'/uploads/first.jpg'});await pending;assert.deepEqual(m.props.value,['/uploads/existing.webp','/uploads/first.jpg','/uploads/second.jpg']);});
test('failed files are not sent when upload queue is already busy',async()=>{let finish;const m=mount({'bad.jpg':[statusError(400)],'busy.jpg':[()=>new Promise(r=>{finish=r;})]});await m.select([file('bad.jpg')]);const pending=m.select([file('busy.jpg')]);await new Promise(r=>setImmediate(r));const button=m.retry;assert.equal(button.props.disabled,true);button.props.onClick();assert.equal(m.requests.length,2);finish({url:'/uploads/busy.jpg'});await pending;});

test('changing supplier target clears failed files before retry',async()=>{const m=mount({'bad.jpg':[statusError(400)]});await m.select([file('bad.jpg')]);assert.ok(m.retry);m.props.uploadUrl='/different-supplier/upload';m.render();assert.equal(m.retry,undefined);});
test('late result cannot append images to a different supplier',async()=>{let finish;const m=mount({'late.jpg':[()=>new Promise(r=>{finish=r;})]});const pending=m.select([file('late.jpg')]);await new Promise(r=>setImmediate(r));m.props.uploadUrl='/other-supplier/upload';m.props.value=['/uploads/other-existing.webp'];m.render();finish({url:'/uploads/old-supplier/late.jpg'});await pending;assert.deepEqual(m.props.value,['/uploads/other-existing.webp']);});

test('size-based deadline remains transient and automatically retries',async()=>{const m=mount({'deadline.jpg':[Error('上传耗时超过上限，请重试失败文件，或使用更稳定的网络。')]});await m.select([file('deadline.jpg')]);assert.equal(m.requests.length,2);assert.equal(m.retry,undefined);assert.deepEqual(m.prepared,['deadline.jpg']);});

for(const [label,extra,browser,limit] of [['product',{imageProfile:'product'},{hardwareConcurrency:8,connection:{effectiveType:'4g'}},4],['weak',{imageProfile:'product'},{hardwareConcurrency:8,connection:{saveData:true}},2],['catalog',{chunkUploadUrl:'/chunks'},undefined,1]])test(label+' batch uses bounded upload slots and keeps preparation ahead',async()=>{const pending=[];const files=Array.from({length:6},(_,i)=>file('batch'+i+'.jpg'));const plans=Object.fromEntries(files.map(f=>[f.name,[()=>new Promise(resolve=>pending.push(()=>resolve({url:'/uploads/'+f.name})))]]));const m=mount(plans,extra,browser);const finished=m.select(files);await new Promise(resolve=>setImmediate(resolve));assert.equal(m.requests.length,limit);assert.equal(m.prepared.length,Math.min(6,limit*2+2));while(m.requests.length<6||pending.length){pending.splice(0).forEach(resolve=>resolve());await new Promise(resolve=>setImmediate(resolve));}await finished;assert.equal(m.props.value.length,7);});
