import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CircleDollarSign, Share2 } from 'lucide-react';
import type { Designer } from '../../data/designers';
import type { DesignerProject } from '../../data/designers';
import { WHATSAPP_LINK } from '../../lib/constants';
import ProjectGallery from './ProjectGallery';

interface ProjectDetailContentProps {
  project: DesignerProject;
  designer: Designer;
  onShare?: () => void;
  /** When true, gallery does not open a second lightbox (e.g. inside modal) */
  disableImageLightbox?: boolean;
}

export default function ProjectDetailContent({
  project,
  designer,
  onShare,
  disableImageLightbox = false,
}: ProjectDetailContentProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    whatsapp: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const text = `Hi, I'm interested in a project like "${project.title}" by ${designer.name}. Name: ${form.name}. WhatsApp: ${form.whatsapp}. Requirements: ${form.description}.`;
    const url = `${WHATSAPP_LINK}${WHATSAPP_LINK.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ProjectGallery
        images={project.images}
        title={project.title}
        disableLightbox={disableImageLightbox}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c]">
            {project.title}
          </h1>
          <p className="text-[#6b6b6b] mt-2">
            By{' '}
            <Link
              to={`/designers/${designer.slug}`}
              className="text-[#c6a065] hover:underline"
            >
              {designer.name}
            </Link>
            {project.year && ` · ${project.year}`}
            {project.location && ` · ${project.location}`}
          </p>
        </div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border-2 border-[#c6a065] text-[#c6a065] font-medium hover:bg-[#c6a065]/10 transition"
          >
            <Share2 className="w-4 h-4" aria-hidden />
            Share project
          </button>
        )}
      </div>

      <div className="space-y-6 border-t border-stone-200 pt-6">
        <div className="flex gap-3 items-start">
          <MapPin className="w-5 h-5 text-[#c6a065] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Address</h3>
            <p className="text-[#2c2c2c] mt-1">{project.address}</p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <CircleDollarSign className="w-5 h-5 text-[#c6a065] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Project cost</h3>
            <p className="text-[#2c2c2c] mt-1">{project.cost}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider mb-2">Project overview</h3>
          <p className="text-[#2c2c2c] leading-relaxed">{project.description}</p>
        </div>
      </div>

      {/* Contact us: button reveals requirement form (no attachments) */}
      <div className="border-t border-stone-200 pt-6">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            Contact us
          </button>
        ) : submitted ? (
          <p className="text-[#c6a065] font-medium">
            Thank you. We&apos;ve opened WhatsApp for you to complete the conversation.
          </p>
        ) : (
          <>
            <h2 className="font-serif text-lg font-semibold text-[#2c2c2c] mb-2">
              Submit your requirements
            </h2>
            <p className="text-sm text-[#6b6b6b] mb-4">
              Like this project? Send us your details and we&apos;ll connect you with the designer.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div>
                <label htmlFor="req-name" className="block text-sm font-medium text-[#2c2c2c] mb-1">
                  Your name <span className="text-red-500">*</span>
                </label>
                <input
                  id="req-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40"
                />
              </div>
              <div>
                <label htmlFor="req-wa" className="block text-sm font-medium text-[#2c2c2c] mb-1">
                  WhatsApp number <span className="text-red-500">*</span>
                </label>
                <input
                  id="req-wa"
                  type="tel"
                  required
                  value={form.whatsapp}
                  onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="+971 50 123 4567"
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40"
                />
              </div>
              <div>
                <label htmlFor="req-desc" className="block text-sm font-medium text-[#2c2c2c] mb-1">
                  Requirement description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="req-desc"
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. New villa, 350 sqm, modern style..."
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/40 resize-y"
                />
              </div>
              <button type="submit" className="btn-primary">
                Submit
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
