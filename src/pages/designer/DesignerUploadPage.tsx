import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, ChevronDown, Calendar, ImagePlus, TriangleAlert, X, Info, Eye, GripVertical, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Upload, Image, FileCheck } from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';
import SelectField from '../../components/form/SelectField';
import {
  buildUploadSizeMessage,
  convertProjectImagesForUpload,
  estimateDataUrlBytes,
  formatFileSize,
  MAX_ESTIMATED_PAYLOAD_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
} from '../../lib/projectImageUpload';
import { sanitizeAreaInput } from '../../lib/formInputRules';

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

type UploadNotice = {
  tone: 'warning' | 'error' | 'info';
  title: string;
  detail: string;
};

/* ─── Upload progress overlay ─── */
type UploadStage = {
  label: string;
  icon: 'image' | 'upload' | 'check' | 'done';
  progress: number; // target percentage for this stage
};

const UPLOAD_STAGES: UploadStage[] = [
  { label: 'Preparing images...', icon: 'image', progress: 15 },
  { label: 'Uploading project data...', icon: 'upload', progress: 50 },
  { label: 'Processing on server...', icon: 'check', progress: 80 },
  { label: 'Almost done...', icon: 'check', progress: 95 },
];

const SAVE_STAGES: UploadStage[] = [
  { label: 'Saving draft...', icon: 'upload', progress: 40 },
  { label: 'Processing...', icon: 'check', progress: 80 },
  { label: 'Almost done...', icon: 'check', progress: 95 },
];

const StageIcon = ({ type, spinning }: { type: string; spinning?: boolean }) => {
  const cls = `h-5 w-5 ${spinning ? 'animate-spin' : ''}`;
  switch (type) {
    case 'image': return <Image className={cls} />;
    case 'upload': return <Upload className={cls} />;
    case 'check': return <FileCheck className={cls} />;
    case 'done': return <CheckCircle2 className={cls} />;
    default: return <Loader2 className={cls} />;
  }
};

