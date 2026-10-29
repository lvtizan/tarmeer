'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {adminApi} from '@/lib/adminApi';
import {createDraftQueue,draftFingerprint} from '@/lib/draftQueue';

type Status='loading'|'saved'|'unsaved'|'saving'|'error';
export function useSupplierDraft<T extends object>({supplierId,adminId,country,scope,value,restore,enabled=true}:{supplierId:number|string|undefined;adminId:number|undefined;country:string|undefined;scope:string;value:T;restore:(value:T)=>void;enabled?:boolean}) {
 const [status,setStatus]=useState<Status>('loading');const [error,setError]=useState('');const [ready,setReady]=useState(false);
 const restoreRef=useRef(restore);restoreRef.current=restore;
 const initialValue=useRef(value);
 const serialized=draftFingerprint(value);
 const latest=useRef(value);latest.current=value;
 const owner=`${adminId||''}:${country||''}:${supplierId||''}:${scope}`;
 const activeOwner=useRef(owner);activeOwner.current=owner;
 const ownerValue=useRef({owner,value});if(ownerValue.current.owner!==owner)ownerValue.current={owner,value};else ownerValue.current.value=value;
 const queueRef=useRef<ReturnType<typeof createDraftQueue<T>>|null>(null);
 const saved=useRef('');const failed=useRef(false);const loadedOwner=useRef('');
 useEffect(()=>{
  const ownedValue=ownerValue.current;let ownedQueue:ReturnType<typeof createDraftQueue<T>>|null=null;let persisted='';
  let active=true;setReady(false);setStatus('loading');setError('');failed.current=false;queueRef.current=null;
  if(!enabled||!supplierId||!adminId||!country)return;
  const endpoint=`/suppliers/${supplierId}/drafts/${scope}?country=${encodeURIComponent(country)}&admin_id=${adminId}`;
  const initial=initialValue.current;
  adminApi.request(endpoint).then(result=>{
   if(!active||activeOwner.current!==owner)return;
   let revision=result.revision;
   const restored=result.data&&typeof result.data==='object'&&!Array.isArray(result.data)?result.data as T:initial;
   persisted=draftFingerprint(restored);ownedValue.value=restored;saved.current=persisted;restoreRef.current(restored);
   ownedQueue=createDraftQueue<T>(async next=>{
    if(active&&activeOwner.current===owner)setStatus('saving');
    try {const response=await adminApi.request(endpoint,{method:'PUT',body:JSON.stringify({revision,data:next})});revision=response.revision;persisted=draftFingerprint(next);
     if(activeOwner.current!==owner)return;
     saved.current=draftFingerprint(next);failed.current=false;setError('');setStatus(draftFingerprint(latest.current)===saved.current?'saved':'unsaved');
    }catch(err){if(activeOwner.current===owner){failed.current=true;setStatus('error');setError(err instanceof Error?err.message:'Draft save failed.');}throw err;}
   });
   queueRef.current=ownedQueue;loadedOwner.current=owner;setReady(true);setStatus('saved');
  }).catch(err=>{if(active&&activeOwner.current===owner){setStatus('error');setError(err instanceof Error?err.message:'Unable to load draft.');}});
  return()=>{active=false;if(ownedQueue&&draftFingerprint(ownedValue.value)!==persisted){ownedQueue.enqueue(ownedValue.value);void ownedQueue.flush().catch(()=>{});}};
 },[owner,enabled,supplierId,adminId,country,scope]);
 const save=useCallback(async(next?:T)=>{
  if(loadedOwner.current!==owner||!queueRef.current)throw Error('Draft is not ready. Reload to recover it.');
  const data=next||latest.current;if(next){latest.current=next;ownerValue.current.value=next;restoreRef.current(next);}
  queueRef.current.enqueue(data);await queueRef.current.flush();
 },[owner]);
 useEffect(()=>{
  if(!ready||loadedOwner.current!==owner||failed.current)return;
  if(draftFingerprint(value)===saved.current)return;
  setStatus('unsaved');
  const timer=setTimeout(()=>{void save().catch(()=>{});},800);
  return()=>clearTimeout(timer);
 },[serialized,owner,ready,save]);
 useEffect(()=>{
  function leave(event:BeforeUnloadEvent){if(ready&&(status!=='saved'||draftFingerprint(latest.current)!==saved.current)){event.preventDefault();event.returnValue='';}}
  window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);
 },[ready,status]);
 return {status,error,ready:ready&&loadedOwner.current===owner,save};
}
