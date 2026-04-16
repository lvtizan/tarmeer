import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, ArrowRight, FolderOpen, FileText, User, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import CompanyProfileForm from '../../components/company/CompanyProfileForm';

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

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
          onStep1Done={loadData}
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
  onStep1Done, onStep2,
}: {
  step1Done: boolean; step2Done: boolean; step3Done: boolean;
  profileStatus: string; adminNotes?: string;
  onStep1Done: () => void;
  onStep2: () => void;
}) {
  const activeStep = !step1Done ? 1 : !step2Done ? 2 : 3;
  const stepDone = [step1Done, step2Done, step3Done];
  const stepLabels = ['Complete Profile', 'Upload First Project', 'Under Review'];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#2c2c2c]">Getting Started</h2>
        <span className="text-xs text-stone-400">
          {[step1Done, step2Done, step3Done].filter(Boolean).length} / 3 complete
        </span>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Step row connector */}
        <div className="flex items-center">
          {[1, 2, 3].map((n, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  stepDone[i]
                    ? 'bg-[#b8864a] text-white'
                    : n === activeStep
                      ? 'bg-[#b8864a]/10 text-[#b8864a] border-2 border-[#b8864a]'
                      : 'bg-stone-100 text-stone-400'
                }`}>
                  {stepDone[i] ? <CheckCircle2 className="w-4 h-4" /> : n}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${
                  stepDone[i] || n === activeStep ? 'text-[#b8864a]' : 'text-stone-400'
                }`}>
                  {stepLabels[i]}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-2 transition-all ${stepDone[i] ? 'bg-[#b8864a]' : 'bg-stone-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: full inline profile form */}
        {activeStep === 1 && (
          <div>
            <p className="text-sm text-stone-500 mb-4">填写公司信息，让客户找到你。填完自动保存，完善三个必填项（公司名、描述、电话）后步骤自动推进。</p>
            <CompanyProfileForm onSaved={onStep1Done} />
          </div>
        )}

        {/* Step 2: Upload project */}
        {activeStep === 2 && (
          <div className="rounded-xl border border-[#b8864a]/20 bg-[#b8864a]/5 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#2c2c2c]">Step 2: Upload Your First Project</p>
              <p className="mt-0.5 text-xs text-stone-500">Show clients what you can do — photos speak louder than words.</p>
            </div>
            <button
              type="button"
              onClick={onStep2}
              className="flex-shrink-0 flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#b8864a] text-white text-xs font-semibold hover:bg-[#a4763f] transition"
            >
              Upload Now <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Step 3: Under review */}
        {activeStep === 3 && (
          <div className="rounded-xl border border-[#b8864a]/20 bg-[#b8864a]/5 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#2c2c2c]">Step 3: Under Review</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {profileStatus === 'rejected'
                  ? `Needs updates${adminNotes ? ': ' + adminNotes : ''}`
                  : 'Our team will review and approve within 1–2 business days.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400 flex-shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>1–2 days</span>
            </div>
          </div>
        )}
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
