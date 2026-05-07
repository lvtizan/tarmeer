import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, ImagePlus, X, MapPin, Maximize2, Banknote, CalendarDays, Layers } from 'lucide-react';
import { useAdminT } from '../../hooks/useAdminLang';
import { ScreenSpinner } from '../../components/ui/Spinner';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = { title: '', description: '', location: '', area_sqm: '', budget: '', year: '' };

export default function SupplierProjectsPage() {
  const { t } = useAdminT();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]); // data URLs / local paths
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProjects = () => {
    fetch(`${API_BASE}/suppliers/me/projects`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(data => {
        if (data?.projects) {
          setProjects(data.projects.map((p: any) => ({
            ...p,
            images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const dataUrls = await Promise.all(arr.map(fileToDataUrl));
    setImages(prev => [...prev, ...dataUrls]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    await handleFiles(e.dataTransfer.files);
  };

  const removeImage = (idx: number) =>
    setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setTried(true);
    if (!form.title.trim()) { setMsg('Title is required.'); return; }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/projects`, {
        method: 'POST',
        headers: authHeaders() as any,
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
          budget: form.budget.trim() || null,
          year: form.year.trim() || null,
          images,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(EMPTY_FORM);
      setImages([]);
      setAdding(false);
      setTried(false);
      loadProjects();
    } catch (err: any) {
      setMsg(err.message || t('Failed to save.', '保存失败。'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/projects/${id}`, { method: 'DELETE', headers: authHeaders() as any });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const cancelAdd = () => { setAdding(false); setForm(EMPTY_FORM); setImages([]); setMsg(''); setTried(false); };

  if (loading) return <ScreenSpinner />;

  return (
    <>
      <Helmet><title>Projects — Supplier Dashboard | Tarmeer</title></Helmet>

      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Projects', '项目案例')}</h1>
            <p className="text-sm text-stone-500 mt-1">{t(`${projects.length} project${projects.length !== 1 ? 's' : ''} showcased`, `已展示 ${projects.length} 个项目`)}</p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('Add Project', '添加项目')}
            </button>
          )}
        </div>

        {/* Add project form */}
        {adding && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('New Project', '新增项目')}</h2>
              <button onClick={cancelAdd} className="text-stone-400 hover:text-stone-600 transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Project images */}
            <div>
              <label className={labelCls}>{t('Project Photos', '项目图片')}</label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt="" className="w-full aspect-[4/3] object-cover rounded-xl border border-stone-200" />
                      <button onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition text-sm">
                <ImagePlus className="w-5 h-5" />
                {images.length > 0 ? t('Add more photos', '继续添加图片') : t('Upload photos (drag or click)', '上传图片（拖放或点击）')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) { handleFiles(e.target.files); e.target.value = ''; } }} />
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>{t('Project Title *', '项目名称 *')}</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={t('e.g. Luxury Villa Interior, Dubai', '如：迪拜豪华别墅室内设计')}
                className={`${inputCls} ${tried && !form.title.trim() ? '!border-red-400' : ''}`} />
              {tried && !form.title.trim() && <p className="text-xs text-red-500 mt-1">{t('Title is required', '请填写项目名称')}</p>}
            </div>

            <div>
              <label className={labelCls}>{t('Description', '项目描述')}</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                placeholder={t('Describe the project scope, materials used, design approach...', '描述项目规模、使用材料、设计方案等...')}
                className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none" />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#b8864a]" /> {t('Location', '地点')}</span>
                </label>
                <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={t('e.g. Palm Jumeirah, Dubai', '如：Palm Jumeirah, 迪拜')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5"><Maximize2 className="w-3.5 h-3.5 text-[#b8864a]" /> {t('Area (m²)', '面积（m²）')}</span>
                </label>
                <input type="number" value={form.area_sqm} onChange={e => setForm(f => ({ ...f, area_sqm: e.target.value }))}
                  placeholder="350" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-[#b8864a]" /> {t('Budget', '预算')}</span>
                </label>
                <input type="text" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="AED 500,000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-[#b8864a]" /> {t('Year', '年份')}</span>
                </label>
                <input type="text" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="2024" className={inputCls} />
              </div>
            </div>

            {msg && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-2xl">{msg}</p>}

            <div className="flex gap-3">
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Plus className="w-4 h-4" />
                {saving ? t('Saving...', '保存中...') : t('Save Project', '保存项目')}
              </button>
              <button onClick={cancelAdd} className="h-11 px-5 rounded-2xl border border-stone-200 text-[15px] text-stone-600 hover:bg-stone-50 transition">
                {t('Cancel', '取消')}
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        {projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map(proj => {
              const imgs: string[] = Array.isArray(proj.images) ? proj.images : [];
              return (
                <div key={proj.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                  {imgs.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-0.5">
                      {imgs.slice(0, 4).map((img, i) => (
                        <div key={i} className="relative">
                          <img src={img} alt="" className="w-full aspect-[4/3] object-cover" />
                          {i === 3 && imgs.length > 4 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-semibold">
                              +{imgs.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold text-[#2c2c2c]">{proj.title}</h3>
                        {proj.description && <p className="text-sm text-stone-500 mt-1 line-clamp-2">{proj.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-2">
                          {proj.location && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><MapPin className="w-3.5 h-3.5 text-[#b8864a]" />{proj.location}</span>}
                          {proj.area_sqm && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Maximize2 className="w-3.5 h-3.5 text-[#b8864a]" />{proj.area_sqm} m²</span>}
                          {proj.budget && <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Banknote className="w-3.5 h-3.5 text-[#b8864a]" />{proj.budget}</span>}
                          {proj.year && <span className="inline-flex items-center gap-1 text-xs text-stone-400"><CalendarDays className="w-3.5 h-3.5" />{proj.year}</span>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(proj.id)}
                        className="shrink-0 w-9 h-9 rounded-xl border border-red-100 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition"
                        aria-label="Delete project">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !adding ? (
          <div className="bg-white rounded-2xl border border-stone-200 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <Layers className="w-8 h-8 text-stone-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{t('No projects yet', '暂无项目')}</h3>
            <p className="text-sm text-stone-500 mb-5">{t('Showcase completed projects to attract clients.', '展示已完成项目，吸引更多客户。')}</p>
            <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('Add Project', '添加项目')}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
