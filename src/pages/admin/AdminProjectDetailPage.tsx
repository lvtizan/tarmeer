import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import { showToast } from '../../components/ui/Toast';
import { useAdminT } from '../../hooks/useAdminLang';

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

interface ProjectData {
  id: number;
  title: string;
  description: string | null;
  style: string | null;
  location: string | null;
  year: number | null;
  images: string[];
  tags: string[];
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface ProjectListItem {
  id: number;
  title: string;
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-stone-100 text-stone-600',
};

export default function AdminProjectDetailPage() {
  const { companyId, projectId } = useParams<{ companyId: string; projectId: string }>();
  const { t } = useAdminT();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const fromPath = (routerLocation.state as { from?: string } | null)?.from;

  const isNew = projectId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allProjects, setAllProjects] = useState<ProjectListItem[]>([]);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('');
  const [location, setLocation] = useState('');
  const [year, setYear] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState('draft');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const didDragRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const lightboxPrev = useCallback(() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const lightboxNext = useCallback(() => setLightboxIdx((i) => (i !== null && i < images.length - 1 ? i + 1 : i)), [images.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, closeLightbox, lightboxPrev, lightboxNext]);

  const loadProject = async () => {
    if (!companyId || !projectId) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, companyData] = await Promise.all([
        adminApi.getAdminProject(companyId, projectId),
        adminApi.getCompanyProfileDetail(Number(companyId)),
      ]);
      const p: ProjectData = projectData.project || projectData;
      setTitle(p.title || '');
      setDescription(p.description || '');
      setStyle(p.style || '');
      setLocation(p.location || '');
      setYear(p.year ? String(p.year) : '');
      setImages(p.images || []);
      setStatus(p.status || 'draft');

      const projects = (companyData.projects || []) as ProjectListItem[];
      setAllProjects(projects.map((pr: any) => ({ id: pr.id, title: pr.title })));
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectList = async () => {
    if (!companyId) return;
    try {
      const companyData = await adminApi.getCompanyProfileDetail(Number(companyId));
      const projects = (companyData.projects || []) as ProjectListItem[];
      setAllProjects(projects.map((pr: any) => ({ id: pr.id, title: pr.title })));
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    if (isNew) {
      loadProjectList();
    } else {
      loadProject();
    }
  }, [companyId, projectId]);

  // Prev/Next navigation
  const currentIndex = allProjects.findIndex((p) => p.id === Number(projectId));
  const prevProject = currentIndex > 0 ? allProjects[currentIndex - 1] : null;
  const nextProject = currentIndex < allProjects.length - 1 ? allProjects[currentIndex + 1] : null;

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    setError('');
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        style: style.trim() || null,
        location: location.trim() || null,
        year: year ? Number(year) : null,
        images,
      };
      if (isNew) {
        const result = await adminApi.createAdminProject(companyId, data);
        const newId = result.project?.id || result.id;
        if (newId) {
          navigate(`/admin/profile-companies/${companyId}/projects/${newId}`, { replace: true });
        } else {
          navigate(`/admin/profile-companies/${companyId}`, { replace: true });
        }
        return;
      }
      await adminApi.updateAdminProject(companyId, projectId!, data);
      showToast('Saved successfully', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!companyId || !projectId) return;
    setSaving(true);
    try {
      await adminApi.deleteAdminProject(companyId, projectId);
      navigate(`/admin/profile-companies/${companyId}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setSaving(false);
    }
  };

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(fromPath || `/admin/profile-companies/${companyId}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {fromPath ? t('Back to Activity Log', '返回行为监控') : t('Back to Company', '返回公司')}
      </button>

      {/* Navigation bar: prev / title / next */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => prevProject && navigate(`/admin/profile-companies/${companyId}/projects/${prevProject.id}`)}
          disabled={!prevProject}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {t('Prev', '上一个')}
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">
            {isNew ? t('New Project', '新项目') : (title || t('Untitled', '未命名'))}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1 text-xs text-stone-400">
            {style && <span>{style}</span>}
            {location && <span>· {location}</span>}
            {year && <span>· {year}</span>}
            {!isNew && (
              <span className={`ml-1 px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-stone-100 text-stone-600'}`}>
                {status}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => nextProject && navigate(`/admin/profile-companies/${companyId}/projects/${nextProject.id}`)}
          disabled={!nextProject}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t('Next', '下一个')}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">{error}</div>
      )}


      {/* Image Gallery — drag to reorder, lazy load */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-500">{t('Images', '图片')} ({images.length})</h2>
          {images.length > 1 && (
            <span className="text-xs text-stone-400">{t('Drag to reorder · First image is the cover', '拖拽排序 · 第一张为封面')}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => { didDragRef.current = true; setDraggingIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIdx !== null && draggingIdx !== idx) {
                  setImages((prev) => reorder(prev, draggingIdx, idx));
                }
                setDraggingIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null); setTimeout(() => { didDragRef.current = false; }, 0); }}
              onClick={() => { if (!didDragRef.current) setLightboxIdx(idx); }}
              className={`relative group aspect-video bg-stone-100 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-opacity ${draggingIdx === idx ? 'opacity-40' : dragOverIdx === idx ? 'ring-2 ring-[#b8864a]' : ''}`}
            >
              <SmartImage
                src={img}
                alt={`Image ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-[#b8864a] px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('Cover', '封面')}</span>
              )}
              {/* Zoom hint */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-black/40 rounded-full p-2">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold"
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
          {/* Add image card */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors"
          >
            <svg className="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="text-xs">{t('Add Image', '添加图片')}</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddImages}
          className="hidden"
        />
      </div>

      {/* Form fields */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-medium text-stone-500">{t('Project Details', '项目详情')}</h2>

        <div>
          <label className="text-sm font-medium text-stone-500 block mb-1.5">{t('Title', '标题')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Project title', '项目标题')}
            className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-stone-500 block mb-1.5">{t('Description', '描述')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('Project description', '项目描述')}
            rows={4}
            className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">{t('Style', '风格')}</label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g. Modern"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">{t('Location', '位置')}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Dubai"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">{t('Year', '年份')}</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2024"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Delete button */}
      {!isNew && (
        <div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('Delete', '删除')}
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-xl transition"
          >
            ×
          </button>
          {/* Counter */}
          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums">
            {lightboxIdx + 1} / {images.length}
          </span>
          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {/* Image */}
          <img
            src={images[lightboxIdx]}
            alt={`Image ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />
          {/* Next */}
          {lightboxIdx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-stone-800">{t('Delete Project', '删除项目')}</h2>
            <p className="text-sm text-stone-500">
              {t(`Are you sure you want to delete "${title}"? This action cannot be undone.`, `确定要删除"${title}"吗？此操作无法撤销。`)}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-2xl hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? t('Deleting...', '删除中...') : t('Delete', '删除')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-6 md:-mx-10 px-6 md:px-10 py-4 bg-white/90 backdrop-blur border-t border-stone-200 flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="btn-primary px-8 disabled:opacity-50"
        >
          {saving ? t('Saving...', '保存中...') : isNew ? t('Create Project', '创建项目') : t('Save Changes', '保存更改')}
        </button>
      </div>

    </div>
  );
}
