'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldApi } from '@/lib/adminApi';
import LoadingButton from '@/components/ui/LoadingButton';
import { verificationReviewText, verificationDraftPatch, finishVerificationDraft, createVerificationSaveQueue, clearVerificationPending, restoreVerificationPending, writeVerificationPending, focusVerificationField, parseVerificationData, resolveVerificationIssue, verificationFieldIssue, verificationIssueFocusKey, safeEvidenceUrl, verificationSignInUrl, verificationUnauthorized, validateVerification, visibleField, type VerificationData, type VerificationEvidence, type VerificationField, type VerificationRecord, type VerificationSchema, type VerificationValue, type VerificationIssue } from '@/lib/verification';
import SurveySchemaEditor from './survey-schema-editor';
import { VerificationFields } from './verification-field';
import './contractor-survey.css';

const gold='rounded-xl bg-[#b8864a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a07640] disabled:opacity-40';
const secondary='rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-40';
function parseEvidence(raw:VerificationRecord['attachments']):VerificationEvidence[] {const parsed=typeof raw==='string'?JSON.parse(raw):raw;if(parsed==null)return [];if(!Array.isArray(parsed))throw Error('Saved attachments are invalid.');return parsed;}
function requiredEvidenceErrors(sections:VerificationSchema['sections'],data:VerificationData,evidence:VerificationEvidence[]){const errors:Record<string,string>={};for(const field of sections.flatMap(section=>section.fields).filter(field=>field.type==='attachment'&&field.required&&!field.retired)){if(visibleField(field,data)&&!evidence.some(item=>item.field_key===field.key))errors[field.key]='This attachment is required.';}return errors;}
function ReviewValue({value,field}:{value:VerificationValue|undefined;field?:VerificationField}) {const text=verificationReviewText(value,field);return text?<span>{text}</span>:<span className="text-stone-400">—</span>;}
export function VerificationErrorSummary({issues,onLocate}:{issues:VerificationIssue[];onLocate:(issue:VerificationIssue)=>void}) {
  return <ul className="mt-3 space-y-2">{issues.map(issue=><li key={issue.key}><button type="button" className="rounded text-left font-medium underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#b8864a]" onClick={()=>onLocate(issue)}>{issue.message.startsWith(`${issue.label}:`)||issue.message.startsWith(`${issue.label} is required`)?issue.message:`${issue.label}: ${issue.message}`}</button></li>)}</ul>;
}
export default function VerificationSurvey({schema:initialSchema,record:initialRecord,editingId}:{schema:VerificationSchema;record:VerificationRecord;editingId:number|null}) {
  const [record,setRecord]=useState(initialRecord);
  const [schema,setSchema]=useState(initialSchema);
  const workflow=initialSchema.workflow==='contractor-two-stage';
  const [contractorStage,setContractorStage]=useState<VerificationRecord['contractor_stage']>(initialRecord.contractor_stage||'qualification');
  const [reviewStatus,setReviewStatus]=useState<VerificationRecord['contractor_review_status']>(initialRecord.contractor_review_status||null);
  const [phase,setPhase]=useState<'qualification'|'profile'>(initialRecord.contractor_stage==='profile'||initialRecord.contractor_stage==='complete'?'profile':'qualification');
  const [schemaBusy,setSchemaBusy]=useState(false);
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
  const [review,setReview]=useState(false);
  const [step,setStep]=useState(0); const [errors,setErrors]=useState<Record<string,string>>({});
  const [message,setMessage]=useState(''); const [needsSignIn,setNeedsSignIn]=useState(false); const [saveState,setSaveState]=useState(recovered.pending?(editingId?'Changes restored; pending submission':'Local changes restored; pending server save'):'Saved');
  const [operationBusy,setBusy]=useState(false); const busy=operationBusy||schemaBusy; const [complete,setComplete]=useState(workflow&&initialRecord.contractor_stage==='complete'&&!editingId);
  const [waitingReview,setWaitingReview]=useState(workflow&&!editingId&&initialRecord.status==='submitted'&&(initialRecord.contractor_stage==='qualification'||initialRecord.contractor_stage==='profile'));
  const [profileReady,setProfileReady]=useState(workflow&&initialRecord.contractor_stage==='profile'&&initialRecord.contractor_review_status==='approved');
  const [statusMessage,setStatusMessage]=useState('');
  const current=useRef({data,evidence});
  const consumedFocus=useRef(0);
  const [saveQueue]=useState(createVerificationSaveQueue);const dirty=useRef(!!recovered.pending);const revision=useRef(recovered.pending?.revision||0);const busyRef=useRef(false);
  const changedKeys=useRef(new Set(recovered.pending?.changedKeys||[]));const evidenceChanged=useRef(recovered.pending?.evidenceChanged||false);const cacheWriteId=useRef(recovered.pending?.writeId);
  const removedEvidenceUrls=useRef(new Set(recovered.pending?.removedEvidenceUrls||(recovered.pending?.evidenceChanged?parseEvidence(record.attachments).filter(file=>!recovered.evidence.some(item=>item.url===file.url)).map(file=>file.url):[])));
  useEffect(()=>{if(!focusRequest||busy||consumedFocus.current>=focusRequest.id)return;if(focusVerificationField(document,focusRequest.key))consumedFocus.current=focusRequest.id;},[focusRequest,step,busy]);
  const allSections=schema.sections.filter(section=>section.fields.some(field=>!field.retired));
  const sections=allSections.filter(section=>!workflow||section.phase===phase);
  useEffect(()=>{const match=/^#survey-section-(\d+)$/.exec(window.location.hash);if(match){const index=Number(match[1]);if(index<sections.length){setStep(index);setTimeout(()=>document.getElementById(`survey-section-${index}`)?.scrollIntoView(),0);}}},[]);
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
    const operation=saveQueue.run(rev,()=>workflow&&phase==='profile'?fieldApi.saveContractorProfile(record.id,snapshot,schema.country):fieldApi.saveDraft(record.id,snapshot,schema.country));
    try{await operation;if(rev===revision.current){dirty.current=false;changedKeys.current.clear();evidenceChanged.current=false;removedEvidenceUrls.current.clear();try{if(writeId!==undefined)clearVerificationPending(localStorage,{id:record.id,country:schema.country,version:schema.version},writeId);setStorageWarning('');}catch{setStorageWarning('Saved to server, but local recovery data could not be cleared.');}setSaveState('Saved to server');}setMessage('');setBackendIssue(null);setNeedsSignIn(false);}
    catch(error){setNeedsSignIn(verificationUnauthorized(error));setBackendIssue(resolveVerificationIssue(schema,current.current.data,error));setSaveState('Server save failed; local changes pending');setMessage(error instanceof Error?error.message:'Save failed. Please retry.');throw error;}
  },[editingId,record.id,schema,saveQueue,workflow,phase]);
  const flushSave=useCallback(()=>saveQueue.flush(()=>{if(!busyRef.current)void save().catch(()=>{});}),[save,saveQueue]);
  useEffect(()=>{if(!dirty.current||busy)return;const timer=setTimeout(()=>{void save().catch(()=>{});},700);return()=>clearTimeout(timer);},[data,evidence,busy,save]);
  useEffect(()=>{const onLeave=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',onLeave);return()=>window.removeEventListener('beforeunload',onLeave);},[]);
  function change(key:string,value:VerificationValue,immediate=false){changedKeys.current.add(key);if(backendIssue?.key===key){setBackendIssue(null);setMessage('');}dirty.current=true;revision.current++;setSaveState(editingId?'Changes pending submission':'Unsaved changes');const next={...current.current.data,[key]:value};current.current={...current.current,data:next};setData(next);persistLocal();if(immediate)flushSave();setErrors(old=>{const next={...old};delete next[key];return next;});}
  function validateOnBlur(key:string){flushSave();const invalid=validateVerification(schema,current.current.data);setErrors(previous=>{const next={...previous};if(invalid[key])next[key]=invalid[key];else delete next[key];return next;});}
  function inputInvalid(key:string,detail:string){setErrors(previous=>({...previous,[key]:detail}));}
  async function upload(field:VerificationField,files:FileList){
    if(busyRef.current)return;
    const selected=Array.from(files);const allowed=field.accept?.split(',').map(v=>v.trim());
    if(field.maxItems && current.current.evidence.filter(file=>file.field_key===field.key).length+selected.length>field.maxItems){const detail=`Choose up to ${field.maxItems} files for this project.`;setMessage(detail);setBackendIssue(verificationFieldIssue(schema,field.key,detail));return;}
    for(const file of selected){if((field.maxBytes&&file.size>field.maxBytes)||(allowed&&!allowed.includes(file.type))){const detail=`Invalid attachment: ${file.name}. Check the allowed format and size.`;setMessage(detail);setBackendIssue(verificationFieldIssue(schema,field.key,detail));return;}}
    busyRef.current=true;setBusy(true);setMessage('');setBackendIssue(null);
    try{await saveQueue.wait().catch(()=>{});for(const file of selected){const result=workflow?await fieldApi.uploadContractorAttachment(record.id,file,field.key,schema.country):await fieldApi.uploadAttachment(editingId||record.id,file,field.key);const next={...result,field_key:field.key};current.current={...current.current,evidence:[...current.current.evidence,next]};setEvidence(current.current.evidence);dirty.current=true;revision.current++;persistLocal();}}
    catch(error){setBackendIssue(resolveVerificationIssue(schema,current.current.data,error,field.key));setNeedsSignIn(verificationUnauthorized(error));setMessage(error instanceof Error?error.message:'Upload failed. Please retry.');}
    finally{busyRef.current=false;setBusy(false);flushSave();}
  }
  async function recoverDraft():Promise<number>{
    if(editingId)throw Error('Submitted records cannot be replaced with a new draft.');
    await saveQueue.wait().catch(()=>{});
    try {
      const result=await fieldApi.getDraft(record.id,schema.country) as {draft:VerificationRecord|null};
      if(result.draft?.country===schema.country && result.draft.status==='draft')return record.id;
      throw Error('This record is no longer an editable draft. Start a new survey separately.');
    } catch(error) {
      if(!error || typeof error!=='object' || !('status' in error) || error.status!==404)throw error;
    }
    if(current.current.evidence.length)throw Error('This draft was removed and contains files. Export your answers before starting a new survey.');
    const previousIdentity=identity,previousWriteId=cacheWriteId.current;
    const created=await fieldApi.createDraft({country:schema.country,schema_version:schema.version}) as VerificationRecord & {draft?:VerificationRecord};
    const next=created.draft||created;
    if(!Number.isSafeInteger(next.id)||next.id<=0||next.country!==schema.country||next.schema_version!==schema.version)throw Error('Unable to recover a draft for this survey. Please retry.');
    changedKeys.current=new Set(Object.keys(current.current.data));dirty.current=true;revision.current++;
    const writeId=crypto.randomUUID();
    try {
      writeVerificationPending(localStorage,{identity:{id:next.id,country:schema.country,version:schema.version},data:current.current.data,evidence:current.current.evidence,changedKeys:[...changedKeys.current],evidenceChanged:false,removedEvidenceUrls:[],revision:revision.current,writeId});
      cacheWriteId.current=writeId;
      localStorage.setItem(`field_draft_id_${schema.country}`,String(next.id));localStorage.setItem('field_draft_id',String(next.id));
      if(previousWriteId!==undefined)clearVerificationPending(localStorage,previousIdentity,previousWriteId);
      fieldApi.clearDraftAccess(record.id);
      setStorageWarning('');
    }catch{setStorageWarning('The draft was recovered, but local recovery storage is unavailable. Keep this page open until the server save succeeds.');}
    removedEvidenceUrls.current.clear();evidenceChanged.current=false;
    setRecord(next);setMessage('');setBackendIssue(null);setSaveState('Draft recovered; changes pending server save');
    return next.id;
  }
  function removeEvidence(index:number){const removed=current.current.evidence[index];if(removed)removedEvidenceUrls.current.add(removed.url);dirty.current=true;revision.current++;setSaveState('Unsaved changes');const next=current.current.evidence.filter((_,i)=>i!==index);current.current={...current.current,evidence:next};setEvidence(next);evidenceChanged.current=true;persistLocal();flushSave();}
  function locate(issue:VerificationIssue){const formSchema={...schema,sections};const key=verificationIssueFocusKey(formSchema,current.current.data,issue);const target=verificationFieldIssue(formSchema,key,issue.message);setReview(false);setStep(target?.step??issue.step);setFocusRequest(previous=>({key,id:(previous?.id||0)+1}));}
  function navigate(next:number){
    setReview(false);setStep(next);
    window.history.replaceState(null,'',`#survey-section-${next}`);
    setTimeout(()=>document.getElementById(`survey-section-${next}`)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),0);
  }
  function showReview(){setReview(true);window.scrollTo({top:0,behavior:'smooth'});}

  async function submit(){
    if(busyRef.current)return;
    const validateSections=workflow&&phase==='profile'?allSections:sections;
    const validationSchema={...schema,sections:validateSections.map(section=>({...section,fields:section.fields.map(field=>field.type==='attachment'?{...field,required:false}:field)}))};
    const invalid={...validateVerification(validationSchema,current.current.data),...requiredEvidenceErrors(validateSections,current.current.data,current.current.evidence)};setErrors(invalid);
    if(Object.keys(invalid).length){const issue=verificationFieldIssue({...schema,sections:validateSections},Object.keys(invalid)[0],invalid[Object.keys(invalid)[0]]);if(issue)locate(issue);setBackendIssue(null);setMessage('Please correct the highlighted fields before submitting.');return;}
    const unsupported=validateSections.flatMap(s=>s.fields).find(f=>!['text','number','tel','url','email','date','textarea','checkbox','radio','select','repeat','attachment'].includes(f.type));
    if(unsupported){setMessage('The form contains an unsupported field. Contact an administrator.');return;}
    const submissionWriteId=cacheWriteId.current;
    busyRef.current=true;setBusy(true);setMessage('');
    try{
      await saveQueue.wait().catch(()=>{});
      if(editingId){await fieldApi.reSubmit(editingId,payload());setComplete(true);}
      else if(workflow&&phase==='qualification'){
        await save();await fieldApi.submit(record.id,schema.country);dirty.current=false;
        try{finishVerificationDraft(localStorage,identity,submissionWriteId,false);localStorage.setItem('contractor_application_id_ae',String(record.id));if(localStorage.getItem('field_draft_id')===String(record.id))localStorage.removeItem('field_draft_id');if(localStorage.getItem(`field_draft_id_${schema.country}`)===String(record.id))localStorage.removeItem(`field_draft_id_${schema.country}`);}catch{setStorageWarning('Application submitted, but local resume data could not be updated. Keep this private application link.');}
        setRecord(previous=>({...previous,status:'submitted',contractor_stage:'qualification',contractor_review_status:'pending'}));setContractorStage('qualification');setReviewStatus('pending');setWaitingReview(true);setReview(false);
      } else if(workflow&&phase==='profile'){
        await save();await fieldApi.submitContractorProfile(record.id,schema.country);dirty.current=false;setContractorStage('complete');setComplete(true);localStorage.removeItem('contractor_application_id_ae');fieldApi.clearDraftAccess(record.id);
        try{finishVerificationDraft(localStorage,identity,submissionWriteId,false);}catch{setStorageWarning('Profile submitted, but local recovery cleanup failed.');}
      } else {await save();await fieldApi.submit(record.id);dirty.current=false;try{finishVerificationDraft(localStorage,identity,submissionWriteId,!editingId);}catch{setStorageWarning('Record submitted, but local recovery cleanup failed.');}setComplete(true);fieldApi.clearDraftAccess(record.id);}
    }
    catch(error){setBackendIssue(resolveVerificationIssue(schema,current.current.data,error));setNeedsSignIn(verificationUnauthorized(error));setMessage(error instanceof Error?error.message:'Submission failed. Your answers are still available.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  function exportRecord(){const blob=new Blob([JSON.stringify({id:record.id,...payload(),schema_snapshot:schema},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Tarmeer_Verification_${record.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function checkApplicationStatus(){if(!workflow)return;setBusy(true);setStatusMessage('Checking application status…');try{const response=await fieldApi.getContractorApplication(record.id,schema.country) as {application:VerificationRecord};const application=response.application;setContractorStage(application.contractor_stage||'qualification');setReviewStatus(application.contractor_review_status||null);setRecord(application);if(application.contractor_stage==='profile'&&application.contractor_review_status==='approved'){setProfileReady(true);setStatusMessage('Your application is approved. Continue to complete your company profile.');}else setStatusMessage('Your application is still under review. You can return using your private application link.');}catch(error){setStatusMessage(error instanceof Error?error.message:'Unable to check application status. Please retry.');}finally{setBusy(false);}}
  function continueProfile(){if(!recovered.pending){const nextData=parseVerificationData(record.verification_data);const nextEvidence=parseEvidence(record.attachments);current.current={data:nextData,evidence:nextEvidence};setData(nextData);setEvidence(nextEvidence);dirty.current=false;changedKeys.current.clear();evidenceChanged.current=false;removedEvidenceUrls.current.clear();}setPhase('profile');setWaitingReview(false);setStatusMessage('');}
  async function downloadEvidence(url:string,name:string){try{const blob=workflow?await fieldApi.downloadContractorAttachment(record.id,url,schema.country):await fetch(url).then(response=>response.blob());const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=name;anchor.click();URL.revokeObjectURL(objectUrl);}catch(error){setStatusMessage(error instanceof Error?error.message:'Unable to download this attachment.');}}
  async function copyApplicationLink(){const token=fieldApi.getDraftAccessToken(record.id);if(!token){setStatusMessage('Private resume link is unavailable on this device.');return;}const url=new URL('/field/survey',window.location.origin);url.searchParams.set('application',String(record.id));url.hash=new URLSearchParams({access:token}).toString();try{await navigator.clipboard.writeText(url.toString());setStatusMessage('Private application link copied. Anyone with this link can access the application.');}catch{setStatusMessage('Unable to copy the private link.');}}
  const fieldErrors={...errors,...(backendIssue?{[backendIssue.key]:backendIssue.message}:{})};
  const issues=Object.entries(fieldErrors).map(([key,detail])=>verificationFieldIssue({...schema,sections},key,detail)).filter((issue):issue is VerificationIssue=>!!issue);
  if(waitingReview)return <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4"><div className="max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm"><p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#8b6537]">Contractor registration · Step 1 of 2</p><h1 className="text-2xl font-semibold">Application submitted</h1><p className="my-4 text-stone-600">Your admission application and supporting documents are saved. Tarmeer will review them before you can complete the full contractor profile.</p><p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Status: {profileReady?'Approved — profile completion is ready':'Awaiting admission review'}</p><div className="flex flex-wrap justify-center gap-3">{profileReady&&<button type="button" className={gold} onClick={continueProfile}>Continue to complete profile</button>}<button type="button" className={secondary} disabled={busy} onClick={()=>void checkApplicationStatus()}>Check status</button><button type="button" className={secondary} onClick={()=>void copyApplicationLink()}>Copy private resume link</button></div>{statusMessage&&<p role="status" className="mt-4 break-words text-sm text-stone-600">{statusMessage}</p>}<p className="mt-4 text-xs text-stone-500">Keep the private link safe. Anyone who has it can access this application.</p></div></div>;
  if(complete)return <div className="flex min-h-screen items-center justify-center px-4"><div className="max-w-md rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Contractor profile complete</h1><p className="my-4 text-stone-600">Your application and full contractor profile have been saved.</p><button className={gold} onClick={()=>{window.location.href='/field/survey?new=1';}}>Start new application</button></div></div>;
  return <div className="contractor-survey min-h-screen bg-[#faf9f7] pb-36 text-stone-900">
    <header className="contractor-header verification-controls">
      <a href="/" className="contractor-brand">tarmeer<span>®</span></a>
      <span className="ml-auto text-xs text-stone-500">{workflow?(phase==='qualification'?'Admission application · Step 1 of 2':'Full contractor profile · Step 2 of 2'):schema.title||'Field verification'}{editingId?' · Editing submitted record':''}</span>{!editingId&&<a className="shrink-0 text-xs text-[#8b6537] underline" href="/field/survey?new=1">New form</a>}
    </header>
    <div className="contractor-layout verification-layout">
      <aside className="contractor-sidebar verification-controls">
        <nav aria-label="Survey sections">{sections.map((item,index)=><a key={item.key} href={`#survey-section-${index}`} aria-current={!review&&step===index?'step':undefined} onClick={event=>{event.preventDefault();navigate(index);}} className="contractor-section-link"><span>{index+1}</span><span>{item.titleEn||item.title}</span></a>)}</nav>
        <p className="mx-3 mt-6 hidden text-[13px] leading-relaxed text-stone-500 lg:block">{workflow?(phase==='qualification'?'Submit company capacity and evidence for admission review. After approval, return here to complete the company profile.':'Complete the detailed work scope, capacity, projects and agreements.'):'Complete your company details and select the services you provide.'}</p>
      </aside>
      <main className="min-w-0">
        <div className="verification-controls mb-6"><h1 className="text-[27px] font-semibold leading-tight">{review?'Review information':workflow?(phase==='qualification'?'Contractor admission application':'Complete contractor profile'):schema.title||'Field verification'}</h1><p className="mt-2 text-[13px] text-stone-500">{review?'Check your information before submitting.':workflow&&phase==='qualification'?'Tarmeer reviews this information before opening the full profile form.':workflow?'Company and contact details from the first form are already included.':'Company information and business profile'}</p></div>
        {storageWarning&&<div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{storageWarning}</div>}
        {(message||issues.length>0)&&<div role="alert" className="verification-controls mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{!backendIssue&&message}{issues.length>0&&<VerificationErrorSummary issues={issues} onLocate={locate}/>}{needsSignIn&&<p className="mt-2">Your answers remain in this form. <a href={verificationSignInUrl(editingId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Sign in in a new tab</a>, then return here and retry the save, upload or submission.</p>}<button type="button" className={`${secondary} ml-2`} disabled={busy} onClick={()=>editingId?void submit():void save().catch(()=>{})}>{editingId?'Retry submission':'Retry save'}</button></div>}
        <SurveySchemaEditor country={schema.country} draftId={record.id} sectionKey="" enabled={!workflow&&!editingId && schema.country==='ae'} disabled={busy} beforeMutation={async()=>{await save();await saveQueue.wait();}} onRecoverDraft={recoverDraft} onSchemaChange={next=>{setSchema(next);setErrors({});setBackendIssue(null);}} onBusyChange={setSchemaBusy}><form className="verification-current" hidden={review} onSubmit={event=>event.preventDefault()} noValidate>
          {sections.map((section,index)=><section key={section.key} id={`survey-section-${index}`} className="contractor-sheet">
            <div className="contractor-section-heading"><span className="contractor-section-number">{String(index+1).padStart(2,'0')}</span><div className="min-w-0"><h2>{section.titleEn||section.title}</h2>{section.description&&<p>{section.description}</p>}</div><span className="contractor-page-number">PAGE {String(index+1).padStart(2,'0')} / {String(sections.length).padStart(2,'0')}</span></div>
            <div className="contractor-fields"><VerificationFields flat sectionKey={section.key} fields={section.fields} data={data} errors={fieldErrors} onChange={change} onValidate={validateOnBlur} onInvalid={inputInvalid} evidence={evidence} onUpload={upload} onRemoveEvidence={removeEvidence} disabled={busy} focusKey={focusRequest?.key}/></div>
          </section>)}
        </form></SurveySchemaEditor>
        <div className={`verification-review space-y-5 ${review?'':'hidden'}`}>
          <div className="verification-controls flex flex-wrap gap-2"><button type="button" className={secondary} onClick={()=>navigate(step)}>Back to editing</button><button type="button" className={secondary} onClick={exportRecord}>Export JSON</button><button type="button" className={secondary} onClick={()=>window.print()}>Print / PDF</button></div>
          {sections.map(item=><section key={item.key} className="contractor-sheet p-5 sm:p-7"><div className="mb-5 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{item.titleEn||item.title}</h2><button type="button" className={`${secondary} verification-controls`} onClick={()=>navigate(sections.indexOf(item))}>Edit</button></div><dl className="grid min-w-0 gap-5 sm:grid-cols-2">{item.fields.filter(f=>visibleField(f,data)).map(f=><div key={f.key} className="min-w-0"><dt className="mb-1 text-xs text-stone-500">{f.labelEn||f.label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{f.type==='attachment'?evidence.filter(e=>e.field_key===f.key).map((e,i)=><div key={i}><button type="button" onClick={()=>void downloadEvidence(e.url,e.name)} className="text-[#8b6537] underline">{e.name}</button></div>):<ReviewValue value={data[f.key]} field={f}/>}</dd></div>)}</dl></section>)}
        </div>
      </main>
    </div>
    <footer className="contractor-footer verification-controls"><div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3"><span role="status" aria-live="polite" className={`min-w-0 text-xs ${saveState.includes('failed')?'text-red-700':'text-stone-500'}`}>{saveState}</span><div className="flex shrink-0 flex-wrap justify-end gap-2">{!editingId&&<button type="button" className={`${secondary} contractor-save`} disabled={busy} onClick={()=>void save().catch(()=>{})}>{workflow&&phase==='profile'?'Save progress':'Save draft'}</button>}<LoadingButton className={gold} loading={busy} onClick={()=>review?void submit():showReview()}>{review?(editingId?'Save changes':workflow?(phase==='qualification'?'Submit admission application':'Submit full profile'):'Submit verification'):workflow?(phase==='qualification'?'Review admission application ↗':'Review full profile ↗'):'Review information ↗'}</LoadingButton></div></div></footer>
  </div>;
}
