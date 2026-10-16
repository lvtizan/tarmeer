'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { fieldApi, type SurveySchemaEditorContext, type SurveySchemaMutation } from '@/lib/adminApi';
import { captureVerificationAuth, type VerificationField, type VerificationSchema } from '@/lib/verification';

type Selection = { action: SurveySchemaMutation['action']; field: VerificationField; fieldPath: string[]; sectionKey: string };
const EditorContext = createContext<{open:(selection:Omit<Selection,'sectionKey'>)=>void;disabled:boolean}|null>(null);
const actionClass = 'relative after:pointer-events-none after:absolute after:right-0 after:top-full after:z-10 after:mt-1 after:w-max after:max-w-48 after:whitespace-normal after:rounded-md after:bg-stone-800 after:px-2 after:py-1 after:text-xs after:font-normal after:text-white after:opacity-0 after:content-[attr(data-tooltip)] hover:after:opacity-100 focus-visible:after:opacity-100 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 sm:min-h-8 sm:min-w-8 text-stone-500 hover:bg-[#b8864a]/10 hover:text-[#8b6537] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] disabled:opacity-40';

export function SurveyFieldLabel({field,fieldPath,htmlFor}:{field:VerificationField;fieldPath:string[];htmlFor:string}) {
  const edit = useContext(EditorContext);
  const label = field.labelEn || field.label;
  return <div className="group/field-label mb-2 flex min-h-7 items-center gap-1.5">
    <label htmlFor={htmlFor} className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-stone-800">{label}{field.required && <span className="ml-1 text-red-600">*</span>}</label>
    {edit && <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 group-hover/field-label:opacity-100 group-focus-within/field-label:opacity-100 [@media(hover:none)]:opacity-100">
      <button type="button" className={actionClass} aria-label={`Rename ${label}`} data-tooltip="Rename field" disabled={edit.disabled} onClick={()=>edit.open({action:'rename',field,fieldPath})}><Pencil className="h-4 w-4" /></button>
      <button type="button" className={actionClass} aria-label={`Add field after ${label}`} data-tooltip="Add text field" disabled={edit.disabled} onClick={()=>edit.open({action:'add',field,fieldPath})}><Plus className="h-4 w-4" /></button>
      {field.custom && <button type="button" className={`${actionClass} hover:!text-red-600`} aria-label={`Delete ${label}`} data-tooltip="Delete added field" disabled={edit.disabled} onClick={()=>edit.open({action:'delete',field,fieldPath})}><Trash2 className="h-4 w-4" /></button>}
    </div>}
  </div>;
}

