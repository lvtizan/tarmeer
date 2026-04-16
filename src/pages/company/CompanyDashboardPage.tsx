import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, ArrowRight, FolderOpen, FileText, User, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';

interface ProfileSummary {
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

  useEffect(() => {
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
          const list = projectsRes.value?.projects || projectsRes.value || [];
          setProjectCount(Array.isArray(list) ? list.length : 0);
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

      {/* ── Welcome header ── */}
      <div>
        <h1 className="text-2xl font-bold text-[#2c2c2c]">
          {companyName ? `Welcome, ${companyName}` : 'Welcome to your Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Complete the steps below to get discovered by potential clients.
        </p>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, i) => (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step.done
                    ? 'bg-[#b8864a] text-white'
                    : i === steps.findIndex(s => !s.done)
                      ? 'bg-[#b8864a]/10 text-[#b8864a] border-2 border-[#b8864a]'
                      : 'bg-stone-100 text-stone-400'
                }`}>
                  {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${step.done ? 'text-[#b8864a]' : 'text-stone-400'}`}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-all ${
                  steps[i].done ? 'bg-[#b8864a]' : 'bg-stone-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Active step detail card */}
        {steps.map((step, i) => {
          const isActive = !step.done && i === steps.findIndex(s => !s.done);
          if (!isActive && !step.done) return null;
          if (!isActive) return null;
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
      className="rounded-2xl border border-stone-200 bg-white p-4 text-left hover:shadow-md transition group"
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[#b8864a] transition" />
      </div>
      <p className="text-2xl font-bold text-[#2c2c2c]">{value}</p>
      <p className="text-xs font-medium text-stone-600 mt-0.5">{label}</p>
      <p className="text-[11px] text-stone-400 mt-0.5">{hint}</p>
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
