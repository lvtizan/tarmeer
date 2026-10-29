'use client';
import {useEffect} from 'react';
import {showToast} from '@/components/ui/Toast';
// Keep in-flight uploads in their owning page. No claim of resumability after closing the browser.
export function useUploadNavigationGuard({blocked,message='文件仍在上传或保存，请完成后再离开。'}:{blocked:boolean;message?:string}) {
 useEffect(()=>{
  if(!blocked)return;
  const warn=()=>showToast(message,'error');
  const leave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  const click=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target.closest('a[href]'):null;
   if(!(target instanceof HTMLAnchorElement)||target.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const url=new URL(target.href,window.location.href);
   if(url.href===window.location.href||url.hash&&url.pathname===window.location.pathname&&url.search===window.location.search)return;
   event.preventDefault();event.stopImmediatePropagation();warn();
  };
  // Navigation API cancels history traversal before Next changes the mounted page.
  const navigation=(window as unknown as {navigation?:EventTarget}).navigation;
  const navigate=(event:Event)=>{if(event.cancelable){event.preventDefault();warn();}};
  let sentinel=false;
  const pop=(event:PopStateEvent)=>{if(sentinel){event.stopImmediatePropagation();history.forward();warn();}};
  if(navigation)navigation.addEventListener('navigate',navigate);
  else{
   // Older browsers: reserve one same-URL history entry while a transfer is active.
   history.pushState(history.state,'',window.location.href);sentinel=true;
   window.addEventListener('popstate',pop,true);
  }
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',leave);
  return()=>{
   navigation?.removeEventListener('navigate',navigate);
   document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',leave);
   window.removeEventListener('popstate',pop,true);
   // Leave the same-URL history entry intact: history.back here could undo a subsequent navigation.
   sentinel=false;
  };
 },[blocked,message]);
}
