'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export default function CompanyUploadPage() {
  const [hasRejected, setHasRejected] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBannerDismissed(!!sessionStorage.getItem('tarmeer_upload_warning_dismissed'));
    }
    api.get('/auth/company/projects').then((data: unknown) => {
      const d = data as { projects?: unknown[] } | unknown[] | null;
      const list: unknown[] = Array.isArray((d as { projects?: unknown[] })?.projects)
        ? (d as { projects: unknown[] }).projects
        : Array.isArray(d) ? d : [];
      setHasRejected(list.some((p: unknown) => (p as Record<string, unknown>).status === 'rejected'));
    }).catch((err) => {
      console.error('[CompanyUpload] Failed to fetch projects:', err);
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {hasRejected && !bannerDismissed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">You have a project that wasn&apos;t approved</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Please{' '}
              <Link href="/company/projects" className="underline font-semibold">
                review the reason
              </Link>{' '}
              and fix it before uploading new work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBannerDismissed(true);
              sessionStorage.setItem('tarmeer_upload_warning_dismissed', '1');
            }}
            className="text-orange-400 hover:text-orange-600 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-stone-800 mb-2">Upload Project Case</h1>
      <p className="text-stone-500 mb-8">Showcase your company&apos;s work to attract homeowners.</p>
      <div className="rounded-2xl border-2 border-dashed border-stone-300 p-12 text-center text-stone-400">
        Project uploader coming soon
      </div>
    </div>
  );
}
