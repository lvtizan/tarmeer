'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FolderOpen, FileText, User, TrendingUp, ExternalLink, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import WelcomeHeader from '@/components/portal/WelcomeHeader';
import HighlightBanner from '@/components/portal/HighlightBanner';
import OnboardingStepper, { type PortalStep } from '@/components/portal/OnboardingStepper';
import StatCard from '@/components/portal/StatCard';
import QuickAction from '@/components/portal/QuickAction';

interface ProfileSummary {
  id?: number;
  company_name: string;
  description: string;
  contact_person: string;
  phone: string;
  status: string;
  admin_notes?: string;
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [projectCount, setProjectCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectedProjects, setRejectedProjects] = useState<Array<{ id: number; title: string; rejection_reason: string | null }>>([]);
  const [hasPendingProjects, setHasPendingProjects] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [approvedBannerDismissed, setApprovedBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('tarmeer_pending_banner_dismissed')) {
        setBannerDismissed(true);
      }
      if (sessionStorage.getItem('tarmeer_approved_banner_dismissed')) {
        setApprovedBannerDismissed(true);
      }
    }

    (async () => {
      try {
        const [profileRes, projectsRes, articlesRes] = await Promise.allSettled([
          api.get('/auth/company/profile'),
          api.get('/auth/company/projects'),
          api.get('/articles/mine'),
        ]);

        if (profileRes.status === 'fulfilled') {
          const res = profileRes.value as Record<string, unknown> | null;
          const d = (res?.profile ?? res) as Record<string, unknown> | null;
          if (d?.company_name) {
            setProfile({
              id: d.id ? Number(d.id) : undefined,
              company_name: (d.company_name as string) || '',
              description: (d.description as string) || '',
              contact_person: (d.contact_person as string) || '',
              phone: (d.phone as string) || '',
              status: (d.status as string) || 'pending',
              admin_notes: d.admin_notes as string | undefined,
            });
          }
        }

        if (projectsRes.status === 'fulfilled') {
          const res = projectsRes.value as { projects?: unknown[] } | unknown[] | null;
          const list: unknown[] = Array.isArray((res as { projects?: unknown[] })?.projects)
            ? ((res as { projects: unknown[] }).projects)
            : Array.isArray(res) ? res : [];
          setProjectCount(list.length);
          setRejectedProjects(
            list
              .filter((p: unknown) => (p as Record<string, unknown>).status === 'rejected')
              .map((p: unknown) => {
                const proj = p as Record<string, unknown>;
                return { id: proj.id as number, title: proj.title as string, rejection_reason: (proj.rejection_reason as string) || null };
              })
          );
          setHasPendingProjects(list.some((p: unknown) => (p as Record<string, unknown>).status === 'pending'));
        }

        if (articlesRes.status === 'fulfilled') {
          const res = articlesRes.value as { articles?: unknown[] } | null;
          const list = res?.articles || [];
          setArticleCount(Array.isArray(list) ? list.length : 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const step1Done = !!(profile?.company_name && profile?.description && profile?.phone);
  const step2Done = projectCount > 0;
  const step3Done = profile?.status === 'approved';

  const companyName = profile?.company_name || '';

  const companySteps: PortalStep[] = [
    {
      label: 'Complete Profile',
      desc: step1Done ? 'Company info filled in' : 'Add company name, description & phone',
      done: step1Done,
      actionLabel: step1Done ? 'Edit Profile' : 'Complete Now',
      onAction: () => router.push('/company/profile'),
    },
    {
      label: 'Upload First Project',
      desc: step2Done ? 'Portfolio uploaded' : 'Show clients what you can do',
      done: step2Done,
      actionLabel: step2Done ? 'Add More' : 'Upload Now',
      onAction: () => router.push('/company/projects'),
    },
    {
      label: 'Under Review',
      desc: profile?.status === 'rejected'
        ? `Needs updates${profile?.admin_notes ? ': ' + profile.admin_notes : ''}`
        : 'Our team will review and approve within 1–2 business days',
      done: step3Done,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-8">

      {/* Rejection banner */}
      {rejectedProjects.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {rejectedProjects.length === 1
                ? `"${rejectedProjects[0].title}" was not approved`
                : `${rejectedProjects.length} projects were not approved`}
            </p>
            {rejectedProjects[0]?.rejection_reason && (
              <p className="mt-1 text-xs text-red-700 leading-relaxed">
                Reason: {rejectedProjects[0].rejection_reason}
              </p>
            )}
            <a
              href="/company/projects"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
            >
              View &amp; fix your projects &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Pending review banner */}
      {rejectedProjects.length === 0 && hasPendingProjects && !bannerDismissed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Your project is under review</p>
            <p className="mt-0.5 text-xs text-amber-700">We&apos;ll notify you once the review is complete.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBannerDismissed(true);
              sessionStorage.setItem('tarmeer_pending_banner_dismissed', '1');
            }}
            className="text-amber-500 hover:text-amber-700 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Welcome header */}
      <WelcomeHeader
        title={companyName ? `Welcome, ${companyName}` : 'Welcome to your Dashboard'}
        subtitle="Complete the steps below to get discovered by potential clients."
        action={profile?.id ? (
          <a
            href={`/companies/${profile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview
          </a>
        ) : undefined}
      />

      {/* Ranking boost banner */}
      <HighlightBanner
        icon={Zap}
        title="More projects = higher ranking = more clients"
        subtitle={
          <>
            You have <span className="text-[#d4a96a] font-semibold">{projectCount}</span> project{projectCount !== 1 ? 's' : ''} &middot; Ranking score: <span className="text-[#d4a96a] font-semibold">{(projectCount + articleCount) * 10} pts</span>. Upload more to rank higher.
          </>
        }
        ctaLabel="+ Add Project"
        onCta={() => router.push('/company/projects')}
      />

      {/* Onboarding stepper */}
      {!step3Done && (
        <OnboardingStepper steps={companySteps} />
      )}

      {/* Under review banner */}
      {step1Done && step2Done && !step3Done && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-5 flex items-center gap-4">
          <Clock className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#2c2c2c]">Profile under review</p>
            <p className="text-xs text-stone-500 mt-0.5">Our team will notify you within 1&ndash;2 business days.</p>
          </div>
        </div>
      )}

      {/* Approved banner */}
      {step3Done && !approvedBannerDismissed && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Profile Approved</p>
            <p className="text-xs text-green-700">Your company is live and discoverable by clients.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setApprovedBannerDismissed(true);
              sessionStorage.setItem('tarmeer_approved_banner_dismissed', '1');
            }}
            className="text-green-500 hover:text-green-700 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<FolderOpen className="w-5 h-5 text-[#b8864a]" />}
          label="Projects"
          value={projectCount}
          hint="Each project +10 pts"
          onClick={() => router.push('/company/projects')}
        />
        <StatCard
          icon={<FileText className="w-5 h-5 text-[#b8864a]" />}
          label="Articles"
          value={articleCount}
          hint="Each article +10 pts"
          onClick={() => router.push('/company/articles')}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-[#b8864a]" />}
          label="Ranking Score"
          value={(projectCount + articleCount) * 10}
          hint="pts"
          onClick={() => {}}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          label="Edit Profile"
          desc="Update company info & services"
          icon={<User className="w-4 h-4" />}
          onClick={() => router.push('/company/profile')}
        />
        <QuickAction
          label="Upload Project"
          desc="Add portfolio photos"
          icon={<FolderOpen className="w-4 h-4" />}
          onClick={() => router.push('/company/projects')}
        />
        <QuickAction
          label="Write Article"
          desc="Boost SEO with content"
          icon={<FileText className="w-4 h-4" />}
          onClick={() => router.push('/company/articles')}
        />
      </div>
    </div>
  );
}
