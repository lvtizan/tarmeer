'use client';
import {showConfirm} from '@/components/ui/ConfirmModal';
import {showToast} from '@/components/ui/Toast';
import {useSupplierDraft} from '@/hooks/useSupplierDraft';
type Draft=Pick<ReturnType<typeof useSupplierDraft>,'status'|'error'|'remote'|'recovering'|'ready'|'inspect'|'recover'|'reload'> & {save:()=>Promise<void>};
export default function SupplierDraftPanel({draft,value,t=(en,zh)=>zh,disabled=false}:{draft:Draft;value:object;t?:(en:string,zh:string)=>string;disabled?:boolean}) {
 const run=async(action:()=>Promise<unknown>)=>{try{await action();}catch(error){showToast(error instanceof Error?error.message:t('Save failed','保存失败'),'error');}};
 const busy=disabled||draft.recovering;
 return <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm space-y-2">
  <p role="status" className={draft.status==='error'?'text-red-600':'text-stone-600'}>{draft.status==='loading'?t('Loading draft…','正在恢复草稿…'):draft.status==='saving'?t('Saving draft…','正在保存草稿…'):draft.status==='error'?t('Draft not saved','草稿未保存'):draft.status==='unsaved'?t('Unsaved changes','有待保存的修改'):t('Draft saved','草稿已保存')}</p>
  <p className="text-xs text-stone-500">{draft.error||t('Edits are auto-saved as a draft. Save the form to apply them.','修改自动保存为草稿，点击表单保存后才更新正式资料。')}</p>
  <div className="flex flex-wrap gap-2">
   {!draft.ready&&draft.status==='error'&&<button type="button" onClick={draft.reload} className="min-h-10 rounded-lg border border-stone-200 px-3">{t('Retry recovery','重试恢复')}</button>}
   <button type="button" disabled={busy||!draft.ready} onClick={()=>void run(()=>draft.save())} className="min-h-10 rounded-lg bg-[#b8864a] px-3 text-white hover:bg-[#a07640] disabled:opacity-40">{t('Save draft','保存草稿')}</button>
   <button type="button" disabled={busy||!draft.ready} onClick={()=>showConfirm({title:t('Discard this draft and restore the original form?','清空草稿并恢复表单初始内容？'),confirmLabel:t('Discard draft','清空草稿'),onConfirm:()=>run(()=>draft.recover('discard'))})} className="min-h-10 rounded-lg border border-stone-200 px-3 disabled:opacity-40">{t('Discard draft','清空草稿')}</button>
   {draft.status==='error'&&draft.ready&&<button type="button" disabled={busy} onClick={()=>void run(draft.inspect)} className="min-h-10 rounded-lg border border-stone-200 px-3 disabled:opacity-40">{t('Compare and recover','比较并恢复')}</button>}
  </div>
  {draft.remote&&<div className="space-y-2 border-t border-stone-200 pt-2">
   <p>{t('Choose which version to keep. Your current input is still here.','请选择保留的版本，当前输入仍在本页。')}</p>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[[t('This page','本页内容'),value],[t('Server draft','服务器草稿'),draft.remote]].map(([label,data])=><details key={String(label)} className="min-w-0"><summary>{String(label)}</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(data,null,2)}</pre></details>)}</div>
   <div className="flex flex-wrap gap-2">{(['server','local'] as const).map(mode=><button key={mode} type="button" disabled={busy} className="min-h-10 rounded-lg border border-stone-200 px-3 disabled:opacity-40" onClick={()=>showConfirm({title:mode==='server'?t('Replace this page with the server draft?','用服务器草稿替换本页输入？'):t('Replace the server draft with this page?','用本页输入覆盖服务器草稿？'),confirmLabel:t('Use this version','使用此版本'),onConfirm:()=>run(()=>draft.recover(mode))})}>{mode==='server'?t('Use server draft','使用服务器草稿'):t('Keep this page','保留本页内容')}</button>)}</div>
  </div>}
 </div>;
}