function UploadProgressOverlay({
  isVisible,
  progress,
  stageLabel,
  stageIcon,
  isPublish,
}: {
  isVisible: boolean;
  progress: number;
  stageLabel: string;
  stageIcon: string;
  isPublish: boolean;
}) {
  if (!isVisible) return null;
  const displayProgress = Math.min(99, Math.round(progress));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            <StageIcon type={stageIcon} spinning={stageIcon !== 'done'} />
          </div>
          <h3 className="text-lg font-bold text-[#2c2c2c]">
            {isPublish ? 'Submitting Project' : 'Saving Draft'}
          </h3>
          <p className="mt-1 text-sm text-stone-500">{stageLabel}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${displayProgress}%`,
                backgroundColor: PRIMARY,
              }}
            />
          </div>
        </div>
        <div className="text-center text-sm font-semibold" style={{ color: PRIMARY }}>
          {displayProgress}%
        </div>

        {/* Subtle hint */}
        <p className="mt-4 text-center text-xs text-stone-400">
          Please do not close or refresh this page.
        </p>
      </div>
    </div>
  );
}

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function reorderCoverIndex(currentIndex: number, fromIndex: number, toIndex: number) {
  if (currentIndex === fromIndex) return toIndex;
  if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) return currentIndex - 1;
  if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) return currentIndex + 1;
  return currentIndex;
}

export default function DesignerUploadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, addProject, addProjectWithUploadTransition, updateProject } = useDesigner();
  const isEdit = Boolean(id);
  const existing = id ? getProject(id) : null;
  const yearPickerRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    style: '',
    location: '',
    area: '',
    year: String(new Date().getFullYear()),
  });
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageFingerprints, setImageFingerprints] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<UploadNotice | null>(null);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [saveStatusText, setSaveStatusText] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [, setUploadStageIndex] = useState(0);
  const [uploadStageLabel, setUploadStageLabel] = useState('');
  const [uploadStageIcon, setUploadStageIcon] = useState('upload');
  const [showProgress, setShowProgress] = useState(false);
  const [isPublishAction, setIsPublishAction] = useState(false);
  const progressTimerRef = useRef<number | null>(null);

  const startProgressSimulation = useCallback((publish: boolean) => {
    const stages = publish ? UPLOAD_STAGES : SAVE_STAGES;
    setIsPublishAction(publish);
    setShowProgress(true);
    setUploadStageIndex(0);
    setUploadProgress(0);
    setUploadStageLabel(stages[0].label);
    setUploadStageIcon(stages[0].icon);

    let currentStage = 0;
    let currentProgress = 0;

    const tick = () => {
      const stage = stages[currentStage];
      const target = stage.progress;
      const increment = (target - currentProgress) * 0.12 + 0.3;
      currentProgress = Math.min(target, currentProgress + increment);

      setUploadProgress(currentProgress);
      setUploadStageLabel(stage.label);
      setUploadStageIcon(stage.icon);

      if (currentProgress >= target - 0.5 && currentStage < stages.length - 1) {
        currentStage += 1;
        setUploadStageIndex(currentStage);
      }

      progressTimerRef.current = window.setTimeout(tick, 200);
    };

    progressTimerRef.current = window.setTimeout(tick, 100);
  }, []);

  const completeProgress = useCallback(async () => {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    setUploadProgress(100);
    setUploadStageLabel('Done!');
    setUploadStageIcon('done');
    await new Promise((r) => setTimeout(r, 600));
    setShowProgress(false);
  }, []);

  const cancelProgress = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    setShowProgress(false);
    setUploadProgress(0);
  }, []);

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
      setImageFingerprints(existing.imageUrls.length ? existing.imageUrls.map(() => '') : []);
    }
  }, [existing]);

  const autosaveKey = `designer-upload-autosave:${id || 'new'}`;

  useEffect(() => {
    try {
      const cached = localStorage.getItem(autosaveKey);
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (parsed?.projectForm) {
        setProjectForm((prev) => ({ ...prev, ...parsed.projectForm }));
      }
      if (Array.isArray(parsed?.imageUrls)) {
        setImageUrls(parsed.imageUrls);
      }
      if (Array.isArray(parsed?.imageFingerprints)) {
        setImageFingerprints(parsed.imageFingerprints);
      }
      if (typeof parsed?.coverIndex === 'number') {
        setCoverIndex(Math.max(0, parsed.coverIndex));
      }
      setSaveStatus('saved');
      setSaveStatusText('Saved just now');
    } catch {
      setSaveStatus('failed');
      setSaveStatusText('Failed to load local draft');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    setSaveStatus('saving');
    setSaveStatusText('Saving...');

    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          autosaveKey,
          JSON.stringify({
            projectForm,
            imageUrls,
            imageFingerprints,
            coverIndex,
            savedAt: Date.now(),
          }),
        );
        setSaveStatus('saved');
        setSaveStatusText('Saved just now');
      } catch {
        setSaveStatus('failed');
        setSaveStatusText('Failed to save');
      }
    }, 700);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [autosaveKey, projectForm, imageUrls, imageFingerprints, coverIndex]);

  const showUploadNotice = (notice: UploadNotice) => {
    setUploadNotice(notice);
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === 'area') {
      value = sanitizeAreaInput(value);
    }
    setProjectForm((prev) => ({ ...prev, [name]: value }));
  };

  const removeImage = (index: number) => {
    const confirmed = window.confirm('Remove this image from the gallery?');
    if (!confirmed) return;
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    setImageFingerprints((prev) => prev.filter((_, i) => i !== index));
    if (coverIndex >= index && coverIndex > 0) setCoverIndex((c) => c - 1);
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setImageUrls((prev) => reorderItems(prev, fromIndex, toIndex));
    setImageFingerprints((prev) => reorderItems(prev, fromIndex, toIndex));
    setCoverIndex((prev) => reorderCoverIndex(prev, fromIndex, toIndex));
    showUploadNotice({
      tone: 'info',
      title: 'Image order updated',
      detail: 'The first image appears first in the gallery.',
    });
  };

  const addFilesAsDataUrls = async (files: FileList | File[]) => {
    const rawList = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const existingFingerprints = new Set(imageFingerprints.filter(Boolean));
    const nextSeenFingerprints = new Set<string>();
    const uniqueFiles = rawList.filter((file) => {
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (existingFingerprints.has(fingerprint) || nextSeenFingerprints.has(fingerprint)) {
        return false;
      }
      nextSeenFingerprints.add(fingerprint);
      return true;
    });

    const duplicateCount = rawList.length - uniqueFiles.length;
    const list = uniqueFiles;
    if (!list.length) {
      showUploadNotice(
        duplicateCount > 0
          ? {
              tone: 'warning',
              title: 'Duplicate images skipped',
              detail: 'This upload already contains these files. Choose different images or keep the current selection.',
            }
          : {
              tone: 'info',
              title: 'No supported images found',
              detail: 'Please choose JPG, PNG, or WebP files for this project gallery.',
            },
      );
      return;
    }

    const totalSelectionBytes = list.reduce((sum, file) => sum + file.size, 0);
    if (totalSelectionBytes > MAX_TOTAL_UPLOAD_BYTES) {
      showUploadNotice({
        tone: 'error',
        title: 'Upload batch is too large',
        detail: buildUploadSizeMessage(totalSelectionBytes),
      });
      return;
    }

    setIsPreparingImages(true);
    setUploadNotice(null);

    try {
      const prepared = await convertProjectImagesForUpload(list);
      const existingPayloadBytes = imageUrls.reduce((sum, imageUrl) => sum + estimateDataUrlBytes(imageUrl), 0);
      const nextPayloadBytes = existingPayloadBytes + prepared.estimatedPayloadBytes;

      if (nextPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) {
        showUploadNotice({
          tone: 'error',
          title: 'Project gallery is still too heavy',
          detail: `These files would push the project over the upload limit. Keep the full gallery under ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)} after optimization.`,
        });
        return;
      }

      setImageUrls((prev) => [...prev, ...prepared.dataUrls]);
      setImageFingerprints((prev) => [
        ...prev,
        ...list.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      ]);
      if (duplicateCount > 0) {
        showUploadNotice({
          tone: 'warning',
          title: 'Duplicate images skipped',
          detail: 'This upload already contains these files. Choose different images or keep the current selection.',
        });
      }
    } catch (error: any) {
      showUploadNotice({
        tone: 'error',
        title: 'Images could not be prepared',
        detail: error.message || 'Failed to prepare images for upload.',
      });
    } finally {
      setIsPreparingImages(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    await addFilesAsDataUrls(files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropActive(false);
    if (e.dataTransfer.files?.length) {
      await addFilesAsDataUrls(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropActive(true);
  };

  const handleDragLeave = () => {
    setIsDropActive(false);
  };

  const handleImageDragStart = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedImageIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleImageDragOver = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragOverImageIndex !== index) {
      setDragOverImageIndex(index);
    }
  };

  const handleImageDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceIndex = draggedImageIndex ?? Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(sourceIndex)) {
      moveImage(sourceIndex, index);
    }
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const resetImageDragState = () => {
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

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
    setSubmitSuccess(null);

    if (publish && imageUrls.length === 0) {
      setSubmitError('Please upload at least one real project image before submitting for review.');
      setIsSubmitting(false);
      return;
    }

    const estimatedPayloadBytes = imageUrls.reduce((sum, imageUrl) => sum + estimateDataUrlBytes(imageUrl), 0);
    if (estimatedPayloadBytes > MAX_ESTIMATED_PAYLOAD_BYTES) {
      setSubmitError(
        `This project is still too large to upload. Please remove some images or use smaller files. Current gallery estimate: ${formatFileSize(estimatedPayloadBytes)}.`,
      );
      setIsSubmitting(false);
      return;
    }

    // Start progress overlay
    startProgressSimulation(publish);

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
      let savedProjectId = id;

      if (isEdit && id) {
        const saved = await updateProject(id, payload);
        savedProjectId = saved.id;
      } else {
        const saved = publish
          ? await addProjectWithUploadTransition(payload, { maxRetries: 8 })
          : await addProject(payload);
        savedProjectId = saved.id;
      }

      // Complete progress animation before navigating
      await completeProgress();

      if (publish) {
        setSubmitSuccess('Project submitted successfully. It is now waiting for admin review.');
        navigate('/designer/projects');
      } else {
        setSubmitSuccess('Draft saved successfully.');
        localStorage.removeItem(autosaveKey);
        if (savedProjectId) {
          navigate(`/designer/upload/${savedProjectId}`, { replace: true });
        }
      }
    } catch (error: any) {
      cancelProgress();
      setSubmitError(error.message || 'Failed to save project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasImages = imageUrls.length > 0;
  const missingFields: string[] = [];
  if (!projectForm.title.trim()) missingFields.push('project title');
  if (!projectForm.style.trim()) missingFields.push('style');
  if (!projectForm.location.trim()) missingFields.push('city');
  if (!hasImages) missingFields.push('at least one image');
  if (!imageUrls[coverIndex]) missingFields.push('cover image');
  const isPublishReady = missingFields.length === 0;
  const totalGalleryBytes = imageUrls.reduce((sum, imageUrl) => sum + estimateDataUrlBytes(imageUrl), 0);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">
      {uploadNotice && (
        <div className="fixed right-4 top-24 z-30 w-[min(420px,calc(100vw-2rem))]">
          <div
            className={`rounded-[20px] border px-4 py-4 shadow-[0_22px_55px_rgba(28,18,8,0.16)] backdrop-blur ${
              uploadNotice.tone === 'error'
                ? 'border-red-200 bg-[#fff6f4]'
                : uploadNotice.tone === 'warning'
                  ? 'border-amber-200 bg-[#fffaf0]'
                  : 'border-stone-200 bg-white'
            }`}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  uploadNotice.tone === 'error'
                    ? 'bg-red-100 text-red-600'
                    : uploadNotice.tone === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-stone-100 text-stone-700'
                }`}
              >
                {uploadNotice.tone === 'info' ? <Info className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#2c2c2c]">{uploadNotice.title}</div>
                <div className="mt-1 text-sm leading-6 text-stone-600">{uploadNotice.detail}</div>
              </div>
              <button
                type="button"
                onClick={() => setUploadNotice(null)}
                className="cursor-pointer rounded-full p-1 text-stone-400 transition hover:bg-black/5 hover:text-stone-700"
                aria-label="Dismiss upload notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="w-full">
      <div className="sticky top-3 z-20 mb-4 w-full rounded-[24px] border border-stone-200 bg-[#faf9f7]/95 px-5 py-3.5 shadow-[0_12px_30px_rgba(28,18,8,0.08)] backdrop-blur md:px-6">
        <div className="flex w-full flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate('/designer/projects')}
              className="mb-2 text-sm font-medium text-stone-500 hover:text-stone-800"
            >
              ← Back to My Projects
            </button>
            <h1 className="text-2xl font-bold text-[#2c2c2c]">{isEdit ? 'Edit Project' : 'Upload New Project'}</h1>
            <p className="text-sm text-stone-500">Complete your project and submit it for review.</p>
          </div>
          <div className="flex w-full shrink-0 gap-3 sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting || isPreparingImages}
              className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:bg-stone-50 sm:flex-none"
            >
              {isPreparingImages ? 'Preparing images...' : isSubmitting ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting || isPreparingImages || !isPublishReady}
              className="h-10 flex-1 rounded-lg px-5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              style={{ backgroundColor: PRIMARY }}
            >
              {isPreparingImages ? 'Preparing images...' : isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>
        <div className={`mt-3 block w-full rounded-2xl border px-4 py-2.5 text-sm ${isPublishReady ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="font-semibold">{isPublishReady ? 'Ready to submit' : 'Incomplete submission'}</div>
          <div className="mt-1">
            {isPublishReady ? 'All required information is complete.' : `Missing: ${missingFields.join(', ')}`}
          </div>
          <div className="mt-1 text-xs text-stone-500">{saveStatusText || (saveStatus === 'idle' ? '' : 'Saving...')}</div>
        </div>
      </div>
      </section>

      {submitError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>}
      {submitSuccess && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{submitSuccess}</div>}

      <form onSubmit={(e) => e.preventDefault()} className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.04fr)]">
        <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#2c2c2c]">Project Details</h2>
            <p className="text-sm text-stone-500">Add the key project details for review.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-stone-700">Project Title *</label>
              <input
                name="title"
                type="text"
                value={projectForm.title}
                onChange={handleProjectChange}
                placeholder="Enter project title"
                className="h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-stone-700">Description</label>
              <textarea
                name="description"
                value={projectForm.description}
                onChange={handleProjectChange}
                placeholder="Briefly describe project highlights or design intent (recommended)."
                rows={3}
                className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35"
              />
              <p className="mt-1 text-xs text-stone-500">Recommended: 50–200 characters.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Style *</label>
              <SelectField name="style" value={projectForm.style} onChange={handleProjectChange} className="pr-10">
                {STYLES.map((s) => (
                  <option key={s.value || 'empty'} value={s.value}>{s.label}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Location (City) *</label>
              <input
                name="location"
                type="text"
                value={projectForm.location}
                onChange={handleProjectChange}
                placeholder="Enter city"
                className="h-11 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Project Area</label>
              <div className="flex h-11 items-center rounded-lg border border-stone-200 bg-stone-50 px-4">
                <input
                  name="area"
                  type="text"
                  value={projectForm.area}
                  onChange={handleProjectChange}
                  placeholder="e.g. 450"
                  inputMode="decimal"
                  className="h-full w-full bg-transparent text-[#2c2c2c] outline-none"
                />
                <span className="text-xs text-stone-500">sqm</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Completion Year</label>
              <div className="relative" ref={yearPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowYearPicker(!showYearPicker)}
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-4 text-left text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/35"
                >
                  <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#b8864a]" />{projectForm.year}</span>
                  <ChevronDown className={`h-4 w-4 text-[#b8864a] transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
                </button>
                {showYearPicker && (
                  <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
                    <div className="grid grid-cols-4 gap-2">
                      {YEARS.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setProjectForm((prev) => ({ ...prev, year: String(year) }));
                            setShowYearPicker(false);
                          }}
                          className={`rounded-md px-3 py-2 text-sm font-medium ${String(year) === projectForm.year ? 'bg-[#b8864a] text-white' : 'bg-stone-50 text-[#2c2c2c] hover:bg-stone-100'}`}
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
        </section>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">
          <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-[18px] shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#2c2c2c]">Image Board</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {imageUrls.length > 0
                    ? `${imageUrls.length} images uploaded · ${imageUrls[coverIndex] ? '1 cover selected' : 'No cover selected'} · Total size: ${formatFileSize(totalGalleryBytes)} / ${formatFileSize(MAX_ESTIMATED_PAYLOAD_BYTES)}`
                    : 'No images uploaded yet'}
                </p>
              </div>
              {imageUrls[coverIndex] && (
                <div className="w-[128px] rounded-xl border border-stone-200 bg-stone-50 p-1.5">
                  <div className="text-[10px] font-semibold leading-tight text-stone-500">Current Cover</div>
                  <div
                    aria-label="Current cover preview"
                    className="mt-1 aspect-video w-full rounded-lg bg-cover bg-center"
                    style={{ backgroundImage: `url(${imageUrls[coverIndex]})` }}
                  />
                </div>
              )}
            </div>

            <input id="gallery-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} disabled={isPreparingImages} />

            <label
              htmlFor="gallery-upload"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-3 py-3 transition ${isDropActive ? 'border-[#b8864a] bg-amber-50' : 'border-stone-300 bg-stone-50 hover:bg-stone-100'}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <ImagePlus className="h-5 w-5 text-stone-500" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#2c2c2c]">{isPreparingImages ? 'Uploading...' : 'Add case images'}</div>
                <div className="text-xs text-stone-500">Drag images here or upload from your device. JPG, PNG, WEBP. Total under 20MB.</div>
              </div>
            </label>

            <div className="mt-3 max-h-[420px] overflow-y-auto pr-0.5 pb-0.5">
              {imageUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {imageUrls.map((url, i) => (
                    <div
                      key={i}
                      data-testid={`image-card-${i}`}
                      draggable
                      onDragStart={handleImageDragStart(i)}
                      onDragOver={handleImageDragOver(i)}
                      onDragEnter={handleImageDragOver(i)}
                      onDrop={handleImageDrop(i)}
                      onDragEnd={resetImageDragState}
                      className={`group relative aspect-square overflow-hidden rounded-xl border bg-stone-100 transition ${coverIndex === i ? 'border-[#b8864a] ring-2 ring-[#b8864a]/35' : dragOverImageIndex === i ? 'border-[#b8864a]/70' : 'border-stone-200'} ${draggedImageIndex === i ? 'cursor-grabbing opacity-80' : 'cursor-grab'}`}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {coverIndex === i && <div className="absolute left-1.5 top-1.5 rounded-full bg-[#b8864a] px-2 py-0.5 text-[10px] font-semibold text-white">Cover</div>}
                      <div className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><GripVertical className="h-3.5 w-3.5" /></div>
                      <div className="absolute inset-0 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="absolute inset-x-1.5 bottom-1.5 grid h-6 grid-cols-3 gap-1 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={() => setPreviewIndex(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-stone-700"><Eye className="mx-auto h-3 w-3" /></button>
                        <button type="button" onClick={() => setCoverIndex(i)} className="rounded-md bg-white px-1 text-[10px] font-semibold text-stone-700">{coverIndex === i ? 'Cover' : 'Set'}</button>
                        <button type="button" onClick={() => removeImage(i)} className="rounded-md bg-white px-2 text-[10px] font-semibold text-red-600"><Trash2 className="mx-auto h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
                  Upload at least one image. Set as Cover to choose your project thumbnail.
                </div>
              )}
            </div>
          </section>
        </aside>
      </form>

      {/* Upload progress overlay */}
      <UploadProgressOverlay
        isVisible={showProgress}
        progress={uploadProgress}
        stageLabel={uploadStageLabel}
        stageIcon={uploadStageIcon}
        isPublish={isPublishAction}
      />

      {previewIndex !== null && imageUrls[previewIndex] && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-stone-700">
                {previewIndex + 1} / {imageUrls.length} {coverIndex === previewIndex ? '· Cover' : ''}
              </div>
              <button type="button" onClick={() => setPreviewIndex(null)} className="rounded-full p-1 text-stone-500 hover:bg-stone-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative flex items-center justify-center rounded-xl bg-stone-100">
              <img src={imageUrls[previewIndex]} alt="" className="max-h-[65vh] w-auto object-contain" />
              {imageUrls.length > 1 && (
                <>
                  <button type="button" onClick={() => setPreviewIndex((prev) => (prev === null ? 0 : (prev - 1 + imageUrls.length) % imageUrls.length))} className="absolute left-3 rounded-full bg-white/90 p-2 text-stone-700"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setPreviewIndex((prev) => (prev === null ? 0 : (prev + 1) % imageUrls.length))} className="absolute right-3 rounded-full bg-white/90 p-2 text-stone-700"><ChevronRight className="h-4 w-4" /></button>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCoverIndex(previewIndex)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700">
                {coverIndex === previewIndex ? 'Current Cover' : 'Set as Cover'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = previewIndex;
                  removeImage(current);
                  setPreviewIndex((prev) => {
                    if (imageUrls.length <= 1) return null;
                    if (prev === null) return null;
                    return Math.max(0, Math.min(prev, imageUrls.length - 2));
                  });
                }}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
