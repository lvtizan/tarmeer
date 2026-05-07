import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, ExternalLink, AlertTriangle, Clock, Package, Layers, FolderOpen, User, FileText } from 'lucide-react';

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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  const cats = Array.isArray(profile?.categories) ? profile!.categories : [];
  const profileDone = !!(profile?.company_name && profile?.description && cats.length > 0);
  const licenseDone = !!profile?.license_url;

  const steps: Step[] = [
    {
      label: 'Company Profile',
      hint: 'Company name, description, origin and categories',
      icon: User,
      done: profileDone,
      to: '/supplier/profile',
      cta: profileDone ? 'Edit Profile' : 'Fill Profile',
    },
    {
      label: 'Trade License',
      hint: 'Upload your trade license document',
      icon: FileText,
      done: licenseDone,
      to: '/supplier/profile',
      cta: licenseDone ? 'View License' : 'Upload License',
    },
    {
      label: 'Product Catalogue',
      hint: 'Upload PDF catalogs and brochures',
      icon: FolderOpen,
      done: catalogCount > 0,
      to: '/supplier/catalogs',
      cta: catalogCount > 0 ? `${catalogCount} uploaded` : 'Add Catalog',
    },
    {
      label: 'Products',
      hint: 'Add product photos with descriptions',
      icon: Package,
      done: productCount > 0,
      to: '/supplier/products',
      cta: productCount > 0 ? `${productCount} products` : 'Add Products',
    },
    {
      label: 'Projects',
      hint: 'Showcase your project case studies',
      icon: Layers,
      done: projectCount > 0,
      to: '/supplier/projects',
      cta: projectCount > 0 ? `${projectCount} projects` : 'Add Projects',
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
              <p className="text-sm font-semibold text-amber-800">Under Review</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Your application is being reviewed by our team. Complete the steps below while you wait — approval typically takes 1–2 business days.
              </p>
            </div>
          </div>
        )}

        {status === 'rejected' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Application Not Approved</p>
              {profile?.admin_notes && (
                <p className="text-sm text-red-700 mt-0.5">{profile.admin_notes}</p>
              )}
              <p className="text-sm text-red-600 mt-1">Please update your profile and contact support if needed.</p>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">You're Live!</p>
                <p className="text-sm text-emerald-700 mt-0.5">Your showroom is visible to renovation companies and interior designers.</p>
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
                View Page
              </a>
            )}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">
            {profile?.company_name ? `Welcome, ${profile.company_name}` : 'Set Up Your Showroom'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {allDone
              ? 'All steps completed. Your profile is ready for review.'
              : `${completedSteps} of ${steps.length} steps completed`}
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
            { label: 'Products', count: productCount, icon: Package, to: '/supplier/products' },
            { label: 'Projects', count: projectCount, icon: Layers, to: '/supplier/projects' },
            { label: 'Catalogs', count: catalogCount, icon: FolderOpen, to: '/supplier/catalogs' },
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
