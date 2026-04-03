import { useState } from 'react';
import { FolderOpen, ImagePlus, Trash2, Eye, GripVertical, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDroppedImageFiles } from '../../lib/dropFiles';
import {
  convertProjectImagesForUpload, estimateDataUrlBytes, formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES, MAX_TOTAL_UPLOAD_BYTES, buildUploadSizeMessage,
} from '../../lib/projectImageUpload';

function reorder<T>(a:T[],f:number,t:number):T[]{if(f===t)return a;const n=[...a];const[m]=n.splice(f,1);n.splice(t,0,m);return n;}

export default function HomeownerProjectsPage() {
  const [imgs, setImgs] = useState<string[]>([]);
  const [fps, setFps] = useState<string[]>([]);
  const [cover, setCover] = useState(0);
  const [prepping, setPrepping] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dragI, setDragI] = useState<number|null>(null);
  const [dragO, setDragO] = useState<number|null>(null);
  const [prevI, setPrevI] = useState<number|null>(null);
  const [notice, setNotice] = useState('');

  const addFiles = async (files: File[]) => {
    const raw = files.filter(f=>f.type.startsWith('image/'));
    const existing = new Set(fps.filter(Boolean));
    const unique = raw.filter(f=>!existing.has(`${f.name}:${f.size}:${f.lastModified}`));
    if(!unique.length){setNotice('No new images.');return}
    const tb=unique.reduce((s,f)=>s+f.size,0);
    if(tb>MAX_TOTAL_UPLOAD_BYTES){setNotice(buildUploadSizeMessage(tb));return}
    setPrepping(true);setNotice('');
    try{
      const p=await convertProjectImagesForUpload(unique);
      const eb=imgs.reduce((s,u)=>s+estimateDataUrlBytes(u),0);
      if(eb+p.estimatedPayloadBytes>MAX_ESTIMATED_PAYLOAD_BYTES){setNotice(`Too large. Keep under ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)}.`);return}
      setImgs(prev=>[...prev,...p.dataUrls]);
      setFps(prev=>[...prev,...unique.map(f=>`${f.name}:${f.size}:${f.lastModified}`)]);
    }catch(e:any){setNotice(e.message||'Failed')}finally{setPrepping(false)}
  };

  const hFS = async (e:React.ChangeEvent<HTMLInputElement>) => {if(e.target.files?.length){await addFiles(Array.from(e.target.files));e.target.value=''}};
  const hDrop = async (e:React.DragEvent) => {e.preventDefault();setDropActive(false);const r=await getDroppedImageFiles(e);if(r.files.length>0)await addFiles(r.files)};
  const rmImg = (i:number) => {setImgs(p=>p.filter((_,x)=>x!==i));setFps(p=>p.filter((_,x)=>x!==i));if(cover>=i&&cover>0)setCover(c=>c-1)};
  const mvImg = (f:number,t:number) => {setImgs(p=>reorder(p,f,t));setFps(p=>reorder(p,f,t));if(cover===f)setCover(t)};

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[960px] px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#2c2c2c]">My Renovation Progress</h1>
          <p className="text-sm text-stone-500">Upload before/after photos of your renovation journey to share with the community.</p>
        </div>

        <section className="rounded-[24px] border border-stone-200 bg-white p-[18px] shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
          <div className="mb-2.5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#2c2c2c]">Photos</h2>
              <p className="mt-0.5 text-xs text-stone-500">{imgs.length>0?`${imgs.length} photos · ${formatFileSize(imgs.reduce((s,u)=>s+estimateDataUrlBytes(u),0))}`:'Upload your renovation photos'}</p>
            </div>
            {imgs[cover]&&<div className="w-[128px] rounded-xl border border-stone-200 bg-stone-50 p-1.5"><div className="text-[10px] font-semibold text-stone-500">Cover</div><div className="mt-1 aspect-video w-full rounded-lg bg-cover bg-center" style={{backgroundImage:`url(${imgs[cover]})`}}/></div>}
          </div>

          {notice&&<div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex justify-between">{notice}<button type="button" onClick={()=>setNotice('')}><X className="w-3 h-3"/></button></div>}

          <input id="ho-up" type="file" accept="image/*" multiple className="hidden" onChange={hFS} disabled={prepping}/>
          <input id="ho-folder" type="file" accept="image/*" multiple {...{webkitdirectory:'',directory:''} as any} className="hidden" onChange={hFS} disabled={prepping}/>

          <label htmlFor="ho-up" onDrop={hDrop} onDragOver={e=>{e.preventDefault();setDropActive(true)}} onDragLeave={()=>setDropActive(false)}
            className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${dropActive?'border-[#b8864a] bg-amber-50':'border-stone-300 bg-stone-50 hover:bg-stone-100'}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm"><ImagePlus className="h-6 w-6 text-[#b8864a]"/></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#2c2c2c]">{prepping?'Processing...':'Drop images or folders here'}</div>
                <div className="text-xs text-stone-500 mt-0.5">Share your renovation progress — before, during, after!</div>
              </div>
              <label htmlFor="ho-folder" onClick={e=>e.stopPropagation()} className="shrink-0 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50"><FolderOpen className="w-3.5 h-3.5"/>Select Folder</label>
            </div>
          </label>

          <div className="mt-3 max-h-[500px] overflow-y-auto">
            {imgs.length>0?(
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {imgs.map((url,i)=>(
                  <div key={i} draggable onDragStart={()=>setDragI(i)} onDragOver={e=>{e.preventDefault();if(dragO!==i)setDragO(i)}} onDrop={e=>{e.preventDefault();if(dragI!==null)mvImg(dragI,i);setDragI(null);setDragO(null)}} onDragEnd={()=>{setDragI(null);setDragO(null)}}
                    className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${cover===i?'border-[#b8864a] ring-2 ring-[#b8864a]/35':dragO===i?'border-[#b8864a]/70':'border-stone-200'} ${dragI===i?'opacity-80 cursor-grabbing':'cursor-grab'}`}>
                    <img src={url} alt="" className="h-full w-full object-cover"/>
                    {cover===i&&<div className="absolute left-1.5 top-1.5 rounded-full bg-[#b8864a] px-2 py-0.5 text-[10px] font-semibold text-white">Cover</div>}
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><GripVertical className="h-3.5 w-3.5"/></div>
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition"/>
                    <div className="absolute inset-x-1.5 bottom-1.5 grid h-6 grid-cols-3 gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button type="button" onClick={()=>setPrevI(i)} className="rounded-md bg-white text-[10px] font-semibold text-stone-700"><Eye className="mx-auto h-3 w-3"/></button>
                      <button type="button" onClick={()=>setCover(i)} className="rounded-md bg-white text-[10px] font-semibold text-stone-700">{cover===i?'Cover':'Set'}</button>
                      <button type="button" onClick={()=>rmImg(i)} className="rounded-md bg-white text-[10px] font-semibold text-red-600"><Trash2 className="mx-auto h-3 w-3"/></button>
                    </div>
                  </div>
                ))}
              </div>
            ):(
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-12 text-center text-sm text-stone-500">
                Upload photos to share your renovation progress with the community.
              </div>
            )}
          </div>
        </section>
      </div>

      {prevI!==null&&imgs[prevI]&&(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-stone-700">{prevI+1}/{imgs.length}</span><button type="button" onClick={()=>setPrevI(null)} className="rounded-full p-1 text-stone-500 hover:bg-stone-100"><X className="h-4 w-4"/></button></div>
            <div className="relative flex items-center justify-center rounded-xl bg-stone-100">
              <img src={imgs[prevI]} alt="" className="max-h-[65vh] w-auto object-contain"/>
              {imgs.length>1&&<><button type="button" onClick={()=>setPrevI(p=>(p??0)===0?imgs.length-1:(p??0)-1)} className="absolute left-3 rounded-full bg-white/90 p-2"><ChevronLeft className="h-4 w-4"/></button><button type="button" onClick={()=>setPrevI(p=>((p??0)+1)%imgs.length)} className="absolute right-3 rounded-full bg-white/90 p-2"><ChevronRight className="h-4 w-4"/></button></>}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={()=>setCover(prevI)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">{cover===prevI?'Current Cover':'Set as Cover'}</button>
              <button type="button" onClick={()=>{rmImg(prevI);setPrevI(p=>imgs.length<=1?null:Math.min(p??0,imgs.length-2))}} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
