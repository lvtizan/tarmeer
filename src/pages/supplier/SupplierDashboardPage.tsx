import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, ExternalLink, AlertTriangle, Clock, Package, Layers, FolderOpen, User, FileText } from 'lucide-react';
import { useAdminT } from '../../hooks/useAdminLang';
import { ScreenSpinner } from '../../components/ui/Spinner';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

interface Profile {
  company_name: string;
  description: string;
  categories: string[] | string | null;
  license_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  slug: string;
}

interface Step {
  label: string;
  hint: string;
  icon: React.ElementType;
  done: boolean;
  to: string;
  cta: string;
}

export default function SupplierDashboardPage() {
  const { t } = useAdminT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = authHeaders() as any;

    Promise.allSettled([
      fetch(`${API_BASE}/suppliers/me/profile`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/suppliers/me/products`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/suppliers/me/projects`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/suppliers/me/catalogs`, { headers: h }).then(r => r.json()),
    ]).then(([profileRes, productsRes, projectsRes, catalogsRes]) => {
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value?.profile;
        if (p) {
          const cats = typeof p.categories === 'string'
            ? (() => { try { return JSON.parse(p.categories); } catch { return []; } })()
            : (p.categories || []);
          setProfile({ ...p, categories: cats });
        }
      }
      if (productsRes.status === 'fulfilled') {
        setProductCount((productsRes.value?.products || []).length);
      }
      if (projectsRes.status === 'fulfilled') {
        setProjectCount((projectsRes.value?.projects || []).length);
      }
      if (catalogsRes.status === 'fulfilled') {
        setCatalogCount((catalogsRes.value?.catalogs || []).length);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <ScreenSpinner />;

  const cats = Array.isArray(profile?.categories) ? profile!.categories : [];
  const profileDone = !!(profile?.company_name && profile?.description && cats.length > 0);
  const licenseDone = !!profile?.license_url;

  const steps: Step[] = [
    {
      label: t('Company Profile', '公司介绍'),
      hint: t('Company name, description, origin and categories', '公司名称、简介、来源和品类'),
      icon: User,
      done: profileDone,
      to: '/supplier/profile',
      cta: profileDone ? t('Edit Profile', '编辑资料') : t('Fill Profile', '填写资料'),
    },
    {
      label: t('Trade License', '营业执照'),
      hint: t('Upload your trade license document', '上传营业执照文件'),
      icon: FileText,
      done: licenseDone,
      to: '/supplier/profile',
      cta: licenseDone ? t('View License', '查看执照') : t('Upload License', '上传执照'),
    },
    {
      label: t('Product Catalogue', '产品目录'),
      hint: t('Upload PDF catalogs and brochures', '上传PDF目录和宣传册'),
      icon: FolderOpen,
      done: catalogCount > 0,
      to: '/supplier/catalogs',
      cta: catalogCount > 0 ? `${catalogCount} ${t('uploaded', '份已上传')}` : t('Add Catalog', '添加目录'),
    },
    {
      label: t('Products', '产品'),
      hint: t('Add product photos with descriptions', '上传产品图片和描述'),
      icon: Package,
      done: productCount > 0,
      to: '/supplier/products',
      cta: productCount > 0 ? `${productCount} ${t('products', '件产品')}` : t('Add Products', '添加产品'),
    },
    {
      label: t('Projects', '项目案例'),
      hint: t('Showcase your project case studies', '展示项目案例'),
      icon: Layers,
      done: projectCount > 0,
      to: '/supplier/projects',
      cta: projectCount > 0 ? `${projectCount} ${t('projects', '个项目')}` : t('Add Projects', '添加项目'),
    },
  ];

  const completedSteps = steps.filter(s => s.done).length;
  const allDone = completedSteps === steps.length;
  const status = profile?.status || 'pending';

  return (
    <>
      <Helmet><title>Dashboard — Supplier Portal | Tarmeer</title></Helmet>

      <div className="max-w-[860px] space-y-6">

        {/* Status banner */}
        {status === 'pending' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t('Under Review', '审核中')}</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {t('Your application is being reviewed by our team. Complete the steps below while you wait — approval typically takes 1–2 business days.', '您的申请正在审核中，请在等待期间完成以下步骤，审核通常需要 1–2 个工作日。')}
              </p>
            </div>
          </div>
        )}

        {status === 'rejected' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">{t('Application Not Approved', '申请未通过')}</p>
              {profile?.admin_notes && (
                <p className="text-sm text-red-700 mt-0.5">{profile.admin_notes}</p>
              )}
              <p className="text-sm text-red-600 mt-1">{t('Please update your profile and contact support if needed.', '请更新资料，如有疑问请联系我们。')}</p>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">{t("You're Live!", '已上线！')}</p>
                <p className="text-sm text-emerald-700 mt-0.5">{t('Your showroom is visible to renovation companies and interior designers.', '您的展厅已对装修公司和室内设计师开放。')}</p>
              </div>
            </div>
            {profile?.slug && (
              <a
                href={`/materials/suppliers/${profile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                {t('View Page', '查看页面')}
              </a>
            )}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">
            {profile?.company_name ? `${t('Welcome', '欢迎')}，${profile.company_name}` : t('Set Up Your Showroom', '设置您的展厅')}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {allDone
              ? t('All steps completed. Your profile is ready for review.', '全部步骤已完成，等待审核。')
              : t(`${completedSteps} of ${steps.length} steps completed`, `已完成 ${completedSteps}/${steps.length} 步`)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#b8864a] rounded-full transition-all duration-500"
            style={{ width: `${(completedSteps / steps.length) * 100}%` }}
          />
        </div>

        {/* Onboarding steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className={`bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 transition ${
                step.done ? 'border-stone-200' : 'border-stone-200 hover:border-[#b8864a]/30'
              }`}
            >
              {/* Step number / check */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                step.done ? 'bg-emerald-100' : 'bg-stone-100'
              }`}>
                {step.done
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <span className="text-sm font-bold text-stone-400">{i + 1}</span>
                }
              </div>

              {/* Icon + text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <step.icon className="w-4 h-4 text-stone-400 shrink-0" />
                  <span className={`text-[15px] font-semibold ${step.done ? 'text-stone-400 line-through' : 'text-[#1c1917]'}`}>
                    {step.label}
                  </span>
                </div>
                <p className="text-sm text-stone-400 mt-0.5 hidden sm:block">{step.hint}</p>
              </div>

              {/* CTA */}
              <Link
                to={step.to}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  step.done
                    ? 'text-stone-400 hover:text-stone-600'
                    : 'bg-[#b8864a] text-white hover:bg-[#a3780a]'
                }`}
              >
                {step.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('Products', '产品'), count: productCount, icon: Package, to: '/supplier/products' },
            { label: t('Projects', '项目'), count: projectCount, icon: Layers, to: '/supplier/projects' },
            { label: t('Catalogs', '目录'), count: catalogCount, icon: FolderOpen, to: '/supplier/catalogs' },
          ].map(({ label, count, icon: Icon, to }) => (
            <Link key={label} to={to}
              className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-col items-center gap-1 hover:border-[#b8864a]/40 transition">
              <Icon className="w-5 h-5 text-stone-400 mb-1" />
              <span className="text-2xl font-bold text-[#1c1917]">{count}</span>
              <span className="text-xs text-stone-400">{label}</span>
            </Link>
          ))}
        </div>

      </div>
    </>
  );
}
