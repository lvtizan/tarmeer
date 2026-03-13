import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getDesignerBySlug, getDesignerProjects, type Designer } from '../../data/designers';
import ProjectDetailContent from './ProjectDetailContent';

interface ProjectDetailModalProps {
  slug: string;
  projectId: string;
  onClose: () => void;
}

export default function ProjectDetailModal({ slug, projectId, onClose }: ProjectDetailModalProps) {
  const [detail, setDetail] = useState<{ designer: Designer; projects: ReturnType<typeof getDesignerProjects> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 禁止背景滚动
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    // 使用本地数据而不是 API
    const designer = getDesignerBySlug(slug);
    const projects = getDesignerProjects(slug);

    if (designer) {
      setDetail({ designer, projects });
    } else {
      setDetail(null);
    }
    setIsLoading(false);
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const designer = detail?.designer;
  const project = detail?.projects.find((item) => item.id === projectId);

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${project?.title} by ${designer?.name} — ${url}`;
    if (navigator.share) {
      navigator.share({ title: project?.title, url, text }).catch(() => copyAndAlert(url));
    } else {
      copyAndAlert(url);
    }
  };

  function copyAndAlert(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied. Share to social or WhatsApp.');
    });
  }

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal
        aria-label="Project detail"
      >
        <div className="bg-white rounded-lg max-w-md w-full p-8 text-center shadow-xl">
          <p className="text-[#6b6b6b]">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!designer || !project) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal
        aria-label="Project detail"
      >
        <div
          className="bg-white rounded-lg max-w-md w-full p-8 text-center shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[#6b6b6b]">Project not found.</p>
          <button type="button" onClick={onClose} className="btn-primary mt-4 text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Project detail"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-[90vw] sm:max-w-[85vw] xl:max-w-[1400px] max-h-[90vh] overflow-hidden my-8 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-[#2c2c2c]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="overflow-y-auto flex-1 rounded-lg">
          <div className="p-6 sm:p-8 pt-14">
            <ProjectDetailContent
              project={project}
              designer={designer}
              onShare={handleShare}
              disableImageLightbox
            />
          </div>
        </div>
      </div>
    </div>
  );
}
