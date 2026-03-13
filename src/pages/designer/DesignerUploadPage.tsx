import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Trash2, ChevronDown, Calendar } from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';

const PRIMARY = '#b8864a';

const STYLES = [
  { value: '', label: 'Select a style' },
  { value: 'modern', label: 'Modern Contemporary' },
  { value: 'islamic', label: 'Modern Islamic' },
  { value: 'classic', label: 'Neo-Classic' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'industrial', label: 'Industrial' },
];

// 生成年份列表
const YEARS = Array.from({ length: new Date().getFullYear() - 1969 }, (_, i) => new Date().getFullYear() + 1 - i);

export default function DesignerUploadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, addProject, updateProject } = useDesigner();
  const isEdit = Boolean(id);
  const existing = id ? getProject(id) : null;
  const yearPickerRef = useRef<HTMLDivElement>(null);

  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    style: '',
    location: '',
    area: '',
    year: String(new Date().getFullYear()),
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [published, setPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // 点击外部关闭年份选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearPickerRef.current && !yearPickerRef.current.contains(event.target as Node)) {
        setShowYearPicker(false);
      }
    };
    if (showYearPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showYearPicker]);

  useEffect(() => {
    if (existing) {
      setProjectForm({
        title: existing.title,
        description: existing.description,
        style: existing.style,
        location: existing.location,
        area: existing.area,
        year: existing.year,
      });
      setImageUrls(existing.imageUrls.length ? existing.imageUrls : []);
    }
  }, [existing]);

  const handleProjectChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProjectForm((prev) => ({ ...prev, [name]: value }));
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    if (coverIndex >= index && coverIndex > 0) setCoverIndex((c) => c - 1);
  };

  const addFilesAsDataUrls = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImageUrls((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    addFilesAsDataUrls(files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) addFilesAsDataUrls(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProject(false);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitProject(true);
  };

  const submitProject = async (publish: boolean) => {
    setIsSubmitting(true);
    setSubmitError(null);

    if (publish && imageUrls.length === 0) {
      setSubmitError('Please upload at least one real project image before submitting for review.');
      setIsSubmitting(false);
      return;
    }

    const orderedImages = imageUrls.length === 0
      ? []
      : [imageUrls[coverIndex], ...imageUrls.filter((_, index) => index !== coverIndex)];

    const payload = {
      title: projectForm.title,
      description: projectForm.description,
      style: projectForm.style,
      location: projectForm.location,
      area: projectForm.area,
      year: projectForm.year,
      imageUrls: orderedImages,
      productIds: [],
      status: publish ? 'pending' as const : 'draft' as const,
    };

    try {
      if (isEdit && id) {
        await updateProject(id, payload);
      } else {
        await addProject(payload);
      }

      setPublished(publish);
      if (publish) navigate('/designer/projects');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Sticky action bar: stays at top when scrolling */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-6 pb-4 mb-6 bg-[#faf9f7] border-b border-stone-200 md:-mx-10 md:-mt-10 md:px-10 md:pt-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2c2c2c] mb-1">
              {isEdit ? 'Edit Project' : 'Upload New Project'}
            </h1>
            <p className="text-stone-500 text-sm">
              Share your latest work and tag products used from the supply chain.
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-10 px-4 rounded-lg border border-stone-200 bg-white text-stone-700 font-bold text-sm hover:bg-stone-50 transition"
            >
              {isSubmitting ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-10 px-6 rounded-lg text-white font-bold text-sm transition"
              style={{ backgroundColor: PRIMARY }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {submitError}
        </div>
      )}

      {published && !isEdit && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          Project submitted successfully. It is now waiting for admin review.
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
        {/* Step 1: Project Details */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2c2c2c]">Project Details</h2>
            <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: PRIMARY, backgroundColor: `${PRIMARY}20` }}>
              Step 1 of 3
            </span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 mb-8">
            <div className="h-2 rounded-full transition-[width]" style={{ width: '33%', backgroundColor: PRIMARY }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Project Title *</label>
              <input
                name="title"
                type="text"
                required
                value={projectForm.title}
                onChange={handleProjectChange}
                placeholder="e.g. Modern Villa in Riyadh"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Description *</label>
              <textarea
                name="description"
                required
                value={projectForm.description}
                onChange={handleProjectChange}
                placeholder="Describe the design concept, challenges, and solutions..."
                rows={5}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Style *</label>
              <div className="relative">
                <select
                  name="style"
                  required
                  value={projectForm.style}
                  onChange={handleProjectChange}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 pr-10 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none cursor-pointer appearance-none"
                >
                  {STYLES.map((s) => (
                    <option key={s.value || 'empty'} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b8864a] pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Location (City) *</label>
              <input
                name="location"
                type="text"
                required
                value={projectForm.location}
                onChange={handleProjectChange}
                placeholder="e.g. Riyadh, Dubai, Jeddah"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Project Area (sqm)</label>
              <input
                name="area"
                type="text"
                value={projectForm.area}
                onChange={handleProjectChange}
                placeholder="e.g. 450"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">Completion Year</label>
              <div className="relative" ref={yearPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowYearPicker(!showYearPicker)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-left text-[#2c2c2c] focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none cursor-pointer flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#b8864a]" />
                    {projectForm.year}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#b8864a] transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
                </button>
                {showYearPicker && (
                  <div className="absolute z-10 mt-2 w-full bg-white rounded-lg border border-stone-200 shadow-lg p-3 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-4 gap-2">
                      {YEARS.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setProjectForm((prev) => ({ ...prev, year: String(year) }));
                            setShowYearPicker(false);
                          }}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            String(year) === projectForm.year
                              ? 'bg-[#b8864a] text-white'
                              : 'bg-stone-50 text-[#2c2c2c] hover:bg-stone-100'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Images — click to browse local files */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-6">
          <h2 className="text-lg font-bold text-[#2c2c2c] mb-6">Gallery Images</h2>
          <label
            htmlFor="gallery-upload"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-stone-300 rounded-lg p-10 flex flex-col items-center justify-center bg-stone-50 hover:bg-stone-100 transition cursor-pointer mb-6 block"
          >
            <Upload className="w-12 h-12 text-stone-400 mb-3" />
            <p className="text-stone-700 font-bold text-base mb-1">Click to upload or drag and drop</p>
            <p className="text-stone-500 text-sm">JPG, PNG from your device (max 10MB per image).</p>
          </label>
          <input
            id="gallery-upload"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-stone-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCoverIndex(i)}
                      className="bg-white text-[#2c2c2c] p-2 rounded-full hover:opacity-90 text-xs"
                    >
                      Cover
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="bg-white text-red-500 p-2 rounded-full hover:opacity-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {coverIndex === i && (
                    <div className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded text-[#2c2c2c]" style={{ backgroundColor: PRIMARY }}>
                      Cover
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products Used - 暂时隐藏，分散注册力
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#2c2c2c]">Products Used (Chinese Supply Chain)</h2>
              <p className="text-stone-500 text-sm mt-1">Tag products from our catalog to showcase your material choices.</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-bold text-[#2c2c2c] transition"
            >
              Add Product
            </button>
          </div>
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Product</th>
                  <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
                  <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Supplier</th>
                  <th className="py-3 px-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.id} className="border-b border-stone-200 hover:bg-stone-50/50 transition">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-stone-200 overflow-hidden flex-shrink-0">
                        <img src={row.thumb} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-sm font-semibold text-[#2c2c2c]">{row.name}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-stone-600">{row.category}</td>
                    <td className="py-3 px-4 text-sm text-stone-600">{row.supplier}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        className="text-stone-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-5 h-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        */}
      </form>
    </div>
  );
}