interface Props {
  country:string;draftId:number;sectionKey:string;enabled:boolean;disabled:boolean;
  beforeMutation:()=>Promise<void>;onRecoverDraft:()=>Promise<number>;onSchemaChange:(schema:VerificationSchema)=>void;onBusyChange:(busy:boolean)=>void;children:ReactNode;
}
export default function SurveySchemaEditor({country,draftId,sectionKey,enabled,disabled,beforeMutation,onRecoverDraft,onSchemaChange,onBusyChange,children}:Props) {
  const [access,setAccess] = useState<SurveySchemaEditorContext>({canEdit:false});
  const [selection,setSelection] = useState<Selection|null>(null);
  const [label,setLabel] = useState('');
  const [error,setError] = useState('');
  const [contextError,setContextError] = useState('');
  const [saving,setSaving] = useState(false);
  const [conflict,setConflict] = useState(false);
  const [missingDraft,setMissingDraft] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const contextGeneration = useRef(0);
  const patchInFlight = useRef(false);
  const renderedTarget = useRef({country,draftId});
  renderedTarget.current={country,draftId};
  const changeSchema = useRef(onSchemaChange); changeSchema.current=onSchemaChange;

  function isCurrentContext(generation:number,targetCountry:string,targetDraftId:number){
    const target=renderedTarget.current;
    return generation===contextGeneration.current && target.country===targetCountry && target.draftId===targetDraftId;
  }

  useEffect(()=>{
    let active=true;
    const generation=++contextGeneration.current;
    setAccess({canEdit:false});setContextError('');setMissingDraft(false);
    if (!enabled || !captureVerificationAuth(localStorage)) return;
    fieldApi.getSchemaEditorContext(country,draftId).then(context=>{
      if(!active || patchInFlight.current || !isCurrentContext(generation,country,draftId))return;
      setAccess(context);
      setMissingDraft(false);
      if(context.canEdit && context.schema)changeSchema.current(context.schema);
    }).catch(error=>{if(!active || patchInFlight.current || !isCurrentContext(generation,country,draftId))return;if(error?.status===404){setMissingDraft(true);setContextError('This draft is no longer available. Recover the draft to continue editing.');}else setContextError('Unable to check editing permissions. You can still fill out the survey. Refresh to try again.');});
    return ()=>{active=false;if(generation===contextGeneration.current)contextGeneration.current++;};
  },[country,draftId,enabled]);

  useEffect(()=>{
    if(selection){dialog.current?.showModal();if(selection.action!=='delete')input.current?.focus();}
    else dialog.current?.close();
  },[selection]);

  function close(){if(!busy.current){setSelection(null);setError('');setConflict(false);}}
  function open(value:Omit<Selection,'sectionKey'>){
    if(disabled || busy.current)return;
    setSelection({...value,sectionKey});setLabel(value.action==='rename'?(value.field.labelEn||value.field.label):'');setError('');setConflict(false);
  }
  async function recoverSettings(){
    if(disabled || busy.current)return;
    busy.current=true;setSaving(true);onBusyChange(true);
    let generation=++contextGeneration.current;
    try {
      const nextId=await onRecoverDraft();
      renderedTarget.current={country,draftId:nextId};
      generation=++contextGeneration.current;
      const context=await fieldApi.getSchemaEditorContext(country,nextId);
      if(!isCurrentContext(generation,country,nextId))return;
      setAccess(context);
      setMissingDraft(false);
      if(!context.canEdit || !context.schema)throw Error('Your account does not have editing permission. Close this dialog and sign in again.');
      changeSchema.current(context.schema);setContextError('');setError('');setConflict(false);
    }catch(err){if(generation!==contextGeneration.current)return;const message=err instanceof Error?err.message:'Unable to recover the draft. Please try again.';if(selection)setError(message);else setContextError(message);}
    finally{busy.current=false;setSaving(false);onBusyChange(false);}
  }
  async function reloadSettings(){
    if(busy.current)return;
    busy.current=true;setSaving(true);onBusyChange(true);
    const generation=++contextGeneration.current;
    try {
      await beforeMutation();
      const context=await fieldApi.getSchemaEditorContext(country,draftId);
      if(!isCurrentContext(generation,country,draftId))return;
      setAccess(context);
      setMissingDraft(false);
      if(!context.canEdit || !context.schema)throw Error('Your account does not have editing permission. Close this dialog and sign in again.');
      changeSchema.current(context.schema);setError('');setConflict(false);
    } catch(err){if(generation!==contextGeneration.current)return;if(err && typeof err==='object' && 'status' in err && err.status===404){setMissingDraft(true);setError('This draft was removed. Recover the draft to continue editing.');}else setError(err instanceof Error?err.message:'Unable to reload field settings. Please try again.');}
    finally{busy.current=false;setSaving(false);onBusyChange(false);}
  }
  async function save(){
    if(!selection || busy.current || !access.canEdit || !access.revision || !access.draftRevision)return;
    const name=label.trim();
    if(selection.action!=='delete' && (!name || Array.from(name).length>120 || /[\u0000-\u001f\u007f]/.test(name))){setError('Enter a field name between 1 and 120 characters.');return;}
    busy.current=true;patchInFlight.current=true;contextGeneration.current++;setSaving(true);onBusyChange(true);setError('');
    try {
      await beforeMutation();
      const result=await fieldApi.editSchemaField({country,draftId,revision:access.revision,draftRevision:access.draftRevision,action:selection.action,sectionKey:selection.sectionKey,fieldPath:selection.fieldPath,...(selection.action==='delete'?{}:{label:name})});
      contextGeneration.current++;
      setAccess({canEdit:true,revision:result.revision,draftRevision:result.draftRevision});
      changeSchema.current(result.schema);setSelection(null);setConflict(false);
    } catch(err){
      setError(err instanceof Error?err.message:'Unable to save changes. Please try again.');
      const status=err && typeof err==='object' && 'status' in err ? err.status : undefined;
      setConflict(status===409);
      if(status===404){setMissingDraft(true);setError('This draft was removed. Recover the draft, then save your field change again. Your field name and answers will be kept.');}
      if(status===401 || status===403)setAccess({canEdit:false});
    } finally{patchInFlight.current=false;busy.current=false;setSaving(false);onBusyChange(false);}
  }
  const title=selection?.action==='rename'?'Rename field':selection?.action==='add'?'Add text field':'Delete field';
  return <EditorContext.Provider value={enabled && access.canEdit?{open,disabled:disabled||saving}:null}>
    {contextError && <div className="mb-4"><p role="alert" className="text-sm text-red-700">{contextError}</p>{missingDraft && !selection && <button type="button" disabled={saving||disabled} onClick={()=>void recoverSettings()} className="mt-2 rounded-xl bg-[#b8864a] px-4 py-2 text-sm text-white hover:bg-[#a07640] disabled:opacity-40">Recover draft</button>}</div>}
    {children}
    <dialog ref={dialog} aria-labelledby="survey-editor-title" onCancel={e=>{e.preventDefault();close();}} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-800 shadow-xl backdrop:bg-black/35">
      <h2 id="survey-editor-title" className="mb-3 text-lg font-semibold">{title}</h2>
      {selection?.action==='delete'?<p className="text-sm leading-6">Delete “{selection.field.labelEn||selection.field.label}”? This field will be hidden from the survey. Historical records and saved answers will be preserved.</p>:<>
        <label htmlFor="survey-editor-label" className="mb-2 block text-sm font-medium">Field name</label>
        <input ref={input} id="survey-editor-label" value={label} disabled={saving} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}}} className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/20" placeholder="Enter a field name" />
        <p className="mt-3 text-xs leading-5 text-stone-500">Changes apply to this draft and future surveys. Previously submitted records keep their original fields.</p>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={close} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm disabled:opacity-40">Cancel</button>
        {missingDraft?<button type="button" disabled={saving||disabled} onClick={()=>void recoverSettings()} className="rounded-xl bg-[#b8864a] px-4 py-2 text-sm font-medium text-white hover:bg-[#a07640] disabled:opacity-40">{saving?'Recovering…':'Recover draft'}</button>:conflict?<button type="button" disabled={saving} onClick={()=>void reloadSettings()} className="rounded-xl bg-[#b8864a] px-4 py-2 text-sm font-medium text-white hover:bg-[#a07640] disabled:opacity-40">Reload field settings</button>:<button type="button" disabled={saving || !access.canEdit} onClick={()=>void save()} className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${selection?.action==='delete'?'bg-red-600 hover:bg-red-700':'bg-[#b8864a] hover:bg-[#a07640]'}`}>{saving?'Saving…':selection?.action==='delete'?'Delete field':'Save'}</button>}
      </div>
    </dialog>
  </EditorContext.Provider>;
}
