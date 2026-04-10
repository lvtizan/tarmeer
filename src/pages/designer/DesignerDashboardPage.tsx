import { Link } from 'react-router-dom';
import {
  FolderOpen,
  TrendingUp,
  Eye,
  Upload,
  UserCircle,
  Camera,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';

const PRIMARY = '#b8864a';

/* ── 新手引导组件 ───────────────────────────────────────── */

function OnboardingHero({ firstName }: { firstName: string }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[24px] border border-stone-200 bg-gradient-to-br from-[#fdf8f3] via-white to-[#f5efe8] p-8 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
      {/* 装饰圆圈 */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${PRIMARY}, transparent)` }} />
      <div className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full opacity-[0.07]" style={{ background: `radial-gradient(circle, ${PRIMARY}, transparent)` }} />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-lg">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
            <Sparkles className="size-3.5" style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold" style={{ color: PRIMARY }}>Welcome to Tarmeer</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-[#2c2c2c] md:text-3xl">
            Hi {firstName || 'Designer'}, let's build your portfolio!
          </h1>
          <p className="text-sm leading-relaxed text-stone-500">
            Designers with complete profiles and 3+ projects get <strong className="text-stone-700">5x more client inquiries</strong>.
            Follow the steps below to start receiving leads.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-center text-xs text-stone-500 max-w-[160px]">"I got my first client within a week of completing my profile."</p>
          <p className="text-[11px] font-semibold text-stone-400">— Tarmeer Designer</p>
        </div>
      </div>
    </section>
  );
}

interface StepCardProps {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  link: string;
  done: boolean;
  highlight?: boolean;
}

function StepCard({ step, icon, title, description, cta, link, done, highlight }: StepCardProps) {
  return (
    <Link
      to={link}
      className={`group relative flex flex-col rounded-[20px] border p-5 transition-all duration-200 ${
        done
          ? 'border-green-200 bg-green-50/50'
          : highlight
            ? 'border-[#b8864a]/30 bg-[#fdf8f3] shadow-[0_10px_30px_rgba(184,134,74,0.08)] hover:shadow-[0_14px_40px_rgba(184,134,74,0.12)]'
            : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
      }`}
    >
      {/* 步骤编号 */}
      <div className="mb-4 flex items-center justify-between">
        <div
          className={`flex size-10 items-center justify-center rounded-xl ${
            done ? 'bg-green-100' : 'bg-amber-50'
          }`}
        >
          {done ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : (
            <span className="text-sm font-bold" style={{ color: PRIMARY }}>{step}</span>
          )}
        </div>
        {!done && (
          <div className={`flex items-center gap-1 text-xs font-semibold transition ${highlight ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ color: PRIMARY }}>
            {cta} <ArrowRight className="size-3.5" />
          </div>
        )}
        {done && (
          <span className="text-xs font-semibold text-green-600">Completed</span>
        )}
      </div>

      {/* 图标 + 内容 */}
      <div className="mb-2 flex items-center gap-2.5">
        <span className={done ? 'text-green-600' : ''} style={done ? {} : { color: PRIMARY }}>
          {icon}
        </span>
        <h3 className={`text-sm font-bold ${done ? 'text-green-800' : 'text-[#2c2c2c]'}`}>{title}</h3>
      </div>
      <p className={`text-xs leading-relaxed ${done ? 'text-green-700/70' : 'text-stone-500'}`}>{description}</p>
    </Link>
  );
}

function OnboardingSteps({
  profileDone,
  hasAvatar,
  projectCount,
}: {
  profileDone: boolean;
  hasAvatar: boolean;
  projectCount: number;
}) {
  const hasProjects = projectCount >= 3;

  // 确定当前应该高亮哪一步
  const currentStep = !profileDone ? 1 : !hasAvatar ? 2 : !hasProjects ? 3 : 0;

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-bold text-[#2c2c2c]">Get Started</h2>
        <div className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-0.5">
          <span className="text-xs font-semibold text-stone-500">
            {[profileDone, hasAvatar, hasProjects].filter(Boolean).length}/3 done
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StepCard
          step={1}
          icon={<UserCircle className="size-5" />}
          title="Complete Your Profile"
          description="Add your name, title, city, and a brief bio. Clients see this first — make a great impression."
          cta="Edit Profile"
          link="/designer/profile"
          done={profileDone}
          highlight={currentStep === 1}
        />
        <StepCard
          step={2}
          icon={<Camera className="size-5" />}
          title="Upload a Profile Photo"
          description="Profiles with a photo receive 3x more views. A professional headshot works best."
          cta="Add Photo"
          link="/designer/profile"
          done={hasAvatar}
          highlight={currentStep === 2}
        />
        <StepCard
          step={3}
          icon={<Upload className="size-5" />}
          title={`Upload Projects (${Math.min(projectCount, 3)}/3)`}
          description="Showcase your best work. Three projects is the minimum to appear in client search results."
          cta="Upload Now"
          link="/designer/upload"
          done={hasProjects}
          highlight={currentStep === 3}
        />
      </div>
    </section>
  );
}

