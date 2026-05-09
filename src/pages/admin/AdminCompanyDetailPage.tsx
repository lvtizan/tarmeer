import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { useAdminT } from '../../hooks/useAdminLang';

interface CompanyDetail {
  id: number;
  name_en: string;
  name_ar: string | null;
  slug: string;
  city: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  description: string | null;
  logo_url: string | null;
  year_established: number | null;
  license_number: string | null;
  services: string | null;
  specialties: string | null;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_id: number | null;
}

interface Project {
  id: number;
  title: string;
  description: string | null;
  style: string | null;
  location: string | null;
  year: number | null;
  images: string[];
  tags: string[];
  status: string;
  created_at: string;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useAdminT();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state || {}) as { from?: string; fromLabel?: string };
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const loadDetail = () => {
    if (!id) return;
    setLoading(true);
    adminApi.getCompanyFullDetail(Number(id))
      .then((data: any) => {
        setCompany(data.company);
        setProjects(data.projects || []);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDetail(); }, [id]);

  const styles = useMemo(() => {
    const all = projects.flatMap((p) => p.style ? [p.style] : []);
    return ['all', ...Array.from(new Set(all))];
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (activeStyle === 'all') return projects;
    return projects.filter((p) => p.style === activeStyle);
  }, [projects, activeStyle]);

  if (loading) return <PageSpinner />;
  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!company) return <div className="p-6 text-stone-400">{t('Company not found.', '公司未找到')}</div>;

  const services = parseJsonArray(company.services);
  const specialties = parseJsonArray(company.specialties);
  const backTab = searchParams.get('tab') || 'directory';

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Back button — 优先用 from（如已签约列表传来的），否则回 /admin/companies?tab=... */}
      <button
        onClick={() => navigate(fromState.from || `/admin/companies?tab=${backTab}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {fromState.fromLabel ? `返回${fromState.fromLabel}` : t('Back to Companies', '返回公司列表')}
      </button>

      <div className="flex gap-6 items-start">
        {/* ===== LEFT: Company Info ===== */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {company.logo_url && (
              <SmartImage
                src={company.logo_url}
                alt={company.name_en}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-800">{company.name_en}</h1>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Edit company"
                >
                  <Pencil size={14} />
                  {t('Edit', '编辑')}
                </button>
              </div>
              {company.name_ar && <p className="text-sm text-stone-500 mt-0.5" dir="rtl">{company.name_ar}</p>}
              <p className="text-xs text-stone-400 mt-1">/{company.slug}</p>
            </div>
            {company.description && (() => {
              const lines = company.description.split('\n').length;
              const charThreshold = 400;
              const needsCollapse = lines > 10 || company.description.length > charThreshold;
              return (
                <div>
                  <p className={`text-sm text-stone-600 leading-relaxed whitespace-pre-wrap ${!descExpanded && needsCollapse ? 'line-clamp-[10]' : ''}`}>
                    {company.description}
                  </p>
                  {needsCollapse && (
                    <button
                      onClick={() => setDescExpanded(v => !v)}
                      className="mt-1 text-xs text-[#b8864a] hover:underline"
                    >
                      {descExpanded ? '收起' : '展开'}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Details', '详情')}</h2>
            {company.city && <InfoRow label={t('City', '城市')} value={company.city} />}
            {company.area && <InfoRow label={t('Area', '区域')} value={company.area} />}
            {company.address && <InfoRow label={t('Address', '地址')} value={company.address} />}
            {company.year_established && <InfoRow label={t('Est.', '成立')} value={String(company.year_established)} />}
            {company.license_number && <InfoRow label={t('License', '执照')} value={company.license_number} />}
            {company.phone && <InfoRow label={t('Phone', '电话')} value={company.phone} />}
            {company.whatsapp && <InfoRow label="WhatsApp" value={company.whatsapp} />}
            {company.email && <InfoRow label={t('Email', '邮箱')} value={company.email} />}
            {company.website && <InfoRow label={t('Website', '网站')} value={company.website} isLink />}
            {company.instagram && <InfoRow label="Instagram" value={company.instagram} isLink />}
            {company.facebook && <InfoRow label="Facebook" value={company.facebook} isLink />}
            {company.linkedin && <InfoRow label="LinkedIn" value={company.linkedin} isLink />}
          </div>

          {/* Services / Specialties */}
          {(services.length > 0 || specialties.length > 0) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              {services.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{t('Services', '服务')}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {specialties.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{t('Specialties', '专长')}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#b8864a]/10 text-[#b8864a]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Owner */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Owner Account', '所有者账户')}</h2>
            {company.owner_user_id ? (
              <div className="space-y-1">
                <div className="font-medium text-stone-800">{company.owner_name}</div>
                <div className="text-stone-500">{company.owner_email}</div>
              </div>
            ) : (
              <p className="text-stone-400 text-xs">{t('Not claimed', '未认领')}</p>
            )}
          </div>
        </div>

        {/* ===== RIGHT: Portfolio ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-800">{t('Portfolio', '作品集')} <span className="text-stone-400 font-normal text-sm">({projects.length} {t('projects', '项目')})</span></h2>
          </div>

          {/* Style tabs */}
          {styles.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStyle(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeStyle === s
                      ? 'bg-[#b8864a] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s === 'all' ? `${t('All', '全部')} (${projects.length})` : s}
                </button>
              ))}
            </div>
          )}

          {/* Project grid */}
          {visibleProjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400">
              {t('No projects yet', '暂无项目')}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group">
                  {/* Cover image */}
                  <div className="aspect-video bg-stone-100 overflow-hidden">
                    {project.images[0] ? (
                      <SmartImage
                        src={project.images[0]}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300">
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-stone-800 leading-snug line-clamp-1">{project.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-stone-400">
                      {project.style && <span>{project.style}</span>}
                      {project.location && <span>· {project.location}</span>}
                      {project.year && <span>· {project.year}</span>}
                    </div>
                    {project.images.length > 1 && (
                      <p className="text-xs text-stone-400">{project.images.length} photos</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <CompanyEditModal
          type="scraped"
          id={Number(id)}
          onClose={() => setShowEditModal(false)}
          onSaved={() => loadDetail()}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#b8864a] hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-stone-700 break-words">{value}</span>
      )}
    </div>
  );
}
