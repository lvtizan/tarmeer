'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldApi } from '@/lib/adminApi';
import LoadingButton from '@/components/ui/LoadingButton';
import { verificationDraftPatch, finishVerificationDraft, createVerificationSaveQueue, clearVerificationPending, restoreVerificationPending, writeVerificationPending, focusVerificationField, parseVerificationData, resolveVerificationIssue, verificationFieldIssue, verificationIssueFocusKey, safeEvidenceUrl, verificationSignInUrl, verificationUnauthorized, validateVerification, visibleField, type VerificationData, type VerificationEvidence, type VerificationField, type VerificationRecord, type VerificationSchema, type VerificationValue, type VerificationIssue } from '@/lib/verification';
import { VerificationFields } from './verification-field';

const gold='rounded-xl bg-[#b8864a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a07640] disabled:opacity-40';
const secondary='rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-40';
function parseEvidence(raw:VerificationRecord['attachments']):VerificationEvidence[] {const parsed=typeof raw==='string'?JSON.parse(raw):raw;if(parsed==null)return [];if(!Array.isArray(parsed))throw Error('Saved attachments are invalid.');return parsed;}
function ReviewValue({value}:{value:VerificationValue|undefined}) {if(value===undefined||value==='')return <span className="text-stone-400">—</span>;if(Array.isArray(value))return <span>{value.map(v=>typeof v==='string'?v:Object.entries(v).map(([k,x])=>`${k}: ${String(x)}`).join(', ')).join(' · ')}</span>;return <span>{value}</span>;}
export function VerificationErrorSummary({issues,onLocate}:{issues:VerificationIssue[];onLocate:(issue:VerificationIssue)=>void}) {
  return <ul className="mt-3 space-y-2">{issues.map(issue=><li key={issue.key}><button type="button" className="rounded text-left font-medium underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#b8864a]" onClick={()=>onLocate(issue)}>{issue.message.startsWith(`${issue.label}:`)||issue.message.startsWith(`${issue.label} is required`)?issue.message:`${issue.label}: ${issue.message}`}</button></li>)}</ul>;
}
export default function VerificationSurvey({schema,record,editingId}:{schema:VerificationSchema;record:VerificationRecord;editingId:number|null}) {
  const identity={id:record.id,country:schema.country,version:schema.version};
  const [recovered]=useState(()=>{
    const serverData=parseVerificationData(record.verification_data);const serverEvidence=parseEvidence(record.attachments);
    try {return {...restoreVerificationPending(localStorage,identity,serverData,serverEvidence,new Map(schema.sections.flatMap(section=>section.fields.map(field=>[field.key,field] as const)))),warning:''};}
    catch(error){return {data:serverData,evidence:serverEvidence,pending:null,warning:`Local recovery is unavailable: ${error instanceof Error?error.message:'Invalid saved data'}. Previously unsaved changes may be unavailable.`};}
  });
  const [data,setData]=useState<VerificationData>(recovered.data);
  const [evidence,setEvidence]=useState<VerificationEvidence[]>(recovered.evidence);
  const [storageWarning,setStorageWarning]=useState(recovered.warning);
  const [backendIssue,setBackendIssue]=useState<VerificationIssue|null>(null);
  const [focusRequest,setFocusRequest]=useState<{key:string;id:number}|null>(null);
  const [step,setStep]=useState(0); const [errors,setErrors]=useState<Record<string,string>>({});
  const [message,setMessage]=useState(''); const [needsSignIn,setNeedsSignIn]=useState(false); const [saveState,setSaveState]=useState(recovered.pending?(editingId?'Changes restored; pending submission':'Local changes restored; pending server save'):'Saved');
  const [busy,setBusy]=useState(false); const [complete,setComplete]=useState(false);
  const current=useRef({data,evidence});
  const consumedFocus=useRef(0);
  const [saveQueue]=useState(createVerificationSaveQueue);const dirty=useRef(!!recovered.pending);const revision=useRef(recovered.pending?.revision||0);const busyRef=useRef(false);
  const changedKeys=useRef(new Set(recovered.pending?.changedKeys||[]));const evidenceChanged=useRef(recovered.pending?.evidenceChanged||false);const cacheWriteId=useRef(recovered.pending?.writeId);
  const removedEvidenceUrls=useRef(new Set(recovered.pending?.removedEvidenceUrls||(recovered.pending?.evidenceChanged?parseEvidence(record.attachments).filter(file=>!recovered.evidence.some(item=>item.url===file.url)).map(file=>file.url):[])));
  useEffect(()=>{if(!focusRequest||busy||consumedFocus.current>=focusRequest.id)return;if(focusVerificationField(document,focusRequest.key))consumedFocus.current=focusRequest.id;},[focusRequest,step,busy]);
  const section=schema.sections[step]; const last=step===schema.sections.length-1;
  function persistLocal(){
    const writeId=crypto.randomUUID();
    try {writeVerificationPending(localStorage,{identity,data:current.current.data,evidence:current.current.evidence,changedKeys:[...changedKeys.current],evidenceChanged:evidenceChanged.current,removedEvidenceUrls:[...removedEvidenceUrls.current],revision:revision.current,writeId});cacheWriteId.current=writeId;setStorageWarning('');setSaveState(editingId?'Saved on this device; pending submission':'Saved on this device; pending server save');}
    catch(error){setStorageWarning(`Unable to save recovery data on this device: ${error instanceof Error?error.message:'Storage unavailable'}. Keep this page open until the server save succeeds.`);}
  }
  const payload=useCallback(()=>{
    const value=current.current;const companyField=schema.sections.flatMap(s=>s.fields).find(f=>f.role==='company_name');
    return {country:schema.country,schema_version:schema.version,verification_data:value.data,attachments:value.evidence,
      company_name:companyField&&typeof value.data[companyField.key]==='string'?value.data[companyField.key]:record.company_name||'',
      company_ref_id:record.company_ref_id??null,company_ref_source:record.company_ref_source??null};
  },[schema,record]);
  const save=useCallback(async()=>{
    if(editingId)return;
    if(!dirty.current)return;
    const rev=revision.current;const existing=saveQueue.existing(rev);if(existing)return existing;
    const snapshot={country:schema.country,schema_version:schema.version,...verificationDraftPatch(schema,current.current.data,changedKeys.current,removedEvidenceUrls.current)};
    const writeId=cacheWriteId.current;setSaveState('Saving to server…');
    const operation=saveQueue.run(rev,()=>fieldApi.saveDraft(record.id,snapshot));
    try{await operation;if(rev===revision.current){dirty.current=false;changedKeys.current.clear();evidenceChanged.current=false;removedEvidenceUrls.current.clear();try{if(writeId!==undefined)clearVerificationPending(localStorage,{id:record.id,country:schema.country,version:schema.version},writeId);setStorageWarning('');}catch{setStorageWarning('Saved to server, but local recovery data could not be cleared.');}setSaveState('Saved to server');}setMessage('');setBackendIssue(null);setNeedsSignIn(false);}
    catch(error){setNeedsSignIn(verificationUnauthorized(error));setBackendIssue(resolveVerificationIssue(schema,current.current.data,error));setSaveState('Server save failed; local changes pending');setMessage(error instanceof Error?error.message:'Save failed. Please retry.');throw error;}
  },[editingId,record.id,schema,saveQueue]);
  const flushSave=useCallback(()=>saveQueue.flush(()=>{if(!busyRef.current)void save().catch(()=>{});}),[save,saveQueue]);
  useEffect(()=>{if(!dirty.current||busy)return;const timer=setTimeout(()=>{void save().catch(()=>{});},700);return()=>clearTimeout(timer);},[data,evidence,busy,save]);
  useEffect(()=>{const onLeave=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',onLeave);return()=>window.removeEventListener('beforeunload',onLeave);},[]);
  function change(key:string,value:VerificationValue,immediate=false){changedKeys.current.add(key);if(backendIssue?.key===key){setBackendIssue(null);setMessage('');}dirty.current=true;revision.current++;setSaveState(editingId?'Changes pending submission':'Unsaved changes');const next={...current.current.data,[key]:value};current.current={...current.current,data:next};setData(next);persistLocal();if(immediate)flushSave();setErrors(old=>{const next={...old};delete next[key];return next;});}
  function validateOnBlur(key:string){flushSave();const invalid=validateVerification(schema,current.current.data);setErrors(previous=>{const next={...previous};if(invalid[key])next[key]=invalid[key];else delete next[key];return next;});}
  function inputInvalid(key:string,detail:string){setErrors(previous=>({...previous,[key]:detail}));}
  async function upload(field:VerificationField,files:FileList){
    if(busyRef.current)return;
    const selected=Array.from(files);const allowed=field.accept?.split(',').map(v=>v.trim());
    for(const file of selected){if((field.maxBytes&&file.size>field.maxBytes)||(allowed&&!allowed.includes(file.type))){const detail=`Invalid attachment: ${file.name}. Check the allowed format and size.`;setMessage(detail);setBackendIssue(verificationFieldIssue(schema,field.key,detail));return;}}
    busyRef.current=true;setBusy(true);setMessage('');setBackendIssue(null);
    try{await saveQueue.wait().catch(()=>{});for(const file of selected){const result=await fieldApi.uploadAttachment(editingId||record.id,file,field.key);const next={...result,field_key:field.key};current.current={...current.current,evidence:[...current.current.evidence,next]};setEvidence(current.current.evidence);dirty.current=true;revision.current++;persistLocal();}}
    catch(error){setBackendIssue(resolveVerificationIssue(schema,current.current.data,error,field.key));setNeedsSignIn(verificationUnauthorized(error));setMessage(error instanceof Error?error.message:'Upload failed. Please retry.');}
    finally{busyRef.current=false;setBusy(false);flushSave();}
  }
  function removeEvidence(index:number){const removed=current.current.evidence[index];if(removed)removedEvidenceUrls.current.add(removed.url);dirty.current=true;revision.current++;setSaveState('Unsaved changes');const next=current.current.evidence.filter((_,i)=>i!==index);current.current={...current.current,evidence:next};setEvidence(next);evidenceChanged.current=true;persistLocal();flushSave();}
  function locate(issue:VerificationIssue){const key=verificationIssueFocusKey(schema,current.current.data,issue);const target=verificationFieldIssue(schema,key,issue.message);setStep(target?.step??issue.step);setFocusRequest(previous=>({key,id:(previous?.id||0)+1}));}
  function navigate(next:number){setStep(next);window.scrollTo({top:0,behavior:'smooth'});}
  async function submit(){
    if(busyRef.current)return;
    const invalid=validateVerification(schema,current.current.data);setErrors(invalid);
    if(Object.keys(invalid).length){const first=verificationFieldIssue(schema,Object.keys(invalid)[0],invalid[Object.keys(invalid)[0]]);if(first)locate(first);setBackendIssue(null);setMessage('Please correct the highlighted fields before submitting.');return;}
    const unsupported=schema.sections.flatMap(s=>s.fields).find(f=>!['text','number','tel','url','email','date','textarea','checkbox','radio','select','repeat','attachment'].includes(f.type));
    if(unsupported){setMessage('The form contains an unsupported field. Contact an administrator.');return;}
    const submissionWriteId=cacheWriteId.current;
    busyRef.current=true;setBusy(true);setMessage('');
    try{await saveQueue.wait().catch(()=>{});if(editingId)await fieldApi.reSubmit(editingId,payload());else{await save();await fieldApi.submit(record.id);}dirty.current=false;try{finishVerificationDraft(localStorage,identity,submissionWriteId,!editingId);}catch{setStorageWarning('Record submitted, but local recovery cleanup failed.');}setComplete(true);if(!editingId)fieldApi.clearDraftAccess(record.id);}
    catch(error){setBackendIssue(resolveVerificationIssue(schema,current.current.data,error));setNeedsSignIn(verificationUnauthorized(error));setMessage(error instanceof Error?error.message:'Submission failed. Your answers are still available.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  function exportRecord(){const blob=new Blob([JSON.stringify({id:record.id,...payload(),schema_snapshot:schema},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Tarmeer_Verification_${record.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const fieldErrors={...errors,...(backendIssue?{[backendIssue.key]:backendIssue.message}:{})};
  const issues=Object.entries(fieldErrors).map(([key,detail])=>verificationFieldIssue(schema,key,detail)).filter((issue):issue is VerificationIssue=>!!issue);
  if(complete)return <div className="flex min-h-screen items-center justify-center px-4"><div className="max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Interview Submitted</h1><p className="my-4 text-stone-600">Your verification record was saved successfully.</p><button className={gold} onClick={()=>{window.location.href='/field/survey';}}>Start New Interview</button></div></div>;
  return <div className="min-h-screen bg-[#faf9f7] pb-36 text-stone-900">
    <style>{`@media print { .verification-controls {display:none!important} .verification-layout {display:block!important} .verification-review {display:block!important} .verification-current {display:none!important} body{background:white} .verification-review section{break-inside:avoid} }`}</style>
    <header className="verification-controls sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-8"><div className="min-w-0 flex-1"><div className="font-semibold tracking-widest text-[#8b6537]">TARMEER</div><div className="truncate text-xs text-stone-500">{schema.title||'Field verification'}{editingId?' · Editing submitted record':''}</div></div><span role="status" aria-live="polite" className={`max-w-[55%] shrink-0 text-right text-xs ${saveState.includes('failed')?'text-red-700':'text-stone-500'}`}>{saveState}</span></header>
    <div className="verification-layout mx-auto grid max-w-7xl items-start gap-6 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 lg:py-8">
      <aside className="verification-controls min-w-0 lg:sticky lg:top-24"><nav aria-label="Verification steps" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">{schema.sections.map((item,index)=><button key={item.key} type="button" aria-current={step===index?'step':undefined} onClick={()=>navigate(index)} className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm lg:shrink ${step===index?'border-[#b8864a] bg-white text-[#8b6537]':'border-transparent text-stone-500'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step===index?'bg-[#b8864a] text-white':'bg-stone-200'}`}>{index+1}</span><span>{item.titleEn||item.title}</span></button>)}</nav><p className="mt-5 hidden text-sm text-stone-500 lg:block">Keep company claims separate from verified findings.</p></aside>
      <main className="min-w-0">
        {storageWarning&&<div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{storageWarning}</div>}
        {(message||issues.length>0)&&<div role="alert" className="verification-controls mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{!backendIssue&&message}{issues.length>0&&<VerificationErrorSummary issues={issues} onLocate={locate}/>}{needsSignIn&&<p className="mt-2">Your answers remain in this form. <a href={verificationSignInUrl(editingId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Sign in in a new tab</a>, then return here and retry the save, upload or submission.</p>}<button type="button" className={`${secondary} ml-2`} disabled={busy} onClick={()=>editingId?void submit():void save().catch(()=>{})}>{editingId?'Retry submission':'Retry save'}</button></div>}
        <div className="verification-controls mb-6"><div className="mb-3 flex items-start justify-between gap-3"><h1 className="text-2xl font-semibold sm:text-3xl">{section.titleEn||section.title}</h1><span className="shrink-0 text-sm text-stone-500">{step+1} / {schema.sections.length}</span></div><div className="h-1 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-[#b8864a]" style={{width:`${(step+1)/schema.sections.length*100}%`}}/></div>{section.description&&<p className="mt-3 text-sm text-stone-500">{section.description}</p>}</div>
        {(!last||section.fields.length>0)&&<form className="verification-current" onSubmit={e=>e.preventDefault()} noValidate><VerificationFields fields={section.fields} data={data} errors={fieldErrors} onChange={change} onValidate={validateOnBlur} onInvalid={inputInvalid} evidence={evidence} onUpload={upload} onRemoveEvidence={removeEvidence} disabled={busy} focusKey={focusRequest?.key}/></form>}
        <div className={`verification-review space-y-5 ${last?'':'hidden'}`}><div className="verification-controls flex flex-wrap gap-2"><button type="button" className={secondary} onClick={exportRecord}>Export JSON</button><button type="button" className={secondary} onClick={()=>window.print()}>Print / PDF</button></div>{schema.sections.filter(s=>s.fields.length).map(item=><section key={item.key} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{item.titleEn||item.title}</h2><button type="button" className={`${secondary} verification-controls`} onClick={()=>navigate(schema.sections.indexOf(item))}>Edit</button></div><dl className="grid min-w-0 gap-4 sm:grid-cols-2">{item.fields.filter(f=>visibleField(f,data)).map(f=><div key={f.key} className="min-w-0"><dt className="mb-1 text-xs text-stone-500">{f.labelEn||f.label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{f.type==='attachment'?evidence.filter(e=>e.field_key===f.key).map((e,i)=><div key={i}>{safeEvidenceUrl(e.url)?<a href={safeEvidenceUrl(e.url)} target="_blank" rel="noopener noreferrer" className="text-[#8b6537] underline">{e.name}</a>:e.name}</div>):<ReviewValue value={data[f.key]}/>}</dd></div>)}</dl></section>)}</div>
      </main>
    </div>
    <footer className="verification-controls fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white px-4 pt-3" style={{paddingBottom:'max(12px,env(safe-area-inset-bottom))'}}><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2"><button type="button" className={secondary} disabled={busy||step===0} onClick={()=>navigate(step-1)}>Back</button><div className="flex flex-wrap gap-2">{!editingId&&<button type="button" className={secondary} disabled={busy} onClick={()=>void save().catch(()=>{})}>Save draft</button>}<LoadingButton className={gold} loading={busy} onClick={()=>last?void submit():navigate(step+1)}>{last?'Submit verification':'Next'}</LoadingButton></div></div></footer>
  </div>;
}
