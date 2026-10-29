import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../../src/components/admin/SupplierEditModal.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source+'\nexport {ProductAddModal,ProductEditInlineModal};',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function fixture({ready=true,restored,upload,saveError,recovering=false}={}){
 let cursor=0;const states=[],calls=[],drafts=[];let restorePending=true;
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useRef(initial){const i=cursor++;return states[i]||=( {current:initial});},useEffect(){}};
 const jsx=(type,props)=>({type,props});const exports={};
 vm.runInNewContext(compiled,{exports,process:{env:{}},FormData,window:{},localStorage:{getItem:()=>null},require(name){
 if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};
 if(name==='@/contexts/AdminContext')return{useAdmin:()=>({admin:{id:7}})};
 if(name==='@/hooks/useSupplierDraft')return{useSupplierDraft:opts=>{drafts.push(opts);if(restored&&restorePending){restorePending=false;opts.restore(restored);}return{ready,recovering,save:async value=>{calls.push(['draft',value||opts.value]);if(saveError)throw Error(saveError);},complete:async()=>calls.push(['complete'])};}};
 if(name==='@/lib/uploadImageCompression')return{prepareImageForUpload:async file=>({file,originalName:'photo.webp'})};
 if(name==='@/lib/uploadRequest')return{xhrPost:()=>upload};
 if(name==='@/lib/adminApi')return{adminApi:{request:async(path,opts)=>{calls.push(['request',path,JSON.parse(opts.body)]);return{product:{id:9}};}}};
 if(name==='@/lib/supplierProductUnits')return{PRODUCT_UNITS:[],PRODUCT_CURRENCIES:[],formatProductPrice:()=>'',buildProductPriceSubmission:()=>({ok:true,payload:{price:10}})};
 if(name==='@/hooks/useUploadNavigationGuard')return{useUploadNavigationGuard:()=>{}};
 if(name==='@/components/ui/Toast')return{showToast:()=>{}};
 if(name==='@/components/ui/ConfirmModal')return{showConfirm:()=>{}};
 if(name==='lucide-react')return{X:'X',Package:'Package'};
 return{default:name};
 }});
 const render=(name,props)=>{cursor=0;return exports[name](props);};
 const nodes=tree=>tree?Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[]:[];
 return{calls,drafts,render,nodes};
}
const props={supplierId:4,country:'vn',categoryOptions:[],onClose(){},onAdded(){},onSaved(){},product:{id:9,title:'Original',description:'Kept description',specs:[{label:'Width',value:'20'}],certifications:['ISO'],application_scenes:['flooring']}};
test('inline product saves restored full shared draft and pending certification before clearing',async()=>{
 const f=fixture({restored:{title:'Draft title',description:'Draft description',extras:{specs:[{label:'Draft',value:'Yes'}],certifications:['ISO'],application_scenes:[],certificationInput:' New certification '}}});
 f.render('ProductEditInlineModal',props);const tree=f.render('ProductEditInlineModal',props);
 const save=f.nodes(tree).find(n=>n.type==='button'&&n.props.children==='保存');await save.props.onClick();
 assert.equal(f.drafts.at(-1).scope,'product-9');assert.equal(f.drafts.at(-1).country,'vn');
 assert.equal(f.calls[0][0],'draft');assert.equal(f.calls[1][2].title,'Draft title');assert.equal(f.calls[1][2].description,'Draft description');assert.deepEqual(Array.from(f.calls[1][2].certifications),['ISO','New certification']);assert.equal(f.calls[2][0],'complete');
});
test('quick add restores partial draft and submits image as draft with formal-save ordering',async()=>{
 const f=fixture({restored:{title:'Partial',imageUrl:'/uploads/draft.webp'}});f.render('ProductAddModal',props);const tree=f.render('ProductAddModal',props);
 const save=f.nodes(tree).find(n=>n.type==='button'&&n.props.children==='保存');await save.props.onClick();
 assert.equal(f.drafts.at(-1).scope,'quick-product-new');assert.equal(f.calls[0][1].titleEn,'');assert.equal(f.calls[1][2].image_url,'/uploads/draft.webp');assert.equal(f.calls[1][2].from_draft,true);assert.equal(f.calls[2][0],'complete');
});
test('unloaded draft disables product editing and cannot publish',async()=>{
 const f=fixture({ready:false});const tree=f.render('ProductEditInlineModal',props);const nodes=f.nodes(tree);
 assert.equal(nodes.find(n=>n.type==='fieldset').props.disabled,true);const save=nodes.find(n=>n.type==='button'&&n.props.children==='保存');assert.equal(save.props.disabled,true);await save.props.onClick();assert.equal(f.calls.length,0);
});

test('delayed quick upload saves latest text instead of its start snapshot',async()=>{
 let finish;const upload=new Promise(resolve=>finish=resolve);const f=fixture({upload});
 let tree=f.render('ProductAddModal',props);
 const input=f.nodes(tree).find(n=>n.type==='input'&&n.props.type==='file');
 input.props.onChange({target:{files:[new Blob(['image'],{type:'image/webp'})]}});
 // Simulate an already queued input event arriving while compression/upload is pending.
 f.nodes(tree).find(n=>n.props?.id==='quick-add-product-original-title').props.onChange({target:{value:'Latest queued text'}});
 f.render('ProductAddModal',props);
 await new Promise(resolve=>setImmediate(resolve));finish({url:'/uploads/late.webp'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls[0][1].title,'Latest queued text');assert.equal(f.calls[0][1].imageUrl,'/uploads/late.webp');
});

for (const component of ['ProductAddModal','ProductEditInlineModal']) {
 test(`${component} refuses close when latest draft flush fails`,async()=>{
  let closes=0;const f=fixture({saveError:'offline draft'});const tree=f.render(component,{...props,onClose(){closes++;}});
  const cancel=f.nodes(tree).find(n=>n.type==='button'&&n.props.children==='取消');await cancel.props.onClick();
  assert.equal(closes,0);assert.equal(f.calls[0][0],'draft');
 });
 test(`${component} flushes draft before close and allows initial load cancellation`,async()=>{
  let closes=0;const f=fixture();const tree=f.render(component,{...props,onClose(){assert.equal(f.calls.at(-1)[0],'draft');closes++;}});
  await f.nodes(tree).find(n=>n.type==='button'&&n.props.children==='取消').props.onClick();assert.equal(closes,1);
  const unloaded=fixture({ready:false});const loadingTree=unloaded.render(component,{...props,onClose(){closes++;}});
  await unloaded.nodes(loadingTree).find(n=>n.type==='button'&&n.props.children==='取消').props.onClick();assert.equal(closes,2);assert.equal(unloaded.calls.length,0);
 });
 test(`${component} blocks close during recovery`,async()=>{
  let closes=0;const f=fixture({recovering:true});const tree=f.render(component,{...props,onClose(){closes++;}});
  await f.nodes(tree).find(n=>n.type==='button'&&n.props.children==='取消').props.onClick();assert.equal(closes,0);assert.equal(f.calls.length,0);
 });
}
