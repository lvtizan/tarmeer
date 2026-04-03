import React, { useState, useEffect, useCallback } from 'react';
import { resolveImageUrl } from '../../lib/imageUrl';
import {
  ImagePlus, Trash2, Eye, GripVertical, X, ChevronLeft, ChevronRight,
  Link2, Loader2, FolderOpen, Image, Pencil,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getDroppedImageFiles } from '../../lib/dropFiles';
import SelectField from '../../components/form/SelectField';
import {
  convertProjectImagesForUpload, estimateDataUrlBytes, formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES, MAX_TOTAL_UPLOAD_BYTES, buildUploadSizeMessage,
} from '../../lib/projectImageUpload';

const PRIMARY = '#b8864a';
const STYLES = [{ value:'', label:'Select a style' },{ value:'modern', label:'Modern Contemporary' },{ value:'islamic', label:'Modern Islamic' },{ value:'classic', label:'Neo-Classic' },{ value:'minimalist', label:'Minimalist' },{ value:'industrial', label:'Industrial' }];
const TAGS = ['Apartment','Villa','Bathroom','Kitchen','Living','Bedroom','Majlis','Dining','Workspace','Outdoor','Lighting','Storage','Renovation','Materials'];
const CITIES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain','Riyadh','Jeddah','Other'];

const fieldCls = "h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35";
const textareaCls = "w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 resize-none";
const labelCls = "mb-2 block text-sm font-semibold text-stone-700";
const tagOn = "border-[#b8864a] bg-[#b8864a] text-white";
const tagOff = "border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45";

