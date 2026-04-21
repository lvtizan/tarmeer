import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { validatePhone, isPhoneComplete } from '../../lib/phoneValidation';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SupplierLeadModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [origin, setOrigin] = useState<'china' | 'dubai'>('china');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const phoneError = isPhoneComplete(phone.replace(/[\s\-()]/g, '').replace(/^\+971/, ''), '+971')
    ? validatePhone(phone.replace(/[\s\-()]/g, '').replace(/^\+971/, ''), '+971')
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: name,
          phone,
          company_name: company || undefined,
          category: category || undefined,
          origin,
          message: message || undefined,
          source_page: window.location.href,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="text-lg font-bold text-[#2c2c2c]">Become a Supplier</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 transition">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            <h4 className="text-lg font-semibold text-[#2c2c2c] mb-2">Application Received!</h4>
            <p className="text-sm text-stone-500">Our team will review your information and get in touch shortly.</p>
            <button onClick={onClose} className="mt-5 btn-primary px-6 py-2.5 text-sm">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Contact Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name"
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Phone *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+971 50 123 4567"
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
              {phoneError && <p className="text-[12px] text-red-600 mt-1">{phoneError}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Company Name</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company"
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition">
                  <option value="">Select</option>
                  <option value="furniture">Furniture</option>
                  <option value="stone">Stone & Marble</option>
                  <option value="lighting">Lighting</option>
                  <option value="plants">Plants</option>
                  <option value="flooring">Flooring</option>
                  <option value="kitchen">Kitchen & Bath</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Origin</label>
                <div className="flex gap-2 h-11 items-center">
                  {(['china', 'dubai'] as const).map(o => (
                    <button key={o} type="button" onClick={() => setOrigin(o)}
                      className={`flex-1 h-9 rounded-lg text-xs font-medium transition ${
                        origin === o ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}>
                      {o === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Tell us about your products..."
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] transition resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={submitting || !name || !phone}
              className="w-full h-12 rounded-xl bg-[#b8864a] text-white font-semibold text-sm hover:bg-[#a67c47] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