function WhyCompleteSection() {
  return (
    <section className="mb-6 rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
      <h2 className="mb-4 text-lg font-bold text-[#2c2c2c]">Why complete your portfolio?</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex gap-3 rounded-xl bg-stone-50 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Eye className="size-5" style={{ color: PRIMARY }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2c2c2c]">Get Discovered</p>
            <p className="mt-0.5 text-xs text-stone-500">Your profile appears in client search results across Dubai.</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-stone-50 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Users className="size-5" style={{ color: PRIMARY }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2c2c2c]">Receive Client Leads</p>
            <p className="mt-0.5 text-xs text-stone-500">Clients can contact you directly through the platform.</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-stone-50 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Zap className="size-5" style={{ color: PRIMARY }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2c2c2c]">Grow Your Business</p>
            <p className="mt-0.5 text-xs text-stone-500">Top designers on Tarmeer receive 10+ inquiries per month.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 主页面 ──────────────────────────────────────────── */

export default function DesignerDashboardPage() {
  const { profile, projects } = useDesigner();

  const firstName = profile.fullName.split(' ')[0];

  // 判断各项是否完成
  const profileChecklist = [
    Boolean(profile.fullName.trim()),
    Boolean(profile.title.trim()),
    Boolean(profile.phone.trim()),
    Boolean(profile.city.trim()),
    Boolean(profile.bio.trim()),
  ];
  const profileDone = profileChecklist.filter(Boolean).length >= 4; // 至少 4 项
  const hasAvatar = Boolean(profile.avatarUrl.trim());
  const isNewUser = !profileDone || !hasAvatar || projects.length < 3;

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">

        {/* 新手用户：显示引导流程 */}
        {isNewUser ? (
          <>
            <OnboardingHero firstName={firstName} />
            <OnboardingSteps
              profileDone={profileDone}
              hasAvatar={hasAvatar}
              projectCount={projects.length}
            />
            <WhyCompleteSection />

            {/* 如果已有项目，仍然显示 */}
            {projects.length > 0 && (
              <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#2c2c2c]">Your Projects</h2>
                    <p className="text-xs text-stone-500">Keep uploading to reach the 3-project minimum</p>
                  </div>
                  <Link
                    to="/designer/upload"
                    className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-white text-sm font-bold"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    Upload New Project
                  </Link>
                </div>
                <ProjectGrid projects={projects} />
              </section>
            )}
          </>
        ) : (
          /* 老用户：显示正常仪表盘 */
          <>
            <section className="mb-5 rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
              <h1 className="mb-1 text-3xl font-bold text-[#2c2c2c]">Welcome back, {firstName}</h1>
              <p className="text-sm text-stone-500">Here's an overview of your designer studio.</p>
            </section>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard icon={<FolderOpen className="h-5 w-5" style={{ color: PRIMARY }} />} label="Total Projects" value={String(projects.length)} />
              <StatCard icon={<Eye className="h-5 w-5" style={{ color: PRIMARY }} />} label="Profile Views" value="—" />
              <StatCard icon={<TrendingUp className="h-5 w-5" style={{ color: PRIMARY }} />} label="Leads This Month" value="—" />
            </div>

            <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-[#2c2c2c]">Your Projects</h2>
                  <p className="text-xs text-stone-500">Recent work and quick actions</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/designer/projects"
                    className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Manage all
                  </Link>
                  <Link
                    to="/designer/upload"
                    className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-white text-sm font-bold"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    Upload New Project
                  </Link>
                </div>
              </div>
              {projects.length === 0 ? (
                <p className="py-4 text-sm text-stone-500">No projects yet. Add your first project to get started.</p>
              ) : (
                <ProjectGrid projects={projects} />
              )}
            </section>
          </>
        )}

      </div>
    </div>
  );
}

/* ── 子组件 ──────────────────────────────────────────── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_10px_30px_rgba(28,18,8,0.04)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-xl bg-amber-50 p-2">{icon}</div>
        <span className="text-sm font-medium text-stone-500">{label}</span>
      </div>
      <p className="text-3xl font-bold leading-none text-[#2c2c2c]">{value}</p>
    </div>
  );
}

function ProjectGrid({ projects }: { projects: ReturnType<typeof useDesigner>['projects'] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/designer/upload/${p.id}`}
          className="group overflow-hidden rounded-[18px] border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-md"
        >
          <div className="aspect-[16/10] overflow-hidden bg-stone-100">
            <img
              src={p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&q=80'}
              alt=""
              className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="p-4">
            <h3 className="mb-2 min-h-[2.75rem] line-clamp-2 text-sm font-semibold text-[#2c2c2c]">{p.title}</h3>
            <p className="text-xs text-stone-500">
              {p.location && <span>{p.location}</span>}
              {p.location && p.year && ' · '}
              {p.year && <span>{p.year}</span>}
            </p>
            <div className="mt-3 flex justify-end">
              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold" style={{ color: PRIMARY }}>
                Edit →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