function reorder<T>(a:T[],f:number,t:number):T[]{if(f===t)return a;const n=[...a];const[m]=n.splice(f,1);n.splice(t,0,m);return n;}
function parseMaybeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function CompanyProjectsPage() {
  /* ── project form ── */
  const [form, setForm] = useState({ title:'', description:'', style:'', location:'', area:'' });
  const [tags, setTags] = useState<string[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  /* ── image board ── */
  const [imgs, setImgs] = useState<string[]>([]);
  const [fps, setFps] = useState<string[]>([]);
  const [cover, setCover] = useState(0);
  const [prepping, setPrepping] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dragI, setDragI] = useState<number|null>(null);
  const [dragO, setDragO] = useState<number|null>(null);
  const [prevI, setPrevI] = useState<number|null>(null);
  const [notice, setNotice] = useState('');

  /* ── URL scraper ── */
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeRes, setScrapeRes] = useState<{images:string[];title:string}|null>(null);
  const [scrapeErr, setScrapeErr] = useState('');

  /* ── submit ── */
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [tried, setTried] = useState(false);

  /* ── existing projects ── */
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoadError, setProjectsLoadError] = useState('');
  const refreshProjects = useCallback(() => {
    setProjectsLoadError('');
    api.get('/auth/company/projects')
      .then((d) => {
        const raw = Array.isArray(d.projects || d) ? (d.projects || d) : [];
        setProjects(raw.map((project: any) => ({
          ...project,
          images: parseMaybeArray(project.images),
          tags: parseMaybeArray(project.tags),
        })));
      })
      .catch(() => setProjectsLoadError('Failed to load projects. Please refresh the page.'));
  }, []);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  /* ── image functions ── */
  const addFiles = async (files: FileList|File[]) => {
    const raw = Array.from(files).filter(f=>f.type.startsWith('image/'));
    const existing = new Set(fps.filter(Boolean));
    const unique = raw.filter(f=>!existing.has(`${f.name}:${f.size}:${f.lastModified}`));
    if (!unique.length) { setNotice('No new images.'); return; }
    const tb = unique.reduce((s,f)=>s+f.size, 0);
    if (tb > MAX_TOTAL_UPLOAD_BYTES) { setNotice(buildUploadSizeMessage(tb)); return; }
    setPrepping(true); setNotice('');
    try {
      const p = await convertProjectImagesForUpload(unique);
      const eb = imgs.reduce((s,u)=>s+estimateDataUrlBytes(u), 0);
      if (eb+p.estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) { setNotice(`Too large. Keep under ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)}.`); return; }
      setImgs(prev=>[...prev,...p.dataUrls]);
      setFps(prev=>[...prev,...unique.map(f=>`${f.name}:${f.size}:${f.lastModified}`)]);
    } catch (e:any) { setNotice(e.message||'Failed'); }
    finally { setPrepping(false); }
  };
  const hFS = async (e:React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.length){await addFiles(e.target.files);e.target.value=''} };
  const hDrop = async (e:React.DragEvent) => {
    e.preventDefault(); setDropActive(false);
    const result = await getDroppedImageFiles(e);
    if (result.files.length > 0) {
      // Auto-fill project title from folder name
      if (result.folderName && !form.title.trim()) {
        setForm(p => ({ ...p, title: result.folderName! }));
      }
      await addFiles(result.files);
    }
  };
  const rmImg = (i:number) => { setImgs(p=>p.filter((_,x)=>x!==i));setFps(p=>p.filter((_,x)=>x!==i));if(cover>=i&&cover>0)setCover(c=>c-1) };
  const mvImg = (f:number,t:number) => { setImgs(p=>reorder(p,f,t));setFps(p=>reorder(p,f,t));if(cover===f)setCover(t) };

  /* ── URL scrape ── */
  const doScrape = async () => {
    if(!scrapeUrl.trim())return;setScraping(true);setScrapeErr('');setScrapeRes(null);
    try{const d=await api.post('/auth/company/scrape-portfolio',{url:scrapeUrl.trim()});if(!d.images?.length){setScrapeErr('No images found.');return}setScrapeRes({images:d.images,title:d.title})}
    catch(e:any){setScrapeErr(e.message||'Failed')}finally{setScraping(false)}
  };
  const applyScrape = () => {
    if(!scrapeRes)return;setImgs(p=>[...p,...scrapeRes.images]);setFps(p=>[...p,...scrapeRes.images.map((u:string,i:number)=>`s:${i}:${u.slice(-30)}`)]);setScrapeRes(null);setScrapeUrl('');
  };

  /* ── submit project ── */
  const submit = async (publish: boolean) => {
    setTried(true);
    if(!form.title.trim()||!form.style||!form.location||imgs.length===0){return}
    setSubmitting(true);setMsg('');
    try{
      const ordered=[imgs[cover],...imgs.filter((_,i)=>i!==cover)];
      const payload = {
        title: form.title,
        description: form.description,
        style: form.style,
        location: form.location,
        area: form.area,
        images: ordered,
        tags,
        status: publish ? 'pending' : 'draft',
      };

      if (editingProjectId) {
        await api.put(`/projects/${editingProjectId}`, payload);
        setMsg(publish ? 'Project updated and submitted for review!' : 'Draft updated!');
      } else {
        await api.post('/projects', payload);
        setMsg(publish ? 'Project submitted for review!' : 'Draft saved!');
      }

      setEditingProjectId(null);
      setForm({title:'',description:'',style:'',location:'',area:''});setTags([]);setImgs([]);setFps([]);setCover(0);
      refreshProjects();
    }catch(e:any){setMsg(e.message||'Failed')}finally{setSubmitting(false)}
  };

  const startEdit = (project: any) => {
    const projectImages = parseMaybeArray(project.images);
    setEditingProjectId(Number(project.id));
    setForm({
      title: project.title || '',
      description: project.description || '',
      style: project.style || '',
      location: project.location || '',
      area: project.area || '',
    });
    setTags(parseMaybeArray(project.tags));
    setImgs(projectImages);
    setFps(projectImages.map((url, index) => `existing:${project.id}:${index}:${url.slice(-30)}`));
    setCover(0);
    setMsg('');
    setTried(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    setForm({title:'',description:'',style:'',location:'',area:''});
    setTags([]);
    setImgs([]);
    setFps([]);
    setCover(0);
    setTried(false);
    setMsg('');
  };

  const removeProject = async (projectId: number) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      if (editingProjectId === projectId) {
        cancelEdit();
      }
      refreshProjects();
      setMsg('Project deleted.');
    } catch (error: any) {
      setMsg(error?.message || 'Failed to delete project.');
    }
  };

  const canPublish = !!(form.title.trim()&&form.style&&form.location&&imgs.length>0);
  const gb = imgs.reduce((s,u)=>s+estimateDataUrlBytes(u),0);
  const missingFields:string[] = [];
  if(!form.title.trim()) missingFields.push('title');
  if(!form.style) missingFields.push('style');
  if(!form.location) missingFields.push('city');
  if(imgs.length===0) missingFields.push('images');

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">

        {/* ── Sticky top bar (same style as /designer/upload) ── */}
        <div className="sticky top-3 z-20 mb-4 w-full rounded-[24px] border border-stone-200 bg-[#faf9f7]/95 px-5 py-3.5 shadow-[0_12px_30px_rgba(28,18,8,0.08)] backdrop-blur md:px-6">
          <div className="flex w-full flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-[#2c2c2c]">Upload New Project</h1>
              <p className="text-sm text-stone-500">Complete your project and submit it for review.</p>
            </div>
            <div className="flex w-full shrink-0 gap-3 sm:w-auto">
              {editingProjectId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={submitting}
                  className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:bg-stone-50 sm:flex-none disabled:opacity-50"
                >
                  Cancel Edit
                </button>
              )}
              <button type="button" onClick={()=>submit(false)} disabled={submitting||imgs.length===0}
                className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:bg-stone-50 sm:flex-none disabled:opacity-50">
                {submitting ? 'Saving...' : editingProjectId ? 'Update Draft' : 'Save Draft'}
              </button>
              <button type="button" onClick={()=>submit(true)} disabled={submitting||!canPublish}
                className="h-10 flex-1 rounded-lg px-5 text-sm font-bold text-white transition disabled:opacity-60 sm:flex-none"
                style={{backgroundColor:PRIMARY}}>
                {submitting ? 'Submitting...' : editingProjectId ? 'Update & Submit' : 'Submit for Review'}
              </button>
            </div>
          </div>
          <div className={`mt-3 block w-full rounded-lg border px-4 py-2.5 text-sm ${canPublish?'border-green-200 bg-green-50 text-green-800':'border-stone-200 bg-stone-50 text-stone-600'}`}>
            <div className="font-semibold">{canPublish?'Ready to submit':'Complete all required fields to submit'}</div>
          </div>
        </div>

        {msg && <div className={`mb-3 rounded-lg border p-3 text-sm ${msg.includes('Failed')||msg.includes('required')?'border-red-200 bg-red-50 text-red-700':'border-green-200 bg-green-50 text-green-700'}`}>{msg}</div>}

        {/* ── Left-Right layout (same as /designer/upload) ── */}
        <form onSubmit={e=>e.preventDefault()} className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.04fr)]">

          {/* LEFT: Project Details */}
          <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
            <div className="mb-4"><h2 className="text-lg font-bold text-[#2c2c2c]">Project Details</h2><p className="text-sm text-stone-500">Add the key project details for review.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Project Title *</label>
                <input type="text" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Enter project title" className={`${fieldCls} ${tried&&!form.title.trim()?'!border-red-400':''}`}/>
                {tried&&!form.title.trim()&&<p className="mt-1 text-xs text-red-500">Project title is required</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Briefly describe project highlights or design intent (recommended)." rows={3} className={textareaCls}/>
                <p className="mt-1 text-xs text-stone-500">Recommended: 50–200 characters.</p>
              </div>
              <div>
                <label className={labelCls}>Style *</label>
                <SelectField name="style" value={form.style} onChange={e=>setForm(p=>({...p,style:(e.target as any).value}))} className={tried&&!form.style?'!border-red-400':''}>{STYLES.map(s=><option key={s.value||'e'} value={s.value}>{s.label}</option>)}</SelectField>
                {tried&&!form.style&&<p className="mt-1 text-xs text-red-500">Please select a style</p>}
              </div>
              <div>
                <label className={labelCls}>Location (City) *</label>
                <SelectField name="location" value={form.location} onChange={e=>setForm(p=>({...p,location:(e.target as any).value}))} className={tried&&!form.location?'!border-red-400':''}>
                  <option value="">Select city</option>
                  {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                </SelectField>
                {tried&&!form.location&&<p className="mt-1 text-xs text-red-500">City is required</p>}
              </div>
              <div>
                <label className={labelCls}>Project Area</label>
                <div className="flex h-11 items-center rounded-lg border border-stone-200 bg-stone-50 px-4"><input type="text" value={form.area} onChange={e=>setForm(p=>({...p,area:e.target.value}))} placeholder="e.g. 450" inputMode="decimal" className="h-full w-full bg-transparent text-[#2c2c2c] outline-none"/><span className="text-xs text-stone-500">sqm</span></div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Renovation Tags</label>
                <p className="mb-2 text-xs text-stone-500">Select tags to classify this project (optional).</p>
                <div className="flex flex-wrap gap-2">{TAGS.map(t=>{const on=tags.includes(t);return<button key={t} type="button" onClick={()=>setTags(p=>on?p.filter(x=>x!==t):[...p,t])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on?tagOn:tagOff}`}>{t}</button>})}</div>
              </div>
            </div>
          </section>

          {/* RIGHT: Image Board — unified single block */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">
            <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-[18px] shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div><h2 className="text-lg font-bold text-[#2c2c2c]">Image Board</h2><p className="mt-0.5 text-xs text-stone-500">{imgs.length>0?`${imgs.length} images · ${formatFileSize(gb)}`:'Add images to your project'}</p></div>
                {imgs[cover]&&<div className="w-[128px] rounded-xl border border-stone-200 bg-stone-50 p-1.5"><div className="text-[10px] font-semibold text-stone-500">Cover</div><div className="mt-1 aspect-video w-full rounded-lg bg-cover bg-center" style={{backgroundImage:`url(${imgs[cover]})`}}/></div>}
              </div>

              {notice&&<div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex justify-between">{notice}<button type="button" onClick={()=>setNotice('')}><X className="w-3 h-3"/></button></div>}

              {/* Scrape result preview */}
              {scrapeRes&&<div className="rounded-xl border border-stone-200 bg-stone-50 p-3 mb-3"><div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-stone-700">Found {scrapeRes.images.length} images</span><div className="flex gap-2"><button type="button" onClick={()=>setScrapeRes(null)} className="text-xs text-stone-500">Cancel</button><button type="button" onClick={applyScrape} className="text-xs font-bold text-white px-3 py-1 rounded-lg" style={{backgroundColor:PRIMARY}}>Use these</button></div></div><div className="flex gap-1.5 overflow-x-auto pb-1">{scrapeRes.images.slice(0,8).map((img,i)=><img key={i} src={img} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-stone-200"/>)}{scrapeRes.images.length>8&&<div className="w-14 h-14 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0 text-xs">+{scrapeRes.images.length-8}</div>}</div></div>}

              {/* Unified drop zone — files, folders, or URL */}
              <input id="g-up" type="file" accept="image/*" multiple className="hidden" onChange={hFS} disabled={prepping}/>
              <input id="f-up" type="file" accept="image/*" multiple {...{webkitdirectory:'',directory:''} as any} className="hidden" onChange={hFS} disabled={prepping}/>

              <label htmlFor="g-up" onDrop={hDrop} onDragOver={e=>{e.preventDefault();setDropActive(true)}} onDragLeave={()=>setDropActive(false)}
                className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${
                  tried&&imgs.length===0 ? 'border-red-300 bg-red-50' :
                  dropActive ? 'border-[#b8864a] bg-amber-50' :
                  'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400'
                }`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ImagePlus className="h-6 w-6 text-[#b8864a]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#2c2c2c]">{prepping ? 'Processing images...' : 'Drop images or folders here'}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      Drag files, entire folders, or click to browse. JPG, PNG, WEBP. Under {formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}.
                    </div>
                  </div>
                  <label htmlFor="f-up" onClick={e=>e.stopPropagation()}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50">
                    <FolderOpen className="w-3.5 h-3.5"/>Select Folder
                  </label>
                </div>

                {/* URL import row — inside the same drop zone */}
                <div className="mt-3 pt-3 border-t border-stone-200/60" onClick={e=>e.preventDefault()}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"/>
                      <input type="url" value={scrapeUrl} onChange={e=>{e.stopPropagation();setScrapeUrl(e.target.value)}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();doScrape()}}}
                        onClick={e=>e.stopPropagation()}
                        placeholder="Or paste a URL to import images..."
                        className={fieldCls+" pl-10 !h-9 text-xs !bg-white"}/>
                    </div>
                    <button type="button" onClick={e=>{e.stopPropagation();e.preventDefault();doScrape()}} disabled={scraping||!scrapeUrl.trim()}
                      className="h-9 px-3 rounded-lg text-xs font-bold text-white transition disabled:opacity-50" style={{backgroundColor:PRIMARY}}>
                      {scraping?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'Import'}
                    </button>
                  </div>
                  {scrapeErr&&<p className="text-xs text-red-600 mt-1">{scrapeErr}</p>}
                </div>

                {tried&&imgs.length===0&&<p className="text-xs text-red-500 mt-2 text-center">Please upload at least one image</p>}
              </label>

              {/* Image grid */}
              {imgs.length>0&&(
                <div className="mt-3 max-h-[420px] overflow-y-auto pr-0.5 pb-0.5">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {imgs.map((url,i)=>(
                      <div key={i} draggable onDragStart={()=>setDragI(i)} onDragOver={e=>{e.preventDefault();if(dragO!==i)setDragO(i)}} onDrop={e=>{e.preventDefault();if(dragI!==null)mvImg(dragI,i);setDragI(null);setDragO(null)}} onDragEnd={()=>{setDragI(null);setDragO(null)}}
                        className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${cover===i?'border-[#b8864a] ring-2 ring-[#b8864a]/35':dragO===i?'border-[#b8864a]/70':'border-stone-200'} ${dragI===i?'cursor-grabbing opacity-80':'cursor-grab'}`}>
                        <img src={url} alt="" className="h-full w-full object-cover"/>
                        {cover===i&&<div className="absolute left-1.5 top-1.5 rounded-full bg-[#b8864a] px-2 py-0.5 text-[10px] font-semibold text-white">Cover</div>}
                        <div className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><GripVertical className="h-3.5 w-3.5"/></div>
                        <div className="absolute inset-0 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"/>
                        <div className="absolute inset-x-1.5 bottom-1.5 grid h-6 grid-cols-3 gap-1 opacity-0 transition group-hover:opacity-100">
                          <button type="button" onClick={()=>setPrevI(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-stone-700"><Eye className="mx-auto h-3 w-3"/></button>
                          <button type="button" onClick={()=>setCover(i)} className="rounded-md bg-white px-1 text-[10px] font-semibold text-stone-700">{cover===i?'Cover':'Set'}</button>
                          <button type="button" onClick={()=>rmImg(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-red-600"><Trash2 className="mx-auto h-3 w-3"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </form>

        {/* ── Project List ── */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-[#2c2c2c]">Project List ({projects.length})</h2>

          {projectsLoadError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              {projectsLoadError}
            </div>
          )}

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p:any)=>{
                const cover = Array.isArray(p.images)&&p.images.length>0?(typeof p.images[0]==='string'?p.images[0]:''):'';
                return(
                  <div key={p.id} className="group overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                      {cover?<img src={resolveImageUrl(cover)} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"/>:<div className="flex h-full w-full items-center justify-center text-stone-300"><Image className="h-10 w-10"/></div>}
                      <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${p.status==='published'?'bg-green-100 text-green-800':p.status==='pending'?'bg-amber-100 text-amber-800':p.status==='rejected'?'bg-red-100 text-red-800':'bg-stone-100 text-stone-700'}`}>{p.status==='published'?'Approved':p.status==='pending'?'Under Review':p.status==='rejected'?'Rejected':'Draft'}</span>
                    </div>
                    <div className="p-4">
                      <h3 className="truncate font-semibold text-[#2c2c2c]">{p.title||'Untitled'}</h3>
                      <p className="mt-1 text-xs text-stone-500">{[p.style,p.location].filter(Boolean).join(' · ')||'No details'}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg h-9 px-3 border border-stone-200 bg-white text-[#2c2c2c] text-sm font-medium hover:bg-stone-50 hover:border-[#b8864a]/30 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeProject(Number(p.id))}
                          className="inline-flex items-center justify-center rounded-lg h-9 w-9 border border-red-200 text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-stone-700">No projects yet</p>
              <p className="mt-1 text-xs text-stone-500">Create your first project above, then it will appear in this list.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {prevI!==null&&imgs[prevI]&&(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-stone-700">{prevI+1}/{imgs.length}{cover===prevI?' · Cover':''}</span><button type="button" onClick={()=>setPrevI(null)} className="rounded-full p-1 text-stone-500 hover:bg-stone-100"><X className="h-4 w-4"/></button></div>
            <div className="relative flex items-center justify-center rounded-xl bg-stone-100">
              <img src={imgs[prevI]} alt="" className="max-h-[65vh] w-auto object-contain"/>
              {imgs.length>1&&<><button type="button" onClick={()=>setPrevI(p=>(p??0)===0?imgs.length-1:(p??0)-1)} className="absolute left-3 rounded-full bg-white/90 p-2 text-stone-700"><ChevronLeft className="h-4 w-4"/></button><button type="button" onClick={()=>setPrevI(p=>((p??0)+1)%imgs.length)} className="absolute right-3 rounded-full bg-white/90 p-2 text-stone-700"><ChevronRight className="h-4 w-4"/></button></>}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setCover(prevI)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">{cover===prevI?'Current Cover':'Set as Cover'}</button>
              <button type="button" onClick={()=>{rmImg(prevI);setPrevI(p=>imgs.length<=1?null:Math.min(p??0,imgs.length-2))}} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
