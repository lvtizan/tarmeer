'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {adminApi} from '@/lib/adminApi';
import {useUploadNavigationGuard} from '@/hooks/useUploadNavigationGuard';
import {normalizeSupplierDraft} from '@/lib/supplierDraftData';
import {createDraftQueue,draftFingerprint} from '@/lib/draftQueue';

type Status='loading'|'saved'|'unsaved'|'saving'|'error';
interface Options<T> {
 supplierId:number|string|undefined;adminId:number|undefined;country:string|undefined;
 scope:string;value:T;restore:(value:T)=>void;enabled?:boolean;fallback?:T;
}
export function useSupplierDraft<T extends object>({supplierId,adminId,country,scope,value,restore,enabled=true,fallback}:Options<T>) {
 const [status,setStatus]=useState<Status>('loading'),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const [loadAttempt,setLoadAttempt]=useState(0);
 const [remote,setRemote]=useState<T|null>(null),[recovering,setRecovering]=useState(false);
 const restoreRef=useRef(restore);restoreRef.current=restore;
 const initial=useRef(value),fallbackRef=useRef(fallback);fallbackRef.current=fallback;
 const owner=`${adminId||''}:${country||''}:${supplierId||''}:${scope}`;
 const activeOwner=useRef(owner);activeOwner.current=owner;
 type Session={owner:string;latest:T;baseline:T;persisted:string;revision:number;active:boolean;failed:boolean;completed:boolean;queue:ReturnType<typeof createDraftQueue<T>>|null;endpoint:string};
 const session=useRef<Session|null>(null);
 if(session.current?.owner===owner)session.current.latest=value;
 const serialized=draftFingerprint(value);
 useEffect(()=>{
  setReady(false);setStatus('loading');setError('');setRemote(null);
  if(!enabled||!supplierId||!adminId||!country)return;
  const current:Session={owner,latest:value,baseline:fallbackRef.current||initial.current,persisted:'',revision:0,active:true,failed:false,completed:false,queue:null,endpoint:`/suppliers/${supplierId}/drafts/${scope}?country=${encodeURIComponent(country)}&admin_id=${adminId}`};
  session.current=current;
  const visible=()=>current.active&&activeOwner.current===owner;
  const apply=(next:T)=>{current.latest=next;current.persisted=draftFingerprint(next);restoreRef.current(next);};
  adminApi.request(current.endpoint).then(result=>{
   if(!visible())return;
   current.revision=result.revision;
   const restored=normalizeSupplierDraft(result.data,current.baseline);
   apply(restored);
   current.queue=createDraftQueue<T>(async next=>{
    if(visible())setStatus('saving');
    try {
     const response=await adminApi.request(current.endpoint,{method:'PUT',body:JSON.stringify({revision:current.revision,data:next})});
     current.revision=response.revision;current.persisted=draftFingerprint(next);current.failed=false;
     if(visible()){setError('');setStatus(draftFingerprint(current.latest)===current.persisted?'saved':'unsaved');}
    }catch(err){current.failed=true;if(visible()){setStatus('error');setError(err instanceof Error?err.message:'Draft save failed.');}throw err;}
   });
   setReady(true);setStatus('saved');
  }).catch(err=>{if(visible()){setStatus('error');setError(err instanceof Error?err.message:'Unable to load draft.');}});
  return()=>{current.active=false;if(!current.completed&&current.queue&&draftFingerprint(current.latest)!==current.persisted){current.queue.enqueue(current.latest);void current.queue.flush().catch(()=>{});}};
 // Each identity owns its queue, revision and fallback; old cleanup never targets a new session.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[owner,enabled,supplierId,adminId,country,scope,loadAttempt]);
 const getSession=useCallback(()=>{
  const current=session.current;
  if(!current||current.owner!==owner||!current.queue||current.completed)throw Error('Draft is not ready. Reload to recover it.');
  return current;
 },[owner]);
 const save=useCallback(async(next?:T)=>{
  const current=getSession();const data=next||current.latest;
  if(next){current.latest=next;restoreRef.current(next);}
  current.queue!.enqueue(data);await current.queue!.flush();
 },[getSession]);
 // Clear the persisted draft after a successful formal save. Suppress unmount re-saving it.
 const complete=useCallback(async()=>{
  const current=getSession();current.completed=true;
  try{current.queue!.enqueue({} as T);await current.queue!.flush();}
  catch(err){current.completed=false;throw err;}
 },[getSession]);
 const inspect=useCallback(async()=>{
  const current=getSession();await current.queue!.whenIdle().catch(()=>{});
  const result=await adminApi.request(current.endpoint);
  const next=normalizeSupplierDraft(result.data,current.baseline);
  if(session.current===current&&current.active)setRemote(next);
  return {current,result,next};
 },[getSession]);
 const recover=useCallback(async(mode:'server'|'local'|'discard')=>{
  setRecovering(true);
  try{
   const {current,result,next}=await inspect();
   if(session.current!==current||!current.active)return;
   current.queue!.clearPending();current.revision=result.revision;current.failed=false;
   if(mode==='local'){await save();}
   else if(mode==='discard'){
    current.latest=current.baseline;restoreRef.current(current.baseline);
    current.queue!.enqueue({} as T);await current.queue!.flush();current.persisted=draftFingerprint(current.baseline);setStatus('saved');
   }else{current.latest=next;current.persisted=draftFingerprint(next);restoreRef.current(next);setStatus('saved');}
   setRemote(null);setError('');
  }finally{setRecovering(false);}
 },[inspect,save]);
 useEffect(()=>{
  const current=session.current;
  if(!ready||current?.owner!==owner||current.failed||current.completed||recovering)return;
  if(serialized===current.persisted)return;
  setStatus('unsaved');const timer=setTimeout(()=>{void save().catch(()=>{});},800);
  return()=>clearTimeout(timer);
 },[serialized,owner,ready,save,recovering]);
 useEffect(()=>{
  const leave=(event:BeforeUnloadEvent)=>{const current=session.current;if(current?.owner===owner&&!current.completed&&current.queue&&draftFingerprint(current.latest)!==current.persisted){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);
 },[owner]);
 useUploadNavigationGuard({blocked:ready&&!session.current?.completed&&status!=='saved'&&status!=='loading',message:'草稿尚未保存，请保存或恢复后再离开。'});
 return {status,error,remote,recovering,reload:()=>setLoadAttempt(value=>value+1),ready:ready&&!recovering&&!session.current?.completed&&session.current?.owner===owner,save,complete,inspect:async()=>{await inspect();},recover};
}
