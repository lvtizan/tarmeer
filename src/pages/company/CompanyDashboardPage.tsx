import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, ArrowRight, FolderOpen, FileText, User, TrendingUp, ExternalLink, Zap } from 'lucide-react';
import { api } from '../../lib/api';

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
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [projectCount, setProjectCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectedProjects, setRejectedProjects] = useState<Array<{ id: number; title: string; rejection_reason: string | null }>>([]);
  const [hasPendingProjects, setHasPendingProjects] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('tarmeer_pending_banner_dismissed')) {
      setBannerDismissed(true);
    }
    (async () => {
      try {
        const [profileRes, projectsRes, articlesRes] = await Promise.allSettled([
          api.get('/auth/company/profile'),
          api.get('/auth/company/projects'),
          api.get('/articles/mine'),
        ]);

        if (profileRes.status === 'fulfilled') {
          const d = profileRes.value?.profile || profileRes.value;
          if (d?.company_name) {
            setProfile({
              id: d.id ? Number(d.id) : undefined,
              company_name: d.company_name || '',
              description: d.description || '',
              contact_person: d.contact_person || '',
              phone: d.phone || '',
              status: d.status || 'pending',
              admin_notes: d.admin_notes,
            });
          }
        }

        if (projectsRes.status === 'fulfilled') {
          const list: any[] = Array.isArray(projectsRes.value?.projects)
            ? projectsRes.value.projects
            : Array.isArray(projectsRes.value) ? projectsRes.value : [];
          setProjectCount(list.length);
          setRejectedProjects(
            list
              .filter((p: any) => p.status === 'rejected')
              .map((p: any) => ({ id: p.id, title: p.title, rejection_reason: p.rejection_reason || null }))
          );
          setHasPendingProjects(list.some((p: any) => p.status === 'pending'));
        }

        if (articlesRes.status === 'fulfilled') {
          const list = articlesRes.value?.articles || [];
          setArticleCount(Array.isArray(list) ? list.length : 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Onboarding step completion
  const step1Done = !!(profile?.company_name && profile?.description && profile?.phone);
  const step2Done = projectCount > 0;
  const step3Done = profile?.status === 'approved';

  const companyName = profile?.company_name || '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#b8864a]/20 border-t-[#b8864a] animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-8">

      {/* Rejection banner — non-dismissible while rejected */}
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
              View &amp; fix your projects →
            </a>
          </div>
        </div>
      )}

      {/* Pending review banner — dismissible via sessionStorage */}
      {rejectedProjects.length === 0 && hasPendingProjects && !bannerDismissed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Your project is under review</p>
            <p className="mt-0.5 text-xs text-amber-700">We'll notify you once the review is complete.</p>
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

      {/* ── Welcome header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c2c2c]">
            {companyName ? `Welcome, ${companyName}` : 'Welcome to your Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Complete the steps below to get discovered by potential clients.
          </p>
        </div>
        {profile?.id && (
          <a
            href={`/companies/${profile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:border-[#b8864a]/40 hover:text-[#b8864a] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Preview
          </a>
        )}
      </div>

      {/* ── Ranking boost banner ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1208 0%, #2d1f0e 60%, #3d2c14 100%)' }}
      >
        <div className="px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#b8864a]/20 flex items-center justify-center">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4a96a]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] sm:text-[16px] font-semibold text-white leading-snug">
              More projects = higher ranking = more clients
            </p>
            <p className="text-[13px] sm:text-[14px] text-white/55 mt-0.5">
              You have <span className="text-[#d4a96a] font-semibold">{projectCount}</span> project{projectCount !== 1 ? 's' : ''} · Ranking score: <span className="text-[#d4a96a] font-semibold">{(projectCount + articleCount) * 10} pts</span>. Upload more to rank higher in search and attract more homeowners.
            </p>
          </div>
          <button
            onClick={() => navigate('/company/projects')}
            className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-semibold text-[#1a1208] transition hover:opacity-90 whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #c6a065 0%, #b8864a 100%)' }}
          >
            + Add Project
          </button>
        </div>
      </div>

      {/* ── Onboarding stepper ── */}
      {!step3Done && (
        <OnboardingStepper
          step1Done={step1Done}
          step2Done={step2Done}
          step3Done={step3Done}
          profileStatus={profile?.status || 'pending'}
          adminNotes={profile?.admin_notes}
          onStep1={() => navigate('/company/profile')}
          onStep2={() => navigate('/company/projects')}
        />
      )}

      {/* ── Under review banner ── */}
      {step1Done && step2Done && !step3Done && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-5 flex items-center gap-4">
          <Clock className="w-5 h-5 text-[#b8864a] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#2c2c2c]">Profile under review</p>
            <p className="text-xs text-stone-500 mt-0.5">Our team will notify you within 1–2 business days.</p>
          </div>
        </div>
      )}

      {/* ── Approved banner ── */}
      {step3Done && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Profile Approved</p>
            <p className="text-xs text-green-700">Your company is live and discoverable by clients.</p>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<FolderOpen className="w-5 h-5 text-[#b8864a]" />}
          label="Projects"
          value={projectCount}
          hint="Each project +10 pts"
          onClick={() => navigate('/company/projects')}
        />
        <StatCard
          icon={<FileText className="w-5 h-5 text-[#b8864a]" />}
          label="Articles"
          value={articleCount}
          hint="Each article +10 pts"
          onClick={() => navigate('/company/articles')}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-[#b8864a]" />}
          label="Ranking Score"
          value={(projectCount + articleCount) * 10}
          hint="pts"
          onClick={() => {}}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          label="Edit Profile"
          desc="Update company info & services"
          icon={<User className="w-4 h-4" />}
          onClick={() => navigate('/company/profile')}
        />
        <QuickAction
          label="Upload Project"
          desc="Add portfolio photos"
          icon={<FolderOpen className="w-4 h-4" />}
          onClick={() => navigate('/company/projects')}
        />
        <QuickAction
          label="Write Article"
          desc="Boost SEO with content"
          icon={<FileText className="w-4 h-4" />}
          onClick={() => navigate('/company/articles')}
        />
      </div>

    </div>
  );
}

/* ── Onboarding Stepper ── */
function OnboardingStepper({
  step1Done, step2Done, step3Done, profileStatus, adminNotes,
  onStep1, onStep2,
}: {
  step1Done: boolean; step2Done: boolean; step3Done: boolean;
  profileStatus: string; adminNotes?: string;
  onStep1: () => void; onStep2: () => void;
}) {
  const steps = [
    {
      number: 1,
      label: 'Complete Profile',
      desc: step1Done ? 'Company info filled in' : 'Add company name, description & phone',
      done: step1Done,
      action: onStep1,
      actionLabel: step1Done ? 'Edit Profile' : 'Complete Now',
    },
    {
      number: 2,
      label: 'Upload First Project',
      desc: step2Done ? 'Portfolio uploaded' : 'Show clients what you can do',
      done: step2Done,
      action: onStep2,
      actionLabel: step2Done ? 'Add More' : 'Upload Now',
    },
    {
      number: 3,
      label: 'Under Review',
      desc: profileStatus === 'rejected'
        ? `Needs updates${adminNotes ? ': ' + adminNotes : ''}`
        : 'Our team will review and approve within 1–2 business days',
      done: step3Done,
      action: null,
      actionLabel: '',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#2c2c2c]">Getting Started</h2>
        <span className="text-xs text-stone-400">
          {[step1Done, step2Done, step3Done].filter(Boolean).length} / 3 complete
        </span>
      </div>

      {/* Step row connector */}
      <div className="px-4 py-5">
        {/* Grid: each step gets equal 1/3 width, circle centered inside column.
            Connectors are absolute-positioned from center-of-col to center-of-next-col. */}
        <div className="grid grid-cols-3 mb-6 relative">
          {steps.map((step, i) => (
            <div key={step.number} className="flex flex-col items-center relative">
              {/* Left connector (from previous step center to this center) */}
              {i > 0 && (
                <div className={`absolute top-[18px] right-1/2 left-0 h-0.5 transition-all ${
                  steps[i - 1].done ? 'bg-[#b8864a]' : 'bg-stone-200'
                }`} />
              )}
              {/* Right connector (from this center to next step center) */}
              {i < steps.length - 1 && (
                <div className={`absolute top-[18px] left-1/2 right-0 h-0.5 transition-all ${
                  step.done ? 'bg-[#b8864a]' : 'bg-stone-200'
                }`} />
              )}
              {/* Circle — solid white ring behind to mask connector line */}
              <div className="relative z-10 w-9 h-9 rounded-full bg-white flex items-center justify-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step.done
                  ? 'bg-[#b8864a] text-white'
                  : i === steps.findIndex(s => !s.done)
                    ? 'bg-white text-[#b8864a] border-2 border-[#b8864a]'
                    : 'bg-stone-100 text-stone-400'
              }`}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.number}
              </div>
              </div>
              {/* Label */}
              <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight px-1 ${step.done ? 'text-[#b8864a]' : 'text-stone-400'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Active step detail card (only for steps with an action, i.e. step 1 & 2) */}
        {steps.map((step, i) => {
          const isActive = !step.done && i === steps.findIndex(s => !s.done);
          if (!isActive) return null;
          if (!step.action) return null;
          return (
            <div key={step.number} className="rounded-xl border border-[#b8864a]/20 bg-[#b8864a]/5 px-4 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.done
                    ? <CheckCircle2 className="w-4 h-4 text-[#b8864a]" />
                    : <Circle className="w-4 h-4 text-[#b8864a]" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2c2c2c]">Step {step.number}: {step.label}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{step.desc}</p>
                </div>
              </div>
              {step.action && (
                <button
                  type="button"
                  onClick={step.action}
                  className="flex-shrink-0 flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#b8864a] text-white text-xs font-semibold hover:bg-[#a4763f] transition"
                >
                  {step.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {!step.action && (
                <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-stone-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>1–2 business days</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, hint, onClick }: {
  icon: React.ReactNode; label: string; value: number; hint: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 text-left hover:shadow-md transition group"
    >
      <div className="flex items-center justify-between mb-1.5">
        {icon}
        <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#b8864a] transition" />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{value}</p>
      <p className="text-[11px] sm:text-xs font-medium text-stone-600 mt-0.5">{label}</p>
      <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 hidden sm:block">{hint}</p>
    </button>
  );
}

/* ── Quick action ── */
function QuickAction({ label, desc, icon, onClick }: {
  label: string; desc: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left hover:border-[#b8864a]/40 hover:shadow-sm transition group"
    >
      <div className="w-8 h-8 rounded-lg bg-[#b8864a]/10 flex items-center justify-center text-[#b8864a] flex-shrink-0 group-hover:bg-[#b8864a]/20 transition">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#2c2c2c]">{label}</p>
        <p className="text-xs text-stone-400">{desc}</p>
      </div>
    </button>
  );
}
