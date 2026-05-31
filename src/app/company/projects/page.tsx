'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolveImageUrl } from '@/lib/imageUrl';
import {
  ImagePlus, Trash2, Eye, GripVertical, X, ChevronLeft, ChevronRight,
  Link2, Loader2, FolderOpen, Image, Pencil, AlertCircle, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getDroppedImageFiles } from '@/lib/dropFiles';
import SelectField from '@/components/form/SelectField';
import AdminSelect from '@/components/ui/AdminSelect';
import {
  convertProjectImagesForUpload, estimateDataUrlBytes, formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES, MAX_TOTAL_UPLOAD_BYTES, buildUploadSizeMessage,
} from '@/lib/projectImageUpload';
import { findDuplicates } from '@/lib/imageDedup';
import { SPACE_TAXONOMY } from '@/lib/tagTaxonomy';
import { useServiceCategories } from '@/hooks/useServiceCategories';

const PRIMARY = '#b8864a';
const STYLES = [{ value:'', label:'Select a style' },{ value:'modern', label:'Modern Contemporary' },{ value:'islamic', label:'Modern Islamic' },{ value:'classic', label:'Neo-Classic' },{ value:'minimalist', label:'Minimalist' },{ value:'industrial', label:'Industrial' }];
const CITIES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain','Riyadh','Jeddah','Other'];
const SPACE_L1_OPTIONS = [
  { value: '', label: 'Select project type…' },
  ...SPACE_TAXONOMY.map(g => ({ value: g.id, label: g.label })),
];

const fieldCls = "h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35";
const textareaCls = "w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35 resize-none";
const labelCls = "mb-2 block text-sm font-semibold text-stone-700";
const tagOn = "border-[#b8864a] bg-[#b8864a] text-white";
const tagOff = "border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45";

function reorder<T>(a: T[], f: number, t: number): T[] { if(f===t)return a; const n=[...a]; const[m]=n.splice(f,1); n.splice(t,0,m); return n; }

function parseMaybeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    try { const p = JSON.parse(value); return Array.isArray(p) ? p.map(item => String(item)).filter(Boolean) : []; } catch { return []; }
  }
  return [];
}

interface ImageEntry {
  url: string;
  tag?: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}

function parseImageEntries(value: unknown): ImageEntry[] {
  const raw = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).map((item: unknown) => {
    if (typeof item === 'string') return { url: item };
    if (item && typeof item === 'object' && (item as Record<string, unknown>).url) return item as ImageEntry;
    return { url: '' };
  }).filter(e => e.url);
}

