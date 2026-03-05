import { useEffect } from 'react';
import { X } from 'lucide-react';
import { getDesignerBySlug, getProject } from '../../data/designers';
import ProjectDetailContent from './ProjectDetailContent';

interface ProjectDetailModalProps {
  slug: string;
  projectId: string;
  onClose: () => void;
}

export default function ProjectDetailModal({ slug, projectId, onClose }: ProjectDetailModalProps) {
  const designer = getDesignerBySlug(slug);
  const project = getProject(slug, projectId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
          className="bg-white rounded-xl max-w-md w-full p-8 text-center shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[#6b6b6b]">Project not found.</p>
          <button type="button" onClick={onClose} className="btn-primary mt-4">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Project detail"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[90vw] sm:max-w-[85vw] xl:max-w-[1400px] max-h-[90vh] overflow-y-auto my-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 right-0 float-right m-4 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-[#2c2c2c] z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
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
  );
}
