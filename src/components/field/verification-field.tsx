'use client';
import { useRef, useState, type ClipboardEvent } from 'react';
import { FormInput, FormTextarea, FormSelect } from '@/components/form/FormInput';
import { SurveyFieldLabel } from './survey-schema-editor';
import ChipSelect from '@/components/field/ChipSelect';
import { copyVerificationFields, safeEvidenceUrl, verificationFieldBounds, verificationInputStep, validateVerification, visibleField, type VerificationData, type VerificationEvidence, type VerificationField, type VerificationValue } from '@/lib/verification';

const inputClass='min-w-0 !bg-white';
const secondary='rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm hover:border-[#b8864a] disabled:opacity-40';
interface Props {field:VerificationField; fieldPath?:string[]; sectionKey?:string; labelSuffix?:string; data:VerificationData; onChange:(key:string,value:VerificationValue,immediate?:boolean)=>void; error?:string; evidence:VerificationEvidence[]; onUpload:(field:VerificationField,files:FileList)=>void; onRemoveEvidence:(index:number)=>void; disabled?:boolean; scope?:string; onValidate?:(key:string)=>void; onInvalid?:(key:string,message:string)=>void;}
export default function VerificationFieldInput({field,data,onChange,error,evidence,onUpload,onRemoveEvidence,disabled,scope,onValidate,onInvalid,fieldPath,sectionKey,labelSuffix}:Props) {
  const fileInput=useRef<HTMLInputElement>(null);
  const value=data[field.key]; const id=`verification-${scope||'root'}-${field.key.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
  if(!visibleField(field,data))return null;
  const label=(field.labelEn||field.label)+(labelSuffix||'');
  const path=fieldPath||[field.key];
  const optionList=(field.options||[]).map(option=>typeof option==='string'?{label:option,value:option}:option);
  const documentChecklist=field.type==='checkbox'&&field.appearance==='document-checklist';
  const checked=Array.isArray(value)&&optionList.some(option=>value.includes(option.value as never));
  const text=typeof value==='string'?value:'';
  const bounds=verificationFieldBounds(field);
  const maxLength=field.inputPolicy?.maxLength;
  function paste(event:ClipboardEvent<HTMLInputElement|HTMLTextAreaElement>){
    if(maxLength===undefined)return;
    const control=event.currentTarget;const proposed=control.value.slice(0,control.selectionStart??control.value.length)+event.clipboardData.getData('text')+control.value.slice(control.selectionEnd??control.value.length);
    if(Array.from(proposed).length>maxLength){event.preventDefault();onInvalid?.(field.key,`Pasted text exceeds ${maxLength} characters. Shorten it before pasting.`);}
  }
  const common={id,disabled,required:!!field.required,onBlur:()=>onValidate?.(field.key),'aria-invalid':!!error,'aria-describedby':error?`${id}-error`:undefined};
  const full=['checkbox','radio','attachment','textarea'].includes(field.type)||(field.type==='repeat'&&field.layout!=='inline');
  return <div className={full?'min-w-0 md:col-span-2':'min-w-0'} data-field-key={field.key} data-field-type={field.type} aria-invalid={!!error} tabIndex={-1} style={{scrollMarginTop:100,scrollMarginBottom:120}}>
    {!documentChecklist&&<SurveyFieldLabel field={field} fieldPath={path} htmlFor={id} sectionKey={sectionKey} displayLabel={label}/>}
    {field.help&&<p className="mb-2 text-sm text-stone-500">{field.help}</p>}
    {documentChecklist?<label htmlFor={id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-relaxed text-stone-800 hover:border-[#b8864a] has-[:checked]:border-[#b8864a] has-[:checked]:bg-[#fbf7f1]">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} required={!!field.required} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onBlur={()=>onValidate?.(field.key)} onChange={event=>onChange(field.key,event.target.checked?optionList.map(option=>option.value):[],true)} className="mt-0.5 size-5 shrink-0 accent-[#b8864a]"/>
      <span>{label}</span>
    </label>:field.type==='checkbox'||field.type==='radio'? <fieldset id={id} disabled={disabled} aria-label={label} aria-invalid={!!error} onBlur={()=>onValidate?.(field.key)} aria-describedby={error?`${id}-error`:undefined} className="min-w-0">
      <ChipSelect options={optionList.map(option=>option.label)} multi={field.type==='checkbox'} value={field.type==='checkbox'?(Array.isArray(value)?value.filter(v=>typeof v==='string').map(v=>optionList.find(o=>o.value===v)?.label||v) as string[]:[]):optionList.find(o=>o.value===value)?.label||''} onChange={next=>{
        if(field.type==='radio')onChange(field.key,optionList.find(o=>o.label===next)?.value||'',true);
        else {let values=(Array.isArray(next)?next:[]).map(label=>optionList.find(o=>o.label===label)?.value||label);if(field.exclusiveValue&&values.includes(field.exclusiveValue)&&values.length>1){const current=Array.isArray(value)?value:[];values=current.includes(field.exclusiveValue as never)?values.filter(v=>v!==field.exclusiveValue):[field.exclusiveValue];}onChange(field.key,values,true);}
      }}/>
    </fieldset>:field.type==='textarea'?<FormTextarea {...common} maxLength={maxLength===undefined?undefined:maxLength*2} onPaste={paste} rows={3} className={inputClass} value={text} placeholder={field.placeholder} onChange={e=>onChange(field.key,e.target.value)}/>
    :field.type==='select'?<FormSelect {...common} className={inputClass} value={text} onChange={e=>onChange(field.key,e.target.value,true)}><option value="">Select…</option>{optionList.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FormSelect>
     :field.type==='repeat'&&field.layout==='inline'?<div className="grid grid-cols-3 gap-2">{Array.from({length:field.maxItems||3},(_,index)=>{const rows=Array.isArray(value)?value as Record<string,unknown>[]:[];return <div key={index} className="min-w-0">{field.fields?.map(child=><VerificationFieldInput key={child.key} field={child} labelSuffix={` ${index+1}`} fieldPath={[...path,child.key]} sectionKey={sectionKey} scope={`${id}-${index}`} data={(rows[index]||{}) as VerificationData} onChange={(key,next,immediate)=>onChange(field.key,Array.from({length:field.maxItems||3},(_,i)=>i===index?{...(rows[i]||{}),[key]:next}:rows[i]||{}),immediate)} evidence={[]} onUpload={onUpload} onRemoveEvidence={onRemoveEvidence} disabled={disabled} onValidate={()=>onValidate?.(field.key)} onInvalid={(_key,message)=>onInvalid?.(field.key,message)}/>)}</div>;})}</div>
    :field.type==='repeat'?<div className="space-y-3">{(Array.isArray(value)?value:[]).map((row,index)=>typeof row==='object'&&row!==null?<div key={index} className="rounded-xl border border-stone-200 bg-white p-3"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">{label} {index+1}</span><button type="button" disabled={disabled} className={secondary} onClick={()=>onChange(field.key,(value as Record<string,unknown>[]).filter((_,i)=>i!==index),true)}>Remove</button></div><div className="grid gap-4 md:grid-cols-2">{field.fields?.map(child=><VerificationFieldInput key={child.key} field={child} fieldPath={[...path,child.key]} sectionKey={sectionKey} scope={`${id}-${index}`} error={error?validateVerification({sections:[{key:'',title:'',fields:[child]}]},row as VerificationData,new Date(),false)[child.key]:undefined} data={row as VerificationData} onChange={(key,next,immediate)=>onChange(field.key,(value as Record<string,unknown>[]).map((r,i)=>i===index?{...r,[key]:next}:r),immediate)} evidence={[]} onUpload={onUpload} onRemoveEvidence={onRemoveEvidence} disabled={disabled} onValidate={()=>onValidate?.(field.key)} onInvalid={(_key,message)=>onInvalid?.(field.key,message)}/>)}</div></div>:null)}<button type="button" className={secondary} disabled={disabled || (Array.isArray(value)&&value.length>=(field.maxItems||30))} onClick={()=>onChange(field.key,[...(Array.isArray(value)?value as Record<string,unknown>[]:[]),{}],true)}>Add {label}</button></div>
    :field.type==='attachment'?<div className="rounded-xl border border-dashed border-stone-300 bg-white p-4"><button id={id} type="button" disabled={disabled} aria-label={`Choose files for ${label}`} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} onBlur={()=>onValidate?.(field.key)} onClick={()=>fileInput.current?.click()} className="min-h-11 rounded-xl bg-[#b8864a] px-4 py-2 text-sm font-medium text-white hover:bg-[#a07640] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a] focus-visible:ring-offset-2 disabled:opacity-40">Choose files</button><input ref={fileInput} type="file" multiple accept={field.accept} disabled={disabled} className="hidden" aria-label={`Choose files for ${label}`} onChange={e=>{if(e.target.files?.length)onUpload(field,e.target.files);e.target.value='';}}/><p className="mt-2 text-xs text-stone-500">{field.maxBytes?`Maximum ${Math.round(field.maxBytes/1024/1024)} MB per file. `:''}Files are stored with this record.</p><ul className="mt-3 space-y-2">{evidence.map((item,index)=>item.field_key===field.key?<li key={`${item.url}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">{item.type?.startsWith('image/')&&safeEvidenceUrl(item.url)&&<img src={safeEvidenceUrl(item.url)} alt={item.name} loading="lazy" width={145} height={82} className="aspect-video w-36 rounded-lg object-cover"/>}{safeEvidenceUrl(item.url)?<a className="min-w-0 flex-1 break-all text-[#8b6537] underline" href={safeEvidenceUrl(item.url)} target="_blank" rel="noopener noreferrer">{item.name}</a>:<span className="min-w-0 flex-1 break-all">{item.name}</span>}<button type="button" className={secondary} disabled={disabled} onClick={()=>onRemoveEvidence(index)}>Remove</button></li>:null)}</ul></div>
    :['text','number','tel','url','email','date'].includes(field.type)?<FormInput {...common} type={field.type} className={inputClass} value={text} min={bounds.min} max={bounds.max} step={verificationInputStep(field)} maxLength={maxLength===undefined?undefined:maxLength*2} onPaste={paste} inputMode={field.type==='number'?(field.inputPolicy?.precision?'decimal':'numeric'):undefined} placeholder={field.placeholder} onChange={e=>onChange(field.key,e.target.value)}/>
    :<p role="alert" className="text-sm text-red-700">Unsupported field type: {field.type}. Contact an administrator.</p>}
    {field.copyFrom&&<button type="button" className={`${secondary} mt-2`} disabled={disabled} onClick={()=>onChange(field.key,data[field.copyFrom!]||'',true)}>Copy on-site contact value</button>}
    {error&&<p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}

export function VerificationFields({fields,flat,...props}:Omit<Props,'field'|'error'> & {fields:VerificationField[];errors:Record<string,string>;focusKey?:string;flat?:boolean}) {
  const [extraShown,setExtraShown]=useState<Record<string,number>>({});
  const groups: {title:string;fields:VerificationField[]}[]=[];
  for(const field of fields){const title=field.group||'';let group=groups[groups.length-1];if(!group||group.title!==title){group={title,fields:[]};groups.push(group);}group.fields.push(field);}
  return <div className="space-y-5">{groups.map((group,i)=>{
    const extras=group.fields.filter(f=>f.type==='textarea'&&!!f.groupKey);
    const filledExtras=extras.reduce((last,f,index)=>(props.data[f.key]||props.errors[f.key]||props.focusKey===f.key)?Math.max(last,index+1):last,0);
    const shown=Math.max(extraShown[`${i}`]||1,filledExtras);
    const hiddenKeys=new Set(extras.slice(shown).map(f=>f.key));
    return <section key={`${group.title}-${i}`} className={flat?'min-w-0':'rounded-2xl border border-stone-200 bg-white p-4 sm:p-6'}>{group.title&&<h2 className="mb-5 text-lg font-semibold">{group.title}</h2>}{group.fields.some(f=>f.copyFrom)&&<button type="button" disabled={props.disabled} className={`${secondary} mb-4`} onClick={()=>{const mapping=Object.fromEntries(group.fields.filter(f=>f.copyFrom).map(f=>[f.key,f.copyFrom!]));const next=copyVerificationFields(props.data,mapping);for(const key of Object.keys(mapping))props.onChange(key,next[key],true);}}>Same as on-site contact</button>}<div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">{group.fields.filter(f=>!hiddenKeys.has(f.key)).map(field=><VerificationFieldInput key={field.key} field={field} {...props} error={props.errors[field.key]}/>)}</div>{shown<extras.length&&<button type="button" disabled={props.disabled} className={`${secondary} mt-4`} onClick={()=>setExtraShown(s=>({...s,[`${i}`]:shown+1}))}>Add another work</button>}</section>;
  })}</div>;
}
