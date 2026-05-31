'use client';

import { useState } from 'react';
import { submitComplaint } from '@/lib/api';

export default function DmcaClient() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    infringing_url: '',
    original_work_url: '',
    description: '',
    confirmed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    form.name && form.email && form.infringing_url && form.description && form.confirmed && !submitting;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      await submitComplaint({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        infringing_url: form.infringing_url,
        original_work_url: form.original_work_url || undefined,
        description: form.description,
      });

      setSuccess(true);
      setForm({
        name: '',
        email: '',
        phone: '',
        infringing_url: '',
        original_work_url: '',
        description: '',
        confirmed: false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-stone-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#b8864a] focus:ring-1 focus:ring-[#b8864a]/30';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-[#2c2c2c] mb-8">
            DMCA / Copyright Complaint
          </h1>

          <div className="prose prose-stone max-w-none">
            <p className="text-[#6b6b6b] mb-6">
              Tarmeer (www.tarmeer.com) respects the intellectual property rights of others and expects its users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA) and applicable UAE copyright laws, we will respond expeditiously to claims of copyright infringement committed using our website.
            </p>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Safe Harbor Policy
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              Tarmeer operates as a platform that hosts user-generated and third-party content, including images, text, and company profiles. Under the safe harbor provisions of the DMCA, we act in good faith to promptly remove or disable access to infringing material upon receiving a valid takedown notice.
            </p>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Filing a Copyright Complaint
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              If you believe that content on our website infringes your copyright, please submit a written notice containing the following information:
            </p>
            <ol className="list-decimal list-inside text-[#6b6b6b] space-y-3 mb-4">
              <li><strong>Identification of the copyrighted work:</strong> A description of the copyrighted work you claim has been infringed, or a list of multiple works at a single site.</li>
              <li><strong>Identification of the infringing material:</strong> The specific URL(s) or description of where the allegedly infringing material is located on our website, with enough detail for us to find it.</li>
              <li><strong>Your contact information:</strong> Your full name, mailing address, telephone number, and email address.</li>
              <li><strong>Good faith statement:</strong> A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
              <li><strong>Accuracy statement:</strong> A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on behalf of the owner.</li>
              <li><strong>Signature:</strong> A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</li>
            </ol>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              How We Handle Complaints
            </h2>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li>Upon receiving a valid DMCA takedown notice, we will <strong>promptly remove or disable access</strong> to the allegedly infringing material.</li>
              <li>We will notify the user who posted the content about the removal.</li>
              <li>If the user believes the removal was a mistake, they may submit a counter-notification.</li>
              <li>Repeat infringers will have their accounts terminated.</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Counter-Notification
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              If you believe your content was removed in error, you may file a counter-notification containing:
            </p>
            <ul className="list-disc list-inside text-[#6b6b6b] space-y-2 mb-4">
              <li>Your name, address, and telephone number.</li>
              <li>Identification of the material that was removed and the location where it appeared before removal.</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification.</li>
              <li>A statement that you consent to the jurisdiction of the courts in your district and will accept service of process from the person who filed the original complaint.</li>
              <li>Your physical or electronic signature.</li>
            </ul>

            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mt-8 mb-4">
              Contact for Copyright Issues
            </h2>
            <p className="text-[#6b6b6b] mb-4">
              Please send all DMCA notices and copyright-related inquiries to:
            </p>
            <div className="bg-white rounded-xl border border-stone-200 p-6 mb-4">
              <p className="text-[#2c2c2c] font-medium mb-2">Tarmeer Copyright Agent</p>
              <p className="text-[#6b6b6b] text-sm leading-relaxed">
                Email: copyright@tarmeer.com<br />
                WhatsApp: +971 58 838 8922<br />
                Address: 1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates
              </p>
            </div>
            <p className="text-[#6b6b6b] mb-4">
              We are committed to addressing all valid copyright complaints within <strong>24 hours</strong> of receipt.
            </p>

            <p className="text-[#6b6b6b] mt-8 text-sm">
              Last updated: {new Date().getFullYear()}
            </p>
          </div>

          {/* Complaint Submission Form */}
          <div className="mt-12">
            <h2 className="font-serif text-2xl font-bold text-[#2c2c2c] mb-6">
              Submit a Copyright Complaint
            </h2>

            <div className="bg-white rounded-xl border border-stone-200 p-6 sm:p-8">
              {success && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
                  Your complaint has been submitted successfully. We will review it and get back to you within 24 hours.
                </div>
              )}

              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="your@email.com"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Phone <span className="text-[#6b6b6b] text-xs font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+971 50 123 4567"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Infringing Content URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="infringing_url"
                    value={form.infringing_url}
                    onChange={handleChange}
                    required
                    placeholder="https://tarmeer.com/..."
                    className={inputClass}
                  />
                  <p className="text-xs text-[#6b6b6b] mt-1">URL on tarmeer.com where the infringing content is located</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Original Work URL <span className="text-[#6b6b6b] text-xs font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="original_work_url"
                    value={form.original_work_url}
                    onChange={handleChange}
                    placeholder="https://example.com/original-work"
                    className={inputClass}
                  />
                  <p className="text-xs text-[#6b6b6b] mt-1">URL of the original copyrighted work</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#2c2c2c] mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Please provide a detailed description of the copyright infringement..."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="confirmed"
                    checked={form.confirmed}
                    onChange={handleChange}
                    required
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]/30"
                  />
                  <label className="text-sm text-[#6b6b6b] leading-relaxed">
                    I confirm that the information provided is accurate and I am the copyright owner or authorized to act on behalf of the owner. <span className="text-red-500">*</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-[#1c1917] hover:bg-[#b8864a] text-white rounded-lg px-6 py-3 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Submit Complaint'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
