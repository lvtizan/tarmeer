import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import ProjectUploader from '../../components/ProjectUploader';
import { api } from '../../lib/api';

export default function CompanyUploadPage() {
  const [hasRejected, setHasRejected] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    !!sessionStorage.getItem('tarmeer_upload_warning_dismissed')
  );

  useEffect(() => {
    api.get('/auth/company/projects').then((data: any) => {
      const list: any[] = Array.isArray(data?.projects) ? data.projects
        : Array.isArray(data) ? data : [];
      setHasRejected(list.some((p: any) => p.status === 'rejected'));
    }).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {hasRejected && !bannerDismissed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">You have a project that wasn't approved</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Please{' '}
              <Link to="/company/projects" className="underline font-semibold">
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
      <p className="text-stone-500 mb-8">Showcase your company's work to attract homeowners.</p>
      {/* @ts-ignore - placeholder component */}
      <ProjectUploader ownerType="company" onSuccess={() => window.history.back()} />
    </div>
  );
}
