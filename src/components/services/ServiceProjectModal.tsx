'use client';

import { useState, useRef, useEffect } from 'react';
import { X, MapPin, CircleDollarSign } from 'lucide-react';
import SimpleGallery from './SimpleGallery';

export interface ServiceProject {
  id: string;
  title: string;
  coverImage: string;
  images: string[];
  address: string;
  cost: string;
  description: string;
  style?: string;
  year?: string | number;
  area?: string;
}

interface ServiceProjectModalProps {
  project: ServiceProject;
  onClose: () => void;
  /** Optional sanitizers applied to form inputs. */
  sanitizeName?: (value: string) => string;
  sanitizePhone?: (value: string) => string;
}

export default function ServiceProjectModal({
  project,
  onClose,
  sanitizeName,
  sanitizePhone,
}: ServiceProjectModalProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', whatsapp: '', description: '' });
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const text = `Hi, I'm interested in a project like "${project.title}". Name: ${form.name}. WhatsApp: ${form.whatsapp}. Requirements: ${form.description}.`;
    window.open(`https://wa.me/971501234567?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} role="dialog" aria-modal>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden my-8 relative flex flex-col" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-[#2c2c2c]" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="overflow-y-auto flex-1 rounded-lg">
          <div className="p-6 sm:p-8 pt-14">
            <SimpleGallery images={project.images} title={project.title} />
            <div className="mt-6">
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c]">{project.title}</h2>
              <p className="text-[#6b6b6b] mt-2">{project.style} · {project.year}</p>
            </div>
            <div className="space-y-4 border-t border-stone-200 pt-6 mt-6">
              <div className="flex gap-3 items-start">
                <MapPin className="w-5 h-5 text-[#b8864a] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-[#2c2c2c] text-sm uppercase tracking-wider">Address</h3>
                  <p className="text-[#2c2c2c] mt-1">{project.address}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <CircleDollarSign className="w-5 h-5 text-[#b8864a] shrink-0 mt-0.5" />
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
            <div ref={formRef} className="border-t border-stone-200 pt-6 mt-6">
              {!showForm ? (
                <button type="button" onClick={() => { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className="btn-primary text-white">
                  Submit Your Details
                </button>
              ) : submitted ? (
                <p className="text-[#b8864a] font-medium">Thank you! We&apos;ve opened WhatsApp for you to complete the conversation.</p>
              ) : (
                <>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2c2c2c] mb-4">Submit your requirements</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">Your name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: sanitizeName ? sanitizeName(e.target.value) : e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">WhatsApp number <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        value={form.whatsapp}
                        onChange={(e) => setForm((p) => ({ ...p, whatsapp: sanitizePhone ? sanitizePhone(e.target.value) : e.target.value }))}
                        placeholder="+971 50 123 4567"
                        className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-1">Requirement description <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        placeholder="e.g. Living room refresh, 50 sqm, modern style..."
                        className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:border-[#b8864a] resize-y"
                      />
                    </div>
                    <button type="submit" className="btn-primary text-white">Submit</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
