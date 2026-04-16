import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import CompanyProfileForm from '../../components/company/CompanyProfileForm';

function getPublicSiteBase(): string {
  if (typeof window === 'undefined') return '';
  const { hostname, protocol } = window.location;
  if (hostname.startsWith('admin.')) return `${protocol}//www.${hostname.replace(/^admin\./, '')}`;
  return '';
}

export default function CompanyProfilePage() {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isNew, setIsNew] = useState(true);
  const publicSiteBase = getPublicSiteBase();

  useEffect(() => {
    api.get('/auth/company/profile').then(r => {
      const d = r?.profile || r;
      if (d?.company_name) {
        setIsNew(false);
        if (d.id) setProfileId(Number(d.id));
        if (d.status) setStatus(d.status);
        if (d.admin_notes) setAdminNotes(d.admin_notes);
      }
    }).catch(() => {});
  }, []);

  function handleSaved(id: number | null) {
    if (id) setProfileId(id);
    setIsNew(false);
  }

  return (
    <div className="w-full max-w-[840px] mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c2c2c]">Company Profile</h1>
          <p className="mt-1 text-sm text-stone-500">Changes save automatically as you type.</p>
        </div>
        {profileId && (
          <a
            href={`${publicSiteBase || ''}/companies/${profileId}?preview=1&from=company-dashboard`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition flex-shrink-0"
          >
            <Eye className="w-4 h-4" />Preview
          </a>
        )}
      </div>

      {/* ── Status banner ── */}
      {!isNew && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          status === 'approved' ? 'border-green-200 bg-green-50 text-green-800' :
          status === 'rejected'  ? 'border-amber-200 bg-amber-50 text-amber-900' :
          'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          <div className="flex items-center gap-2">
            {status === 'approved' && <CheckCircle2 className="w-4 h-4" />}
            {status === 'rejected'  && <AlertCircle className="w-4 h-4" />}
            {status === 'pending'   && <Clock className="w-4 h-4" />}
            <span className="font-semibold">
              {status === 'approved' ? 'Profile approved — visible to clients' :
               status === 'rejected'  ? 'Profile needs updates' :
               'Under review — usually 1–2 business days'}
            </span>
          </div>
          {status === 'rejected' && adminNotes && (
            <p className="mt-1 text-amber-900/90">{adminNotes}</p>
          )}
        </div>
      )}

      <CompanyProfileForm showSaveBar onSaved={handleSaved} />

    </div>
  );
}
