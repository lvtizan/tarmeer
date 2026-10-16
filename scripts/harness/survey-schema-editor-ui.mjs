import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
let count=0;const check=(name,fn)=>{fn();console.log('PASS '+name);count++;};
function mount({authenticated=true,canEdit=true,flush=async()=>{},mutation,recover=async()=>456,contextFailure,contextRequest}={}){
 const hooks=[],effects=[],calls=[],changes=[],busyChanges=[];let cursor=0,tree,context,contextCount=0;
 const schema={version:'tarmeer-verification-v7',country:'ae',sections:[]};
 const dialog={showModal(){calls.push('show');},close(){calls.push('close');}};
 const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useRef(initial){return hooks[cursor++]||={current:initial};},createContext(){return{Provider:'provider'};},useContext(){return context;},useEffect(fn,deps){const i=cursor++;const old=hooks[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){old?.cleanup?.();hooks[i]={deps};effects.push(()=>{hooks[i].cleanup=fn();});}}};
 const api={getSchemaEditorContext:async(country,draftId)=>{calls.push('context');contextCount++;if(contextRequest)return contextRequest({country,draftId,count:contextCount,schema});if(contextFailure)throw contextFailure;return{canEdit,revision:'published',draftRevision:'draft',schema};},editSchemaField:async body=>{calls.push(body);if(mutation)return mutation(body);return{schema,revision:'next',draftRevision:'nextDraft'};}};
 const exports={};vm.runInNewContext(ts.transpileModule(read('src/components/field/survey-schema-editor.tsx'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Error,localStorage:{},require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};if(name==='lucide-react')return{};if(name.endsWith('/adminApi'))return{fieldApi:api};if(name.endsWith('/verification'))return{captureVerificationAuth:()=>authenticated?{}:null};throw Error(name);}});
 function jsx(type,props){if(props?.ref && type==='dialog')props.ref.current=dialog;if(props?.ref && type==='input')props.ref.current={focus(){}};return{type,props:props||{}};}
 const props={country:'ae',draftId:123,sectionKey:'section',enabled:true,disabled:false,onRecoverDraft:recover,beforeMutation:async()=>{calls.push('flush');await flush();},onSchemaChange:s=>changes.push(s),onBusyChange:b=>busyChanges.push(b),children:'form'};
 function render(){cursor=0;tree=exports.default(props);context=tree.props.value;effects.splice(0).forEach(fn=>fn());return nodes(tree);}
 const field={key:'phone',label:'Phone / WhatsApp',labelEn:'Phone / WhatsApp',type:'tel',required:true};
 function open(action,f=field,path=[f.key]){render();context.open({action,field:f,fieldPath:path});render();}
 const click=async name=>{const button=render().find(n=>n.type==='button'&&n.props.children===name);assert(button,'missing '+name);await button.props.onClick();await new Promise(r=>setImmediate(r));render();};
 render();return{render,open,click,calls,changes,busyChanges,field,props,setLabel(value){render().find(n=>n.type==='input').props.onChange({target:{value}});render();},label(f=field){context=tree.props.value;return nodes(exports.SurveyFieldLabel({field:f,fieldPath:[f.key],htmlFor:'input'}));}};
}
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const anon=mount({authenticated:false});await tick();
check('anonymous respondent has no editor request or controls',()=>{assert(!anon.calls.includes('context'));assert.equal(anon.label().filter(n=>n.type==='button').length,0);});
const staff=mount({canEdit:false});await tick();staff.render();
check('ordinary field staff have no label mutation controls',()=>assert.equal(staff.label().filter(n=>n.type==='button').length,0));
const admin=mount();await tick();admin.render();
check('authorized labels have rename and add; original fields have no delete',()=>assert.equal(admin.label().filter(n=>n.type==='button').length,2));
check('only custom fields have a trash button',()=>assert.equal(admin.label({...admin.field,custom:true}).filter(n=>n.type==='button').length,3));
admin.open('rename');admin.setLabel('Contact phone');await admin.click('Save');
check('rename flushes answers first then sends exact field path and concurrency tokens',()=>{const action=admin.calls.find(x=>typeof x==='object');assert.equal(action.action,'rename');assert.equal(action.label,'Contact phone');assert.equal(action.fieldPath[0],'phone');assert.equal(action.revision,'published');assert(admin.calls.indexOf('flush')<admin.calls.indexOf(action));});
check('successful mutation updates displayed draft schema without replacing answers',()=>{assert.equal(admin.changes.length,2);assert.deepEqual(admin.busyChanges,[true,false]);});
const add=mount();await tick();add.open('add',add.field,['contacts','phone']);add.setLabel('新联系人');await add.click('Save');
check('nested new text field uses section and full schema path',()=>{const body=add.calls.find(x=>typeof x==='object');assert.equal(body.action,'add');assert.equal(body.sectionKey,'section');assert.deepEqual(Array.from(body.fieldPath),['contacts','phone']);});
const del=mount();await tick();del.open('delete',{...del.field,custom:true});
check('delete opens a confirmation prompt before any mutation',()=>{assert(!del.calls.some(x=>typeof x==='object'));assert(del.render().some(n=>JSON.stringify(n.props.children)?.includes('Historical records and saved answers will be preserved.')));});
await del.click('Cancel');
check('cancelling deletion performs no mutation',()=>assert(!del.calls.some(x=>typeof x==='object')));
del.open('delete',{...del.field,custom:true});await del.click('Delete field');
check('confirm deletion sends delete without fabricated field name',()=>{const body=del.calls.find(x=>typeof x==='object');assert.equal(body.action,'delete');assert(!('label' in body));});
const blank=mount();await tick();blank.open('add');blank.setLabel('  ');await blank.click('Save');
check('blank field name fails inline before save or schema write',()=>{assert(!blank.calls.includes('flush'));assert(blank.render().some(n=>n.props.role==='alert'));});
const failed=mount({flush:async()=>{throw Error('Answer save failed');}});await tick();failed.open('add');failed.setLabel('New field');await failed.click('Save');
check('autosave failure blocks schema mutation and keeps explicit error',()=>{assert(!failed.calls.some(x=>typeof x==='object'));assert(failed.render().some(n=>n.props.children==='Answer save failed'));});
let conflictMutation=0;
const conflict=mount({contextRequest:async({count,schema})=>({canEdit:true,revision:count===1?'published':'published-fresh',draftRevision:count===1?'draft':'draft-fresh',schema}),mutation:async body=>{conflictMutation++;if(conflictMutation===1)throw Object.assign(Error('Schema changed'),{status:409});return{schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]},revision:'published-next',draftRevision:'draft-next',body};}});await tick();conflict.open('rename');conflict.setLabel('8888888');await conflict.click('Save');
check('conflict cannot silently overwrite schema and offers explicit reload',()=>assert(conflict.render().some(n=>n.props.children==='Reload field settings')));
await conflict.click('Reload field settings');
check('reload refreshes revisions without replaying the mutation or discarding its label',()=>{assert.equal(conflict.calls.filter(x=>typeof x==='object').length,1);assert.equal(conflict.render().find(n=>n.type==='input').props.value,'8888888');assert(conflict.render().some(n=>n.props.children==='Save'));});
await conflict.click('Save');
check('manual retry uses the refreshed revisions and preserved label',()=>{const actions=conflict.calls.filter(x=>typeof x==='object');assert.equal(actions.length,2);assert.equal(actions[1].label,'8888888');assert.equal(actions[1].revision,'published-fresh');assert.equal(actions[1].draftRevision,'draft-fresh');});
const oldContext=deferred(),latestContext=deferred();
const contextRace=mount({contextRequest:({count})=>count===1?oldContext.promise:latestContext.promise});
contextRace.props.draftId=124;contextRace.render();
latestContext.resolve({canEdit:true,revision:'latest-published',draftRevision:'latest-draft',schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]}});await tick();contextRace.render();
oldContext.resolve({canEdit:true,revision:'stale-published',draftRevision:'stale-draft',schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]}});await tick();contextRace.render();
contextRace.open('rename');contextRace.setLabel('Generation safe');await contextRace.click('Save');
check('a late context response for an older draft cannot overwrite the latest access revisions',()=>{const action=contextRace.calls.find(x=>typeof x==='object');assert.equal(action.draftId,124);assert.equal(action.revision,'latest-published');assert.equal(action.draftRevision,'latest-draft');});
const staleContextError=deferred(),freshContext=deferred();
const contextErrorRace=mount({contextRequest:({count})=>count===1?staleContextError.promise:freshContext.promise});
contextErrorRace.props.draftId=125;contextErrorRace.render();
freshContext.resolve({canEdit:true,revision:'fresh-published',draftRevision:'fresh-draft',schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]}});await tick();contextErrorRace.render();
staleContextError.reject(Object.assign(Error('Old draft missing'),{status:404}));await tick();contextErrorRace.render();
check('a late 404 for an older draft cannot replace current editor access with recovery UI',()=>{assert(!contextErrorRace.render().some(n=>n.props.children==='Recover draft'));assert.equal(contextErrorRace.label().filter(n=>n.type==='button').length,2);});
const forbidden=mount({mutation:async()=>{throw Object.assign(Error('Forbidden'),{status:403});}});await tick();forbidden.open('rename');await forbidden.click('Save');
check('server permission rejection removes editing controls',()=>assert.equal(forbidden.label().filter(n=>n.type==='button').length,0));
const fieldSource=read('src/components/field/verification-field.tsx');
check('repeat rows pass full nested schema path and retain dynamic labels',()=>{assert(fieldSource.includes('fieldPath={[...path,child.key]}'));assert(fieldSource.includes('<SurveyFieldLabel field={field}'));});
check('permission management provides create, edit and badge with default off',()=>{const source=read('src/app/admin/admins/page.tsx');assert(source.includes('checked={createData.permissions.can_edit_survey_schema}'));assert(source.includes('checked={editPermissions.can_edit_survey_schema}'));assert(source.includes('can_edit_survey_schema: false'));});
const helpers={};vm.runInNewContext(ts.transpileModule(read('src/lib/verification.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:helpers});
const repeat={key:'team',label:'Team',type:'repeat',fields:[{key:'name',label:'Member name',type:'text'},{key:'custom_hidden',label:'Hidden note',type:'text',custom:true,retired:true}]};
const stored=[{name:'Ali',custom_hidden:'Keep this historical answer'}];
check('repeat review uses schema labels and excludes retired child answers without altering data',()=>{assert.equal(helpers.verificationReviewText(stored,repeat),'Member name: Ali');assert.equal(stored[0].custom_hidden,'Keep this historical answer');});
check('retired fields are hidden from live form and required validation',()=>{const f={key:'old',label:'Old',type:'text',retired:true,required:true};assert.equal(helpers.visibleField(f,{}),false);assert.equal(Object.keys(helpers.validateVerification({sections:[{key:'s',title:'',fields:[f]}]},{})).length,0);});
const apiExports={},requestLog=[];const sessions=new Map([['admin_token','admin-session'],['field_token','field-session']]);
vm.runInNewContext(ts.transpileModule(read('src/lib/adminApi.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:apiExports,process:{env:{}},window:{},URLSearchParams,localStorage:{getItem:k=>sessions.get(k)||null},fetch:async(url,options)=>{requestLog.push({url,options});return{ok:true,json:async()=>({})};},require(name){if(name.endsWith('/storage'))return{safeGetItem:k=>sessions.get(k),safeSetItem(){},safeRemoveItem(){}};throw Error(name);}});
await apiExports.fieldApi.getSchemaEditorContext('ae',123);await apiExports.fieldApi.editSchemaField({country:'ae',draftId:123,action:'rename'});await apiExports.fieldApi.saveDraft(123,{verification_data:{}});
check('dual sessions use admin token for editor GET/PATCH and retain field token for ordinary draft saves',()=>{assert.equal(requestLog[0].options.headers.Authorization,'Bearer admin-session');assert.equal(requestLog[0].options.cache,'no-store');assert.equal(requestLog[1].options.headers.Authorization,'Bearer admin-session');assert.equal(requestLog[2].options.headers.Authorization,'Bearer field-session');});
sessions.delete('admin_token');await apiExports.fieldApi.getSchemaEditorContext('ae',123);
check('admin logged in through field portal can still request editor access when no main admin session exists',()=>assert.equal(requestLog.at(-1).options.headers.Authorization,'Bearer field-session'));
check('editor controls and dialogs contain no hardcoded Chinese UI copy',()=>assert(!/[\u3400-\u9fff]/.test(read('src/components/field/survey-schema-editor.tsx'))));
check('mobile editor actions are visible without hover and desktop actions retain hover/focus discovery',()=>{
 const controls=admin.label().find(n=>n.props.className?.includes('transition-opacity'));
 assert(controls.props.className.includes('opacity-100'));
 assert(controls.props.className.includes('sm:opacity-0'));
 assert(controls.props.className.includes('group-focus-within/field-label:opacity-100'));
 assert(controls.props.className.includes('[@media(hover:none)]:opacity-100'));
});
check('mobile editor targets are at least 44px and long field names can wrap',()=>{
 for(const button of admin.label({...admin.field,custom:true}).filter(n=>n.type==='button')){
  assert(button.props.className.includes('min-h-11'));assert(button.props.className.includes('min-w-11'));
 }
 assert(admin.label().find(n=>n.type==='label').props.className.includes('[overflow-wrap:anywhere]'));
});
check('each edit action displays its English tooltip on hover and keyboard focus',()=>{
 const actions=admin.label({...admin.field,custom:true}).filter(n=>n.type==='button');
 assert.deepEqual(actions.map(n=>n.props['data-tooltip']),['Rename field','Add text field','Delete added field']);
 for(const action of actions){assert.equal(action.props.title,undefined);assert(action.props.className.includes('after:content-[attr(data-tooltip)]'));assert(action.props.className.includes('hover:after:opacity-100'));assert(action.props.className.includes('focus-visible:after:opacity-100'));assert(action.props.className.includes('after:pointer-events-none'));}
});
const fieldExports={};let pickerClicks=0;const uploads=[],removals=[];
const jsxField=(type,props)=>{if(type==='input'&&props.ref)props.ref.current={click(){pickerClicks++;}};return{type,props:props||{}};};
vm.runInNewContext(ts.transpileModule(fieldSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:fieldExports,require(name){
 if(name==='react')return{useRef:()=>({current:null}),useState:initial=>[initial,()=>{}]};
 if(name==='react/jsx-runtime')return{jsx:jsxField,jsxs:jsxField};
 if(name.endsWith('/verification'))return helpers;
 if(name==='./survey-schema-editor')return{SurveyFieldLabel:'field-label'};
 if(name.endsWith('/FormInput'))return{};
 if(name.endsWith('/ChipSelect'))return{default:'chip-select'};
 throw Error(name);
}});
const attachment={key:'office_evidence',label:'Office Evidence',type:'attachment',accept:'.pdf,image/*',maxBytes:15*1024*1024};
const uploadProps={field:attachment,data:{},evidence:[],onChange(){},onUpload:(field,files)=>uploads.push({field,files}),onRemoveEvidence:index=>removals.push(index)};
const uploadTree=nodes(fieldExports.default(uploadProps));const choose=uploadTree.find(n=>n.type==='button'&&n.props.children==='Choose files');const picker=uploadTree.find(n=>n.type==='input'&&n.props.type==='file');
check('English upload button replaces native filename and empty-selection UI',()=>{assert(choose);assert.equal(picker.props.className,'hidden');assert.equal(choose.props['aria-label'],'Choose files for Office Evidence');assert.equal(choose.props.type,'button');assert.equal(choose.props.id,'verification-root-office_evidence');assert.equal(picker.props.multiple,true);assert.equal(picker.props.accept,attachment.accept);});
choose.props.onClick();
check('Choose files opens the native picker from a direct button action',()=>assert.equal(pickerClicks,1));
const fileList={0:{name:'office.pdf'},length:1};const selection={target:{files:fileList,value:'office.pdf'}};picker.props.onChange(selection);
check('selecting files forwards field and FileList and clears picker for same-file selection',()=>{assert.equal(uploads.length,1);assert.equal(uploads[0].field,attachment);assert.equal(uploads[0].files,fileList);assert.equal(selection.target.value,'');});
picker.props.onChange({target:{files:{length:0},value:''}});picker.props.onChange({target:{files:null,value:''}});
check('cancelling file selection performs no upload',()=>assert.equal(uploads.length,1));
picker.props.onChange({target:{files:fileList,value:'office.pdf'}});
check('selecting the same file again can start a new upload',()=>assert.equal(uploads.length,2));
const disabledTree=nodes(fieldExports.default({...uploadProps,disabled:true,error:'Upload failed'}));
check('busy/disabled attachment blocks both controls and retains linked errors',()=>{
 const button=disabledTree.find(n=>n.type==='button');assert.equal(button.props.disabled,true);assert.equal(disabledTree.find(n=>n.type==='input').props.disabled,true);assert.equal(button.props['aria-describedby'],'verification-root-office_evidence-error');assert(disabledTree.some(n=>n.props.id==='verification-root-office_evidence-error'));
});
const evidenceTree=nodes(fieldExports.default({...uploadProps,evidence:[{field_key:attachment.key,name:'office.pdf',url:'/uploads/field/office.pdf'}]}));
check('uploaded filenames and remove actions remain available',()=>{assert(evidenceTree.some(n=>n.type==='a'&&n.props.children==='office.pdf'));evidenceTree.find(n=>n.type==='button'&&n.props.children==='Remove').props.onClick();assert.deepEqual(removals,[0]);});
const missing=mount({mutation:async()=>{throw Object.assign(Error('Editable survey draft not found.'),{status:404});},recover:async()=>{missing.props.draftId=456;return 456;}});await tick();missing.open('add');missing.setLabel('Additional contact');await missing.click('Save');
check('missing draft offers explicit recovery and keeps the entered field name',()=>{assert(missing.render().some(n=>n.props.children==='Recover draft'));assert.equal(missing.render().find(n=>n.type==='input').props.value,'Additional contact');});
await missing.click('Recover draft');
check('recovering the draft reloads editor access without replaying the mutation',()=>{assert.equal(missing.calls.filter(x=>typeof x==='object').length,1);assert.equal(missing.render().find(n=>n.type==='input').props.value,'Additional contact');assert(missing.render().some(n=>n.props.children==='Save'));});
const initialMissing=mount({contextFailure:Object.assign(Error('Not found'),{status:404})});await tick();
check('a draft missing during editor initialization has a recovery entry',()=>assert(initialMissing.render().some(n=>n.props.children==='Recover draft')));
const explicitRecoveryContext=deferred(),effectRecoveryContext=deferred();let recoveryRace;
recoveryRace=mount({contextRequest:({count,schema})=>{if(count===1)throw Object.assign(Error('Not found'),{status:404});return count===2?explicitRecoveryContext.promise:effectRecoveryContext.promise;},recover:async()=>{recoveryRace.props.draftId=456;return 456;}});await tick();
recoveryRace.render().find(n=>n.type==='button'&&n.props.children==='Recover draft').props.onClick();await tick();
recoveryRace.render();
effectRecoveryContext.resolve({canEdit:true,revision:'recovered-latest',draftRevision:'recovered-draft-latest',schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]}});await tick();recoveryRace.render();
explicitRecoveryContext.resolve({canEdit:true,revision:'recovered-stale',draftRevision:'recovered-draft-stale',schema:{version:'tarmeer-verification-v7',country:'ae',sections:[]}});await tick();recoveryRace.render();
recoveryRace.open('rename');recoveryRace.setLabel('Recovered race');await recoveryRace.click('Save');
check('the recovery effect GET wins over its older explicit GET when the new draft renders',()=>{const action=recoveryRace.calls.find(x=>typeof x==='object');assert.equal(recoveryRace.calls.filter(x=>x==='context').length,3);assert.equal(action.draftId,456);assert.equal(action.revision,'recovered-latest');assert.equal(action.draftRevision,'recovered-draft-latest');});
const deniedRecovery=mount({mutation:async()=>{throw Object.assign(Error('Forbidden'),{status:403});}});await tick();deniedRecovery.open('add');deniedRecovery.setLabel('New');await deniedRecovery.click('Save');
check('permission failures never offer draft replacement',()=>assert(!deniedRecovery.render().some(n=>n.props.children==='Recover draft')));
function surveyMount({loadError=Object.assign(Error('Missing'),{status:404}),evidence=[],createError,storageError=false}={}){
 const hooks=[],storage=new Map(),calls=[];let cursor=0,tree;
 const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useRef(initial){const i=cursor++;return hooks[i]||={current:initial};},useEffect(){cursor++;},useCallback(fn){cursor++;return fn;}};
 const localStorage={getItem:k=>storage.get(k)||null,setItem(k,v){if(storageError)throw Error('Storage unavailable');storage.set(k,v);},removeItem:k=>storage.delete(k)};
 const api={clearDraftAccess:id=>calls.push({clearAccess:id}),getDraft:async()=>{calls.push('load');throw loadError;},createDraft:async body=>{calls.push({create:body});if(createError)throw createError;return{id:456,country:'ae',schema_version:'tarmeer-verification-v7'};},saveDraft:async(id,body)=>{calls.push({save:id,body});}};
 const exports={};vm.runInNewContext(ts.transpileModule(read('src/components/field/verification-survey.tsx'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,localStorage,crypto:{randomUUID:()=> 'test-write-id'},setTimeout,clearTimeout,require(name){
  if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name.endsWith('/adminApi'))return{fieldApi:api};if(name.endsWith('/verification'))return helpers;
  if(name==='./survey-schema-editor')return{default:'schema-editor'};if(name==='./verification-field')return{VerificationFields:'fields'};
  if(name.endsWith('/LoadingButton'))return{default:'loading-button'};throw Error(name);
 }});
 const schema={version:'tarmeer-verification-v7',country:'ae',sections:[{key:'s',title:'Details',fields:[{key:'name',label:'Name',type:'text'}]}]};
 const record={id:123,country:'ae',schema_version:schema.version,verification_data:{name:'Ali'},attachments:evidence};
 function render(){cursor=0;tree=exports.default({schema,record,editingId:null});return nodes(tree);}
 function editor(){return render().find(n=>n.type==='schema-editor');}
 render();return{editor,render,calls,storage};
}
const recoveredSurvey=surveyMount();await recoveredSurvey.editor().props.onRecoverDraft();
check('confirmed 404 creates one same-country/version draft and switches all survey operations to its id',()=>{assert.equal(recoveredSurvey.calls.filter(c=>c.create).length,1);assert.equal(recoveredSurvey.calls.find(c=>c.create).create.country,'ae');assert.equal(recoveredSurvey.editor().props.draftId,456);assert.equal(recoveredSurvey.storage.get('field_draft_id_ae'),'456');});
check('draft recovery preserves in-memory answers and writes a new identity recovery cache',()=>{const fields=recoveredSurvey.render().find(n=>n.type==='fields');assert.equal(fields.props.data.name,'Ali');assert([...recoveredSurvey.storage.entries()].some(([k,v])=>k.includes('456')&&v.includes('Ali')));});
await recoveredSurvey.editor().props.beforeMutation();
check('next field edit flushes preserved answers to the new draft rather than the deleted id',()=>{const save=recoveredSurvey.calls.find(c=>c.save);assert.equal(save.save,456);assert.equal(save.body.verification_data.name,'Ali');});
for(const status of [401,403,500]){
 const unavailable=surveyMount({loadError:Object.assign(Error('Unavailable'),{status})});await assert.rejects(unavailable.editor().props.onRecoverDraft());
 check(`HTTP ${status} never creates a replacement draft`,()=>{assert(!unavailable.calls.some(c=>c.create));assert.equal(unavailable.editor().props.draftId,123);});
}
const withFiles=surveyMount({evidence:[{name:'office.pdf',url:'/uploads/field/a.pdf',type:'application/pdf'}]});await assert.rejects(withFiles.editor().props.onRecoverDraft());
check('recovery refuses to move existing attachments to a different draft identity',()=>{assert(!withFiles.calls.some(c=>c.create));assert.equal(withFiles.editor().props.draftId,123);});
const failedCreate=surveyMount({createError:Error('Creation failed')});await assert.rejects(failedCreate.editor().props.onRecoverDraft());
check('draft creation failure keeps the old identity and all answers available',()=>{assert.equal(failedCreate.editor().props.draftId,123);assert.equal(failedCreate.render().find(n=>n.type==='fields').props.data.name,'Ali');});
const noStorage=surveyMount({storageError:true});await noStorage.editor().props.onRecoverDraft();
check('storage failure preserves the live recovered draft and answers with an explicit warning',()=>{assert.equal(noStorage.editor().props.draftId,456);assert(noStorage.render().some(n=>n.props.role==='alert'&&JSON.stringify(n.props.children).includes('local recovery storage is unavailable')));assert.equal(noStorage.render().find(n=>n.type==='fields').props.data.name,'Ali');});
const migratedCache=surveyMount();migratedCache.render().find(n=>n.type==='fields').props.onChange('name','Updated name');
const oldCacheKey=[...migratedCache.storage.keys()].find(k=>k.includes('_123_'));assert(oldCacheKey);await migratedCache.editor().props.onRecoverDraft();
check('successful recovery clears only the migrated old cache and deleted-draft access token',()=>{assert(!migratedCache.storage.has(oldCacheKey));assert(migratedCache.calls.some(c=>c.clearAccess===123));assert([...migratedCache.storage.values()].some(v=>v.includes('Updated name')));});
const otherTabCache=surveyMount();otherTabCache.render().find(n=>n.type==='fields').props.onChange('name','This tab');
const newerKey=[...otherTabCache.storage.keys()].find(k=>k.includes('_123_'));const newer=JSON.parse(otherTabCache.storage.get(newerKey));newer.writeId='another-tab';otherTabCache.storage.set(newerKey,JSON.stringify(newer));await otherTabCache.editor().props.onRecoverDraft();
check('recovery never clears a newer old-identity cache written by another tab',()=>assert.equal(JSON.parse(otherTabCache.storage.get(newerKey)).writeId,'another-tab'));
console.log(`${count}/${count} PASS`);