function CompanyProjectsInner() {
  const dynamicServiceCategories = useServiceCategories();
  const [searchParams] = useSearchParams() as unknown as [URLSearchParams, (params: URLSearchParams) => void];
  const highlightId = searchParams.get('projectId') ? Number(searchParams.get('projectId')) : null;

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState({ title:'', description:'', style:'', location:'', area:'', video_url:'' });
  const [spaceL1, setSpaceL1] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [serviceTags, setServiceTags] = useState<string[]>([]);
  const [serviceDropOpen, setServiceDropOpen] = useState(false);
  const [hoveredCat, setHoveredCat] = useState(0);
  const serviceDropRef = useRef<HTMLDivElement>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  const [imgs, setImgs] = useState<string[]>([]);
  const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);
  const [imgTags, setImgTags] = useState<(string | undefined)[]>([]);
  const [checkedImgs, setCheckedImgs] = useState<Set<number>>(new Set());
  const [fps, setFps] = useState<string[]>([]);
  const [cover, setCover] = useState(0);
  const [prepping, setPrepping] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dragI, setDragI] = useState<number|null>(null);
  const [dragO, setDragO] = useState<number|null>(null);
  const [prevI, setPrevI] = useState<number|null>(null);
  const [notice, setNotice] = useState('');

  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeRes, setScrapeRes] = useState<{images:string[];title:string}|null>(null);
  const [scrapeErr, setScrapeErr] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [tried, setTried] = useState(false);

  const [projects, setProjects] = useState<unknown[]>([]);
  const [projectsLoadError, setProjectsLoadError] = useState('');

  const highlightRef = useRef<HTMLDivElement | null>(null);

  const showNotice = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

  const refreshProjects = useCallback(() => {
    setProjectsLoadError('');
    api.get('/auth/company/projects')
      .then((d: unknown) => {
        const data = d as { projects?: unknown[] } | unknown[] | null;
        const raw = Array.isArray((data as { projects?: unknown[] })?.projects)
          ? (data as { projects: unknown[] }).projects
          : Array.isArray(data) ? data : [];
        setProjects(raw.map((project: unknown) => {
          const p = project as Record<string, unknown>;
          return {
            ...p,
            images: parseImageEntries(p.images).map(e => e.url),
            tags: parseMaybeArray(p.tags),
          };
        }));
      })
      .catch(() => setProjectsLoadError('Failed to load projects. Please refresh the page.'));
  }, []);
  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  useEffect(() => {
    if (!serviceDropOpen) return;
    const h = (e: MouseEvent) => {
      if (!serviceDropRef.current?.contains(e.target as Node)) setServiceDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [serviceDropOpen]);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, projects]);

  const addFiles = async (files: FileList | File[]) => {
    const raw = Array.from(files).filter(f => f.type.startsWith('image/'));
    const existing = new Set(fps.filter(Boolean));
    const unique = raw.filter(f => !existing.has(`${f.name}:${f.size}:${f.lastModified}`));
    if (!unique.length) { showNotice('No new images.'); return; }
    const tb = unique.reduce((s, f) => s + f.size, 0);
    if (tb > MAX_TOTAL_UPLOAD_BYTES) { showNotice(buildUploadSizeMessage(tb)); return; }
    setPrepping(true); setNotice('');
    try {
      const p = await convertProjectImagesForUpload(unique);
      const eb = imgs.reduce((s, u) => s + estimateDataUrlBytes(u), 0);
      if (eb + p.estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) { showNotice(`Too large. Keep under ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)}.`); return; }

      const { duplicateIndices } = await findDuplicates(p.dataUrls, imgs);
      const dedupedUrls = p.dataUrls.filter((_, i) => !duplicateIndices.includes(i));
      const dedupedFps = unique.filter((_, i) => !duplicateIndices.includes(i));
      if (duplicateIndices.length > 0) showNotice(`${duplicateIndices.length} duplicate image(s) removed automatically.`);
      if (dedupedUrls.length === 0) { if (!duplicateIndices.length) showNotice('No new images.'); return; }

      setImgs(prev => [...prev, ...dedupedUrls]);
      setFps(prev => [...prev, ...dedupedFps.map(f => `${f.name}:${f.size}:${f.lastModified}`)]);
      setImgTags(prev => [...prev, ...Array(dedupedUrls.length).fill(undefined)]);
    } catch (e: unknown) { showNotice((e as { message?: string })?.message || 'Failed'); }
    finally { setPrepping(false); }
  };

  const hFS = async (e: React.ChangeEvent<HTMLInputElement>) => { if(e.target.files?.length){ await addFiles(e.target.files); e.target.value=''; } };
  const hDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDropActive(false);
    const result = await getDroppedImageFiles(e);
    if (result.files.length > 0) {
      if (result.folderName && !form.title.trim()) setForm(p => ({ ...p, title: result.folderName! }));
      await addFiles(result.files);
    }
  };
  const rmImg = (i: number) => {
    setImgs(p => p.filter((_,x) => x!==i));
    setFps(p => p.filter((_,x) => x!==i));
    setImgTags(p => p.filter((_,x) => x!==i));
    setCheckedImgs(prev => {
      const next = new Set<number>();
      prev.forEach(x => { if(x<i) next.add(x); else if(x>i) next.add(x-1); });
      return next;
    });
    if(cover>=i&&cover>0) setCover(c => c-1);
  };
  const mvImg = (f: number, t: number) => {
    setImgs(p => reorder(p,f,t));
    setFps(p => reorder(p,f,t));
    setImgTags(p => reorder(p,f,t));
    if(cover===f) setCover(t);
  };
  const toggleCheck = (i: number) => {
    setCheckedImgs(prev => { const next = new Set(prev); if(next.has(i)) next.delete(i); else next.add(i); return next; });
  };

  const doScrape = async () => {
    if(!scrapeUrl.trim()) return; setScraping(true); setScrapeErr(''); setScrapeRes(null);
    try {
      const d = await api.post('/auth/company/scrape-portfolio', { url: scrapeUrl.trim() }) as { images?: string[]; title?: string } | null;
      if(!d?.images?.length){ setScrapeErr('No images found.'); return; }
      setScrapeRes({ images: d.images, title: d.title || '' });
    } catch(e: unknown) { setScrapeErr((e as { message?: string })?.message || 'Failed'); } finally { setScraping(false); }
  };
  const applyScrape = () => {
    if(!scrapeRes) return;
    setImgs(p => [...p, ...scrapeRes.images]);
    setFps(p => [...p, ...scrapeRes.images.map((u,i) => `s:${i}:${u.slice(-30)}`)]);
    setImgTags(p => [...p, ...Array(scrapeRes.images.length).fill(undefined)]);
    setScrapeRes(null); setScrapeUrl('');
  };

  const submit = async (publish: boolean) => {
    setTried(true);
    if(!form.title.trim() || !form.location || imgs.length===0) {
      showNotice('Please complete all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const orderedIndices = [cover, ...imgs.map((_,i) => i).filter(i => i!==cover)];
      const ordered = orderedIndices.map(i => imgs[i]);
      const orderedTags = orderedIndices.map(i => imgTags[i]);
      const imagesPayload = ordered.map((url, i) => {
        const tag = orderedTags[i];
        return tag ? { url, tag } : url;
      });
      const payload = {
        title: form.title, description: form.description, style: form.style,
        space_type: spaceL1 || null, location: form.location, area: form.area,
        video_url: form.video_url || null, images: imagesPayload, tags,
        service_tags: serviceTags, status: publish ? 'pending' : 'draft',
      };

      if (editingProjectId) {
        await api.put(`/projects/${editingProjectId}`, payload);
        showNotice(publish ? 'Project updated!' : 'Draft updated!');
      } else {
        await api.post('/projects', payload);
        if (publish && projects.length === 0) {
          try { await api.post('/auth/company/profile', {}); } catch {/* no-op */}
          showNotice('Project uploaded! Your profile has been submitted for review.');
        } else {
          showNotice(publish ? 'Project submitted for review!' : 'Draft saved!');
        }
      }

      setEditingProjectId(null);
      setForm({title:'',description:'',style:'',location:'',area:'',video_url:''});
      setSpaceL1(''); setTags([]); setServiceTags([]); setImgs([]); setFps([]);
      setImageEntries([]); setImgTags([]); setCheckedImgs(new Set()); setCover(0);
      setMode('list');
      refreshProjects();
    } catch(e: unknown) { showNotice((e as { message?: string })?.message || 'Failed'); } finally { setSubmitting(false); }
  };

  const startEdit = (project: Record<string, unknown>) => {
    const entries = parseImageEntries(project.images);
    const projectImages = entries.map(e => e.url).filter(Boolean);
    setEditingProjectId(Number(project.id));
    setForm({
      title: (project.title as string) || '', description: (project.description as string) || '',
      style: (project.style as string) || '', location: (project.location as string) || '',
      area: (project.area as string) || '', video_url: (project.video_url as string) || '',
    });
    setImageEntries(entries);
    setImgTags(entries.map(e => e.tag || undefined));
    const aiCategories = entries.flatMap(e => e.ai_category || []);
    const spaceTags = parseMaybeArray(project.tags);
    const mergedTags = aiCategories.length > 0 ? [...new Set([...spaceTags, ...aiCategories])] : spaceTags;
    setTags(mergedTags);
    const loadedServiceTags = parseMaybeArray(project.service_tags);
    setServiceTags(loadedServiceTags);
    const firstActiveCatIdx = dynamicServiceCategories.findIndex(c => c.subs.some(s => loadedServiceTags.includes(s)));
    if (firstActiveCatIdx >= 0) setHoveredCat(firstActiveCatIdx);
    setSpaceL1((project.space_type as string) || '');
    setImgs(projectImages);
    setFps(projectImages.map((url, index) => `existing:${project.id}:${index}:${url.slice(-30)}`));
    setCover(0); setTried(false); setMode('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingProjectId(null);
    setForm({title:'',description:'',style:'',location:'',area:'',video_url:''});
    setSpaceL1(''); setTags([]); setServiceTags([]); setImgs([]); setFps([]);
    setImageEntries([]); setImgTags([]); setCheckedImgs(new Set()); setCover(0);
    setTried(false); setMode('list');
  };

  const removeProject = async (projectId: number) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      if (editingProjectId === projectId) cancelEdit();
      refreshProjects();
      showNotice('Project deleted.');
    } catch (error: unknown) {
      showNotice((error as { message?: string })?.message || 'Failed to delete project.');
    }
  };

  const canPublish = !!(form.title.trim() && form.location && imgs.length > 0);
  const gb = imgs.reduce((s, u) => s + estimateDataUrlBytes(u), 0);
  const missingFields: string[] = [];
  if(!form.title.trim()) missingFields.push('title');
  if(!form.location) missingFields.push('city');
  if(imgs.length===0) missingFields.push('images');

  /* List view */
  if (mode === 'list') {
    return (
      <div className="w-full">
        <div className="w-full">
          {/* Rejected projects banner */}
          {(projects as Record<string, unknown>[]).filter(p => p.status === 'rejected').length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {(projects as Record<string, unknown>[]).filter(p => p.status === 'rejected').length === 1
                    ? `"${(projects as Record<string, unknown>[]).find(p => p.status === 'rejected')?.title}" was not approved`
                    : `${(projects as Record<string, unknown>[]).filter(p => p.status === 'rejected').length} projects need your attention`}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Review the reason below and resubmit after making changes.</p>
              </div>
            </div>
          )}
          {/* Ranking tip banner */}
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#b8864a]/[0.08] border border-[#b8864a]/20 px-4 py-3">
            <span className="text-base">🏆</span>
            <p className="text-sm text-[#7a5c2e] leading-snug">
              Each project you upload adds <strong>+10 points</strong> to your ranking score. More projects means higher visibility to potential clients.
            </p>
          </div>
          {/* Header */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#2c2c2c]">My Projects ({projects.length})</h1>
              <p className="mt-0.5 text-sm text-stone-500">Manage your portfolio projects.</p>
            </div>
            <button
              type="button"
              onClick={() => setMode('form')}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              <ImagePlus className="h-4 w-4" />
              New Project
            </button>
          </div>

          {notice && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              {notice}
            </div>
          )}

          {projectsLoadError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              {projectsLoadError}
            </div>
          )}

          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(projects as Record<string, unknown>[]).map(p => {
                const firstImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                const coverImg = typeof firstImage === 'string' ? firstImage : (firstImage && typeof firstImage === 'object' && (firstImage as Record<string, unknown>).url ? (firstImage as Record<string, unknown>).url as string : '');
                return (
                  <div
                    key={p.id as string}
                    ref={highlightId === p.id ? highlightRef : null}
                    className={`group overflow-hidden rounded-[20px] border bg-white shadow-sm transition-shadow hover:shadow-md ${
                      highlightId === p.id ? 'border-[#b8864a] ring-2 ring-[#b8864a]/30' : 'border-stone-200'
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                      {coverImg
                        ? <img src={resolveImageUrl(coverImg)} alt={p.title as string} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        : <div className="flex h-full w-full items-center justify-center text-stone-300"><Image className="h-10 w-10" /></div>}
                      <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${p.status === 'published' ? 'bg-green-100 text-green-800' : p.status === 'pending' ? 'bg-amber-100 text-amber-800' : p.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-stone-100 text-stone-700'}`}>
                        {p.status === 'published' ? 'Approved' : p.status === 'pending' ? 'Under Review' : p.status === 'rejected' ? 'Not Approved' : 'Draft'}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="truncate font-semibold text-[#2c2c2c]">{(p.title as string) || 'Untitled'}</h3>
                      <p className="mt-1 text-xs text-stone-500">{[p.style, p.location].filter(Boolean).join(' · ') || 'No details'}</p>
                      {p.status === 'rejected' && p.rejection_reason ? (
                        <p className="mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                          <span className="font-semibold">Reason: </span>{p.rejection_reason as string}
                        </p>
                      ) : null}
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
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b8864a]/10">
                <FolderOpen className="h-7 w-7 text-[#b8864a]" />
              </div>
              <p className="text-sm font-semibold text-stone-700">No projects yet</p>
              <p className="mt-1 text-xs text-stone-500 mb-4">Upload your first portfolio project to get started.</p>
              <button
                type="button"
                onClick={() => setMode('form')}
                className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                <ImagePlus className="h-4 w-4" />
                Upload First Project
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Form view */
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-7 pb-24">

        <div className="mb-3">
          <button
            type="button"
            onClick={cancelEdit}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Projects
          </button>
          <h1 className="text-2xl font-bold text-[#2c2c2c]">{editingProjectId ? 'Edit Project' : 'Upload New Project'}</h1>
          <p className="text-sm text-stone-500">Complete your project and submit it for review.</p>
        </div>

        {/* Fixed bottom action bar */}
        <div className="fixed left-0 right-0 bottom-[62px] md:bottom-0 md:left-64 z-30 border-t border-stone-200 bg-white px-6 py-3 shadow-[0_-4px_16px_rgba(28,18,8,0.07)]">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3">
            <div className={`flex-1 text-sm font-medium truncate ${canPublish ? 'text-green-700' : 'text-stone-500'}`}>
              {canPublish ? '✓ Ready to submit' : missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : 'Complete required fields'}
            </div>
            <button type="button" onClick={() => submit(false)} disabled={submitting || imgs.length===0}
              className="h-9 shrink-0 rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50">
              {submitting ? 'Saving...' : editingProjectId ? 'Update Draft' : 'Save Draft'}
            </button>
            <button type="button" onClick={() => submit(true)} disabled={submitting || !canPublish}
              className="h-9 shrink-0 rounded-lg px-5 text-sm font-bold text-white transition disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}>
              {submitting ? 'Submitting...' : editingProjectId ? 'Update & Submit' : 'Submit for Review'}
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex justify-between items-center">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        <form onSubmit={e => e.preventDefault()} className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.04fr)]">

          {/* LEFT: Project Details */}
          <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
            <div className="mb-4"><h2 className="text-lg font-bold text-[#2c2c2c]">Project Details</h2><p className="text-sm text-stone-500">Add the key project details for review.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Project Title <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({...p,title:e.target.value}))} placeholder="e.g. Palm Jumeirah - Villa - Full Renovation" className={`${fieldCls} ${tried&&!form.title.trim()?'!border-red-400':''}`}/>
                {tried&&!form.title.trim()&&<p className="mt-1 text-xs text-red-500">Project title is required</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p,description:e.target.value}))} placeholder="Briefly describe project highlights or design intent." rows={3} className={textareaCls}/>
                <p className="mt-1 text-xs text-stone-500">Recommended: 50–200 characters.</p>
              </div>
              <div>
                <label className={labelCls}>Style <span className="text-stone-400 font-normal">(optional)</span></label>
                <SelectField name="style" value={form.style} onChange={e => setForm(p => ({...p,style:(e.target as HTMLSelectElement).value}))}>{STYLES.map(s=><option key={s.value||'e'} value={s.value}>{s.label}</option>)}</SelectField>
              </div>
              <div>
                <label className={labelCls}>Location (City) <span className="text-red-500">*</span></label>
                <SelectField name="location" value={form.location} onChange={e => setForm(p => ({...p,location:(e.target as HTMLSelectElement).value}))} className={tried&&!form.location?'!border-red-400':''}>
                  <option value="">Select city</option>
                  {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                </SelectField>
                {tried&&!form.location&&<p className="mt-1 text-xs text-red-500">City is required</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Project Area</label>
                <div className="flex h-11 items-center rounded-lg border border-stone-200 bg-stone-50 px-4"><input type="text" value={form.area} onChange={e => setForm(p => ({...p,area:e.target.value}))} placeholder="e.g. 450" inputMode="decimal" className="h-full w-full bg-transparent text-[#2c2c2c] outline-none"/><span className="text-xs text-stone-500">sqm</span></div>
              </div>
              <div>
                <label className={labelCls}>Space Type</label>
                <AdminSelect value={spaceL1} onChange={v => setSpaceL1(v)} options={SPACE_L1_OPTIONS} className="w-full" />
              </div>
              <div>
                <label className={labelCls}>Service Tags <span className="font-normal text-stone-400">(optional)</span></label>
                <div className="relative" ref={serviceDropRef}>
                  <button
                    type="button"
                    onClick={() => setServiceDropOpen(p => !p)}
                    className={`flex h-[50px] w-full items-center justify-between rounded-2xl border px-5 text-[15px] transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 ${
                      serviceDropOpen ? 'border-[#b8864a] bg-white' : 'border-stone-200 bg-stone-50/80 hover:bg-white'
                    }`}
                  >
                    <span className={`truncate ${serviceTags.length > 0 ? 'text-[#1c1917]' : 'text-stone-400'}`}>
                      {serviceTags.length > 0 ? serviceTags.join(', ') : 'Select services…'}
                    </span>
                    <svg className={`flex-shrink-0 ml-2 w-4 h-4 text-stone-400 transition-transform ${serviceDropOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {serviceDropOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 min-w-[480px] w-full flex overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
                      <div className="w-48 flex-shrink-0 border-r border-stone-100">
                        <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-widest uppercase text-[#b8864a]">Service Type</div>
                        {dynamicServiceCategories.map((cat, i) => {
                          const hasSelected = cat.subs.some(s => serviceTags.includes(s));
                          return (
                            <button key={cat.name} type="button" onMouseEnter={() => setHoveredCat(i)} onClick={() => setHoveredCat(i)}
                              className={`flex w-full items-center justify-between gap-1 px-3 py-2.5 text-sm leading-snug transition ${hoveredCat===i?'bg-stone-50 font-semibold text-[#b8864a]':'text-[#2c2c2c] hover:bg-stone-50'}`}>
                              <span className="flex-1 text-left">{cat.name}</span>
                              {hasSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#b8864a] shrink-0 mr-1" />}
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-300" />
                            </button>
                          );
                        })}
                        <div className="h-3" />
                      </div>
                      <div className="flex-1 overflow-y-auto max-h-[420px]">
                        {dynamicServiceCategories[hoveredCat] && (
                          <>
                            <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold tracking-widest uppercase text-[#b8864a]">
                              {dynamicServiceCategories[hoveredCat].name}
                            </div>
                            {(dynamicServiceCategories[hoveredCat].subs ?? []).map(t => {
                              const on = serviceTags.includes(t);
                              return (
                                <button key={t} type="button"
                                  onClick={() => setServiceTags(p => on ? p.filter(x => x!==t) : [...p, t])}
                                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition border-b border-stone-50 last:border-0 ${on?'text-[#b8864a] font-semibold bg-[#b8864a]/5':'text-[#2c2c2c] hover:bg-stone-50'}`}>
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${on?'border-[#b8864a] bg-[#b8864a]':'border-stone-300 bg-white'}`}>
                                    {on && <Check className="h-3 w-3 text-white" />}
                                  </span>
                                  <span>{t}</span>
                                </button>
                              );
                            })}
                            <div className="h-3" />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Image Board */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">
            <section className={`min-w-0 rounded-[24px] border bg-white p-[18px] shadow-[0_18px_50px_rgba(28,18,8,0.06)] ${tried&&imgs.length===0?'border-red-400':'border-stone-200'}`}>
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div><h2 className="text-lg font-bold text-[#2c2c2c]">Image Board</h2><p className="mt-0.5 text-xs text-stone-500">{imgs.length>0?`${imgs.length} images · ${formatFileSize(gb)}`:'Add images to your project'}</p></div>
                {imgs[cover]&&<div className="w-[128px] rounded-xl border border-stone-200 bg-stone-50 p-1.5"><div className="text-[10px] font-semibold text-stone-500">Cover</div><div className="mt-1 aspect-video w-full rounded-lg bg-cover bg-center" style={{backgroundImage:`url(${imgs[cover]})`}}/></div>}
              </div>

              {tried&&imgs.length===0&&<p className="mb-2 text-xs text-red-500">At least one project image is required</p>}

              {scrapeRes&&<div className="rounded-xl border border-stone-200 bg-stone-50 p-3 mb-3"><div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-stone-700">Found {scrapeRes.images.length} images</span><div className="flex gap-2"><button type="button" onClick={()=>setScrapeRes(null)} className="text-xs text-stone-500">Cancel</button><button type="button" onClick={applyScrape} className="text-xs font-bold text-white px-3 py-1 rounded-lg" style={{backgroundColor:PRIMARY}}>Use these</button></div></div><div className="flex gap-1.5 overflow-x-auto pb-1">{scrapeRes.images.slice(0,8).map((img,i)=><img key={i} src={img} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-stone-200"/>)}{scrapeRes.images.length>8&&<div className="w-14 h-14 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0 text-xs">+{scrapeRes.images.length-8}</div>}</div></div>}

              <input id="g-up" type="file" accept="image/*" multiple className="hidden" onChange={hFS} disabled={prepping}/>
              <input id="f-up" type="file" accept="image/*" multiple {...{webkitdirectory:'',directory:''} as React.InputHTMLAttributes<HTMLInputElement>} className="hidden" onChange={hFS} disabled={prepping}/>

              <label htmlFor="g-up" onDrop={hDrop} onDragOver={e=>{e.preventDefault();setDropActive(true)}} onDragLeave={()=>setDropActive(false)}
                className={`block cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${tried&&imgs.length===0?'border-red-300 bg-red-50':dropActive?'border-[#b8864a] bg-amber-50':'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-stone-400'}`}>
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <ImagePlus className="h-6 w-6 text-[#b8864a]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#2c2c2c]">{prepping ? 'Processing images...' : 'Drop images or folders here'}</div>
                    <div className="text-xs text-stone-500 mt-0.5">Drag files, entire folders, or click to browse. JPG, PNG, WEBP. Under {formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}.</div>
                  </div>
                  <label htmlFor="f-up" onClick={e=>e.stopPropagation()}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50">
                    <FolderOpen className="w-3.5 h-3.5"/>Select Folder
                  </label>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-200/60" onClick={e=>e.preventDefault()}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"/>
                      <input type="url" value={scrapeUrl} onChange={e=>{e.stopPropagation();setScrapeUrl(e.target.value)}}
                        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();doScrape()}}}
                        onClick={e=>e.stopPropagation()}
                        placeholder="Or paste a URL to import images..."
                        className={`${fieldCls} pl-10 !h-9 text-xs !bg-white`}/>
                    </div>
                    <button type="button" onClick={e=>{e.stopPropagation();e.preventDefault();doScrape()}} disabled={scraping||!scrapeUrl.trim()}
                      className="h-9 px-3 rounded-lg text-xs font-bold text-white transition disabled:opacity-50" style={{backgroundColor:PRIMARY}}>
                      {scraping?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:'Import'}
                    </button>
                  </div>
                  {scrapeErr&&<p className="text-xs text-red-600 mt-1">{scrapeErr}</p>}
                </div>
              </label>

              {imgs.length>0&&(
                <div className="mt-3 max-h-[540px] overflow-y-auto pr-0.5 pb-0.5">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {imgs.map((url,i)=>{
                      const entry = imageEntries.find(e => e.url === url || url.includes(e.url) || e.url.includes(url));
                      const isChecked = checkedImgs.has(i);
                      const isCover = cover === i;
                      const imgTag = imgTags[i];
                      return (
                        <div key={i} className="flex flex-col">
                          <div draggable onDragStart={()=>setDragI(i)} onDragOver={e=>{e.preventDefault();if(dragO!==i)setDragO(i)}} onDrop={e=>{e.preventDefault();if(dragI!==null)mvImg(dragI,i);setDragI(null);setDragO(null)}} onDragEnd={()=>{setDragI(null);setDragO(null)}}
                            className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${isCover?'border-[#b8864a] ring-2 ring-[#b8864a]/35':isChecked?'border-[#b8864a] ring-2 ring-[#b8864a]/55':dragO===i?'border-[#b8864a]/70':'border-stone-200'} ${dragI===i?'cursor-grabbing opacity-80':'cursor-grab'}`}>
                            <img src={url} alt="" className="h-full w-full object-cover"/>
                            <button type="button" onClick={e=>{e.stopPropagation();toggleCheck(i);}}
                              className={`absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm transition ${isChecked||isCover?'bg-[#b8864a]':'bg-black/35 hover:bg-black/55'}`}>
                              {isChecked?<Check className="h-2.5 w-2.5 text-white" strokeWidth={3}/>:isCover?<span className="text-[9px] text-white leading-none">★</span>:null}
                            </button>
                            <div className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><GripVertical className="h-3.5 w-3.5"/></div>
                            {imgTag && (
                              <button type="button" onClick={e=>{e.stopPropagation();setImgTags(prev=>{const next=[...prev];next[i]=undefined;return next;});}}
                                className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded-full bg-[#b8864a]/90 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-[#b8864a] transition group-hover:opacity-0" title="Click to remove tag">
                                {imgTag.length > 9 ? imgTag.slice(0,9)+'…' : imgTag}
                              </button>
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"/>
                            <div className="absolute inset-x-1.5 bottom-1.5 grid h-6 grid-cols-3 gap-1 opacity-0 transition group-hover:opacity-100">
                              <button type="button" onClick={()=>setPrevI(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-stone-700"><Eye className="mx-auto h-3 w-3"/></button>
                              <button type="button" onClick={()=>setCover(i)} className="rounded-md bg-white px-1 text-[10px] font-semibold text-stone-700">{isCover?'Cover':'Set'}</button>
                              <button type="button" onClick={()=>rmImg(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-red-600"><Trash2 className="mx-auto h-3 w-3"/></button>
                            </div>
                          </div>
                          {entry?.ai_tags && entry.ai_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 px-1">
                              {entry.ai_tags.slice(0,4).map(tag=>(
                                <span key={tag} className="inline-flex px-1.5 py-0.5 rounded text-[10px] bg-[#b8864a]/10 text-[#b8864a]">{tag}</span>
                              ))}
                              {entry.ai_tags.length > 4 && <span className="text-[10px] text-stone-400">+{entry.ai_tags.length-4}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {checkedImgs.size > 0 && (
                    <div className="mt-2 rounded-xl border border-[#b8864a]/30 bg-[#b8864a]/[0.06] px-3 py-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-[#7a5c2e]">Assign tag to {checkedImgs.size} image{checkedImgs.size > 1 ? 's' : ''}</p>
                        <button type="button" onClick={()=>setCheckedImgs(new Set())} className="text-[11px] text-stone-400 hover:text-stone-600 transition">Cancel</button>
                      </div>
                      {spaceL1 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(SPACE_TAXONOMY.find(g=>g.id===spaceL1)?.tags||[]).map(t=>{
                            const allHaveTag = checkedImgs.size > 0 && [...checkedImgs].every(idx=>imgTags[idx]===t);
                            return (
                              <button key={t} type="button"
                                onClick={()=>{
                                  setImgTags(prev=>{const next=[...prev];checkedImgs.forEach(idx=>{next[idx]=allHaveTag?undefined:t;});return next;});
                                  if(!allHaveTag) setCheckedImgs(new Set());
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${allHaveTag?tagOn:tagOff}`}
                              >{t}</button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500 italic">Select a project type above first to assign image tags.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Video URL */}
            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
              <div className="mb-3"><h2 className="text-base font-bold text-[#2c2c2c]">Video</h2></div>
              <label className={labelCls}>YouTube URL <span className="text-stone-400 font-normal">(optional)</span></label>
              <div className="relative mt-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>
                <input type="url" value={form.video_url} onChange={e=>setForm(p=>({...p,video_url:e.target.value}))} placeholder="https://www.youtube.com/watch?v=..." className={`${fieldCls} pl-9`}/>
              </div>
              <p className="mt-1 text-xs text-stone-500">Optional. Video will be embedded on the project page.</p>
            </section>
          </aside>
        </form>
      </div>

      {/* Lightbox */}
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

export default function CompanyProjectsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" /></div>}>
      <CompanyProjectsInner />
    </Suspense>
  );
}
