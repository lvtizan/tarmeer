import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

export default function ApplyDesignerPage() {
  const [bio, setBio] = useState('');
  const [style, setStyle] = useState('');
  const [city, setCity] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<null | { applied: boolean; status?: string; rejectionReason?: string }>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    fetch(`${API_BASE}/designers/my-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bio || !city) return;
    setSubmitting(true);
    setError('');

    try {
      const token = api.getToken();
      const res = await fetch(`${API_BASE}/designers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, style, city, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus({ applied: true, status: 'pending' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-stone-400">Loading...</div>;

  if (status?.applied) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Designer Application</h1>
        <div className={`p-4 rounded-xl border ${
          status.status === 'approved' ? 'bg-green-50 border-green-200' :
          status.status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-amber-50 border-amber-200'
        }`}>
          <p className="font-medium">
            {status.status === 'approved' && 'Your designer application has been approved!'}
            {status.status === 'rejected' && 'Your application was not approved.'}
            {status.status === 'pending' && 'Your application is under review.'}
          </p>
          {status.rejectionReason && (
            <p className="text-sm mt-2 text-red-700">Reason: {status.rejectionReason}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-stone-800 mb-2">Become a Designer</h1>
      <p className="text-stone-500 text-sm mb-6">Fill out the form below to apply as a designer on Tarmeer.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Interior Designer"
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">City *</label>
          <input
            type="text" value={city} onChange={(e) => setCity(e.target.value)} required
            placeholder="Dubai"
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Design Style</label>
          <input
            type="text" value={style} onChange={(e) => setStyle(e.target.value)}
            placeholder="Modern, Minimalist, Arabic..."
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Bio *</label>
          <textarea
            value={bio} onChange={(e) => setBio(e.target.value)} required
            rows={4} placeholder="Tell us about your design experience..."
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit" disabled={submitting || !bio || !city}
          className="btn-primary h-10 px-6 text-sm disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
