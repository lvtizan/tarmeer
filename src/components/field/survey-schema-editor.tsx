'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { fieldApi, type SurveySchemaEditorContext, type SurveySchemaMutation } from '@/lib/adminApi';
import { captureVerificationAuth, type VerificationField, type VerificationSchema } from '@/lib/verification';

type Selection = { action: SurveySchemaMutation['action']; field: VerificationField; fieldPath: string[]; sectionKey: string };
const EditorContext = createContext<{open:(selection:Omit<Selection,'sectionKey'>)=>void;disabled:boolean}|null>(null);
const actionClass = 'rounded-md p-1.5 text-stone-500 hover:bg-[#b8864a]/10 hover:text-[#8b6537] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] disabled:opacity-40';

export function SurveyFieldLabel({field,fieldPath,htmlFor}:{field:VerificationField;fieldPath:string[];htmlFor:string}) {
  const edit = useContext(EditorContext);
  const label = field.labelEn || field.label;
  return <div className="group/field-label mb-2 flex min-h-7 items-center gap-1.5">
    <label htmlFor={htmlFor} className="min-w-0 flex-1 text-sm font-medium text-stone-800">{label}{field.required && <span className="ml-1 text-red-600">*</span>}</label>
    {edit && <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/field-label:opacity-100 group-focus-within/field-label:opacity-100 [@media(hover:none)]:opacity-100">
      <button type="button" className={actionClass} aria-label={`Rename ${label}`} title="修改名称" disabled={edit.disabled} onClick={()=>edit.open({action:'rename',field,fieldPath})}><Pencil className="h-4 w-4" /></button>
      <button type="button" className={actionClass} aria-label={`Add field after ${label}`} title="新增文本输入框" disabled={edit.disabled} onClick={()=>edit.open({action:'add',field,fieldPath})}><Plus className="h-4 w-4" /></button>
      {field.custom && <button type="button" className={`${actionClass} hover:!text-red-600`} aria-label={`Delete ${label}`} title="删除新增字段" disabled={edit.disabled} onClick={()=>edit.open({action:'delete',field,fieldPath})}><Trash2 className="h-4 w-4" /></button>}
    </div>}
  </div>;
}

interface Props {
  country:string;draftId:number;sectionKey:string;enabled:boolean;disabled:boolean;
  beforeMutation:()=>Promise<void>;onSchemaChange:(schema:VerificationSchema)=>void;onBusyChange:(busy:boolean)=>void;children:ReactNode;
}
export default function SurveySchemaEditor({country,draftId,sectionKey,enabled,disabled,beforeMutation,onSchemaChange,onBusyChange,children}:Props) {
  const [access,setAccess] = useState<SurveySchemaEditorContext>({canEdit:false});
  const [selection,setSelection] = useState<Selection|null>(null);
  const [label,setLabel] = useState('');
  const [error,setError] = useState('');
  const [contextError,setContextError] = useState('');
  const [saving,setSaving] = useState(false);
  const [conflict,setConflict] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const changeSchema = useRef(onSchemaChange); changeSchema.current=onSchemaChange;

  useEffect(()=>{
    let active=true;
    setAccess({canEdit:false});setContextError('');
    if (!enabled || !captureVerificationAuth(localStorage)) return;
    fieldApi.getSchemaEditorContext(country,draftId).then(context=>{
      if(!active)return;
      setAccess(context);
      if(context.canEdit && context.schema)changeSchema.current(context.schema);
    }).catch(()=>{if(active)setContextError('无法检查问卷编辑权限。填写功能仍可使用，请刷新后重试。');});
    return ()=>{active=false;};
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
  async function reloadSettings(){
    if(busy.current)return;
    busy.current=true;setSaving(true);onBusyChange(true);
    try {
      await beforeMutation();
      const context=await fieldApi.getSchemaEditorContext(country,draftId);
      setAccess(context);
      if(!context.canEdit || !context.schema)throw Error('当前账号没有编辑权限，请关闭后重新登录。');
      changeSchema.current(context.schema);setSelection(null);setError('');setConflict(false);
    } catch(err){setError(err instanceof Error?err.message:'重新加载失败，请重试。');}
    finally{busy.current=false;setSaving(false);onBusyChange(false);}
  }
  async function save(){
    if(!selection || busy.current || !access.canEdit || !access.revision || !access.draftRevision)return;
    const name=label.trim();
    if(selection.action!=='delete' && (!name || Array.from(name).length>120 || /[\u0000-\u001f\u007f]/.test(name))){setError('请输入 1–120 个字符的字段名称。');return;}
    busy.current=true;setSaving(true);onBusyChange(true);setError('');
    try {
      await beforeMutation();
      const result=await fieldApi.editSchemaField({country,draftId,revision:access.revision,draftRevision:access.draftRevision,action:selection.action,sectionKey:selection.sectionKey,fieldPath:selection.fieldPath,...(selection.action==='delete'?{}:{label:name})});
      setAccess({canEdit:true,revision:result.revision,draftRevision:result.draftRevision});
      changeSchema.current(result.schema);setSelection(null);setConflict(false);
    } catch(err){
      setError(err instanceof Error?err.message:'保存失败，请重试。');
      const status=err && typeof err==='object' && 'status' in err ? err.status : undefined;
      setConflict(status===409);
      if(status===401 || status===403)setAccess({canEdit:false});
    } finally{busy.current=false;setSaving(false);onBusyChange(false);}
  }
  const title=selection?.action==='rename'?'修改字段名称':selection?.action==='add'?'新增文本输入框':'确认删除字段';
  return <EditorContext.Provider value={enabled && access.canEdit?{open,disabled:disabled||saving}:null}>
    {contextError && <p role="alert" className="mb-4 text-sm text-red-700">{contextError}</p>}
    {children}
    <dialog ref={dialog} aria-labelledby="survey-editor-title" onCancel={e=>{e.preventDefault();close();}} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-800 shadow-xl backdrop:bg-black/35">
      <h2 id="survey-editor-title" className="mb-3 text-lg font-semibold">{title}</h2>
      {selection?.action==='delete'?<p className="text-sm leading-6">确认删除“{selection.field.labelEn||selection.field.label}”吗？该字段将从问卷中隐藏，历史记录和已保存答案会保留。</p>:<>
        <label htmlFor="survey-editor-label" className="mb-2 block text-sm font-medium">字段名称</label>
        <input ref={input} id="survey-editor-label" value={label} disabled={saving} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}}} className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/20" placeholder="输入字段名称" />
        <p className="mt-3 text-xs leading-5 text-stone-500">保存后用于当前草稿及后续新问卷。历史已提交记录保持原有字段。</p>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={close} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm disabled:opacity-40">取消</button>
        {conflict?<button type="button" disabled={saving} onClick={()=>void reloadSettings()} className="rounded-xl bg-[#b8864a] px-4 py-2 text-sm font-medium text-white hover:bg-[#a07640] disabled:opacity-40">重新加载字段配置</button>:<button type="button" disabled={saving || !access.canEdit} onClick={()=>void save()} className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${selection?.action==='delete'?'bg-red-600 hover:bg-red-700':'bg-[#b8864a] hover:bg-[#a07640]'}`}>{saving?'保存中…':selection?.action==='delete'?'确认删除':'保存'}</button>}
      </div>
    </dialog>
  </EditorContext.Provider>;
}
