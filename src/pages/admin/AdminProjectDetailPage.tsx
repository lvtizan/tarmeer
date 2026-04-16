import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import { showToast } from '../../components/ui/Toast';

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
  const navigate = useNavigate();

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onClick={() => navigate(`/admin/profile-companies/${companyId}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back to Company
      </button>

      {/* Navigation bar: prev / title / next */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => prevProject && navigate(`/admin/profile-companies/${companyId}/projects/${prevProject.id}`)}
          disabled={!prevProject}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Prev
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">
            {isNew ? 'New Project' : (title || 'Untitled')}
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
          Next
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">{error}</div>
      )}


      {/* Image Gallery — drag to reorder, lazy load */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-500">Images ({images.length})</h2>
          {images.length > 1 && (
            <span className="text-xs text-stone-400">Drag to reorder · First image is the cover</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => setDraggingIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIdx !== null && draggingIdx !== idx) {
                  setImages((prev) => reorder(prev, draggingIdx, idx));
                }
                setDraggingIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null); }}
              className={`relative group aspect-video bg-stone-100 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-opacity ${draggingIdx === idx ? 'opacity-40' : dragOverIdx === idx ? 'ring-2 ring-[#b8864a]' : ''}`}
            >
              <SmartImage
                src={img}
                alt={`Image ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-[#b8864a] px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
              )}
              <button
                onClick={() => handleRemoveImage(idx)}
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
            <span className="text-xs">Add Image</span>
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
        <h2 className="text-sm font-medium text-stone-500">Project Details</h2>

        <div>
          <label className="text-sm font-medium text-stone-500 block mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-stone-500 block mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description"
            rows={4}
            className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">Style</label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g. Modern"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Dubai"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-500 block mb-1.5">Year</label>
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
            Delete
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-stone-800">Delete Project</h2>
            <p className="text-sm text-stone-500">
              Are you sure you want to delete "{title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-2xl hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
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
          {saving ? 'Saving...' : isNew ? 'Create Project' : 'Save Changes'}
        </button>
      </div>

    </div>
  );
}
