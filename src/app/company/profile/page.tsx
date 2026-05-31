'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import CompanyProfileForm, { type CompanyProfileFormRef } from '@/components/company/CompanyProfileForm';

export default function CompanyProfilePage() {
  const [status, setStatus] = useState<string>('pending');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isNew, setIsNew] = useState(true);
  const [btnSaving, setBtnSaving] = useState(false);
  const formRef = useRef<CompanyProfileFormRef>(null);

  useEffect(() => {
    api.get('/auth/company/profile').then((r: unknown) => {
      const res = r as Record<string, unknown> | null;
      const d = (res?.profile ?? res) as Record<string, unknown> | null;
      if (d?.company_name) {
        setIsNew(false);
        if (d.status) setStatus(d.status as string);
        if (d.admin_notes) setAdminNotes(d.admin_notes as string);
      }
    }).catch(() => {});
  }, []);

  function handleSaved(_id: number | null) {
    setIsNew(false);
  }

  return (
    <div className="w-full max-w-[840px] mx-auto space-y-3">

      {/* Page header + Save button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">Company Profile</h1>
          <p className="mt-0.5 text-sm text-stone-500">Changes save automatically as a draft.</p>
        </div>
        <button
          type="button"
          disabled={btnSaving}
          onClick={async () => {
            setBtnSaving(true);
            formRef.current?.save();
            setTimeout(() => setBtnSaving(false), 1200);
          }}
          className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition disabled:opacity-60"
        >
          {btnSaving && <span className="inline-block w-3 h-3 border-2 border-[#b8864a] border-t-transparent rounded-full animate-spin" />}
          Save
        </button>
      </div>

      {/* Status banner */}
      {!isNew && status !== 'pending' && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          status === 'approved' ? 'border-green-200 bg-green-50 text-green-800' :
          'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {status === 'approved' && <CheckCircle2 className="w-4 h-4" />}
            {status === 'rejected'  && <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">
              {status === 'approved' ? 'Profile approved — visible to clients' : 'Profile needs updates'}
            </span>
          </div>
          {status === 'rejected' && adminNotes && (
            <p className="mt-1 text-amber-900/90">{adminNotes}</p>
          )}
        </div>
      )}

      <CompanyProfileForm ref={formRef} onSaved={handleSaved} />
    </div>
  );
}
