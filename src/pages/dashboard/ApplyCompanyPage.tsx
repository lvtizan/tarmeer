import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

export default function ApplyCompanyPage() {
  const [companyName, setCompanyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    fetch(`${API_BASE}/company-applications/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return;
    setSubmitting(true);
    setError('');

    try {
      const token = api.getToken();
      const res = await fetch(`${API_BASE}/company-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company_name: companyName,
          license_number: licenseNumber || undefined,
          phone: phone || undefined,
          city: city || undefined,
          address: address || undefined,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStatus({ applied: true, status: 'pending', companyName });
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
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Company Application</h1>
        <div className={`p-4 rounded-xl border ${
          status.status === 'approved' ? 'bg-green-50 border-green-200' :
          status.status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-amber-50 border-amber-200'
        }`}>
          <p className="font-medium">
            {status.status === 'approved' && 'Your company application has been approved!'}
            {status.status === 'rejected' && 'Your application was not approved.'}
            {status.status === 'pending' && `Application for "${status.companyName}" is under review.`}
          </p>
          {status.adminNotes && (
            <p className="text-sm mt-2 text-stone-600">Notes: {status.adminNotes}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-stone-800 mb-2">Register Your Company</h1>
      <p className="text-stone-500 text-sm mb-6">Apply to list your renovation company on Tarmeer.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Company Name *</label>
          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Trade License Number</label>
          <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} placeholder="Tell us about your company..."
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button type="submit" disabled={submitting || !companyName}
          className="btn-primary h-10 px-6 text-sm disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
}
