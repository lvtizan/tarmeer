'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Pencil, Star, Check, ImagePlus, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { PageSpinner } from '@/components/ui/Spinner';
import SmartImage from '@/components/ui/SmartImage';
import CompanyEditModal from '@/components/admin/CompanyEditModal';
import { useAdminT } from '@/hooks/useAdminLang';
import { showToast } from '@/components/ui/Toast';

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
  cover_image: string | null;
  year_established: number | null;
  license_number: string | null;
  services: string | null;
  specialties: string | null;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_id: number | null;
  is_published?: number;
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

function InfoRow({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline break-all">{value}</a>
      ) : (
        <span className="text-stone-700 break-words">{value}</span>
      )}
    </div>
  );
}

function CompanyDetailContent() {
  const { t } = useAdminT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const id = routeParams?.id as string | undefined;
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);

  const loadDetail = () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    adminApi.getCompanyFullDetail(Number(id))
      .then((data: { company: CompanyDetail; projects?: Project[] }) => {
        setCompany(data.company);
        setProjects(data.projects || []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDetail(); }, [id]);

  const styles = useMemo(() => {
    const all = projects.flatMap((p) => p.style ? [p.style] : []);
    return ['all', ...Array.from(new Set(all))];
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (activeStyle === 'all') return projects;
    return projects.filter((p) => p.style === activeStyle);
  }, [projects, activeStyle]);

  const handleSetCover = async (url: string) => {
    if (!company) return;
    const prev = company.cover_image;
    const next = prev === url ? null : url;
    setCompany({ ...company, cover_image: next });
    try {
      await adminApi.setDirectoryCompanyCoverImage(company.id, next);
      showToast(next ? t('Cover updated', '封面已设置') : t('Cover cleared', '封面已清除'), 'success');
    } catch (err: unknown) {
      setCompany({ ...company, cover_image: prev });
      showToast(err instanceof Error ? err.message : t('Failed to update cover', '封面设置失败'), 'error');
    }
  };

  const handleAddToShowcase = async (url: string) => {
    try {
      const data = await adminApi.request('/system-config');
      const rows = (data.config as { config_key: string; config_value: string }[]);
      const row = rows.find(r => r.config_key === 'showcase_images');
      let images: string[] = [];
      if (row) { try { images = JSON.parse(row.config_value); } catch { /* ignore */ } }
      if (images.includes(url)) { showToast(t('Already added', '已在展示列表中'), 'success'); return; }
      await adminApi.request('/system-config', {
        method: 'PUT',
        body: JSON.stringify({ configs: [{ key: 'showcase_images', value: JSON.stringify([...images, url]) }] }),
      });
      showToast(t('Added', '设置成功'), 'success');
      (async () => {
        try {
          const { optimizedUrl } = await adminApi.request('/showcase-images/optimize', {
            method: 'POST',
            body: JSON.stringify({ url }),
          });
          if (optimizedUrl === url) return;
          const d2 = await adminApi.request('/system-config');
          const r2 = (d2.config as { config_key: string; config_value: string }[]);
          const row2 = r2.find(r => r.config_key === 'showcase_images');
          let imgs2: string[] = [];
          if (row2) { try { imgs2 = JSON.parse(row2.config_value); } catch { /* ignore */ } }
          const replaced = imgs2.map((u: string) => u === url ? optimizedUrl : u);
          await adminApi.request('/system-config', {
            method: 'PUT',
            body: JSON.stringify({ configs: [{ key: 'showcase_images', value: JSON.stringify(replaced) }] }),
          });
        } catch { /* silent fail */ }
      })();
    } catch {
      showToast(t('Failed', '设置失败'), 'error');
    }
  };

  const handleTogglePublished = async () => {
    if (!company) return;
    const next = !(company.is_published !== 0);
    setTogglingPublished(true);
    try {
      await adminApi.toggleDirectoryPublished(company.id, next);
      setCompany((prev) => prev ? { ...prev, is_published: next ? 1 : 0 } : prev);
      showToast(next ? '公司已上架' : '公司已下架', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setTogglingPublished(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!company) return <div className="p-6 text-stone-400">{t('Company not found.', '公司未找到')}</div>;

  const services = parseJsonArray(company.services);
  const specialties = parseJsonArray(company.specialties);
  const backTab = searchParams.get('tab') || 'directory';
  const fromParam = searchParams.get('from');
  const recordId = searchParams.get('recordId');

  const descLines = company.description ? company.description.split('\n').length : 0;
  const needsCollapse = descLines > 10 || (company.description?.length ?? 0) > 400;

  const HeaderCard = () => (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      {company.logo_url && (
        <SmartImage
          src={company.logo_url}
          alt={company.name_en}
          className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
        />
      )}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold text-stone-800">{company.name_en}</h1>
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <Pencil size={14} />
            {t('Edit', '编辑')}
          </button>
        </div>
        {company.name_ar && <p className="text-sm text-stone-500 mt-0.5" dir="rtl">{company.name_ar}</p>}
        <p className="text-xs text-stone-400 mt-1">/{company.slug}</p>
        <div className="mt-2">
          <button
            onClick={handleTogglePublished}
            disabled={togglingPublished}
            className={`w-full py-2 rounded-lg text-sm font-medium border transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${
              company.is_published !== 0
                ? 'border-stone-200 text-stone-600 hover:bg-stone-50'
                : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            {company.is_published !== 0
              ? <><EyeOff size={14} />下架</>
              : <><Eye size={14} />上架</>}
          </button>
        </div>
      </div>
      {company.description && (
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
      )}
    </div>
  );

  const DetailsCard = () => (
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
  );

  const TagsCard = () => (services.length > 0 || specialties.length > 0) ? (
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
  ) : null;

  const OwnerCard = () => (
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
  );

  const ProjectGrid = ({ cols = 2 }: { cols?: 2 | 3 }) => (
    visibleProjects.length === 0 ? (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400">
        {t('No projects yet', '暂无项目')}
      </div>
    ) : (
      <div className={`grid gap-4 ${cols === 3 ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2'}`}>
        {visibleProjects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-xl border border-stone-200 overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-stone-100 overflow-hidden relative">
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
              {project.images[0] && (() => {
                const isCover = company.cover_image === project.images[0];
                return (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetCover(project.images[0]); }}
                      className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium shadow-md transition ${
                        isCover
                          ? 'bg-[#b8864a] text-white opacity-100'
                          : 'bg-white/95 text-stone-700 hover:bg-white opacity-0 group-hover:opacity-100'
                      }`}
                      title={isCover ? t('Click to clear cover', '再次点击清除封面') : t('Set as cover', '设为封面')}
                    >
                      {isCover ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                      {isCover ? t('Cover', '已是封面') : t('Set as cover', '设为封面')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleAddToShowcase(project.images[0]); }}
                      className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium shadow-md bg-white/95 text-stone-700 hover:bg-white opacity-0 group-hover:opacity-100 transition"
                      title={t('Add to login page showcase', '添加到登录页展示')}
                    >
                      <ImagePlus className="w-3 h-3" />
                      {t('Showcase', '用作展示')}
                    </button>
                  </>
                );
              })()}
            </div>
            <div className="p-3 space-y-1.5">
              <h3 className="text-sm font-medium text-stone-800 leading-snug line-clamp-1">{project.title}</h3>
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
    )
  );

  return (
    <div className="w-full space-y-4">
      {/* Back button */}
      <button
        onClick={() => {
          if (fromParam === 'visit-records' && recordId) {
            router.push(`/admin/visit-records?detail=${recordId}`);
          } else {
            router.push(`/admin/companies?tab=${backTab}`);
          }
        }}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {fromParam === 'visit-records' ? t('Back to Visit Record', '返回访谈记录') : t('Back to Companies', '返回公司列表')}
      </button>

      {/* MOBILE layout */}
      <div className="md:hidden space-y-4">
        <HeaderCard />
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <h2 className="text-base font-bold text-stone-800">
              {t('Portfolio', '作品集')} <span className="text-stone-400 font-normal text-sm">({projects.length} {t('projects', '项目')})</span>
            </h2>
          </div>
          {styles.length > 1 && (
            <div className="flex gap-1 flex-wrap px-5 pb-3">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStyle(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeStyle === s ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s === 'all' ? `${t('All', '全部')} (${projects.length})` : s}
                </button>
              ))}
            </div>
          )}
          <div className="p-5 pt-0">
            <ProjectGrid cols={2} />
          </div>
        </div>
        <DetailsCard />
        <TagsCard />
        <OwnerCard />
      </div>

      {/* DESKTOP layout */}
      <div className="hidden md:flex md:items-start gap-6">
        <div className="w-80 flex-shrink-0 space-y-4">
          <HeaderCard />
          <DetailsCard />
          <TagsCard />
          <OwnerCard />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-base font-bold text-stone-800">
                {t('Portfolio', '作品集')} <span className="text-stone-400 font-normal text-sm">({projects.length} {t('projects', '项目')})</span>
              </h2>
            </div>
            {styles.length > 1 && (
              <div className="flex gap-1 flex-wrap px-5 pb-3">
                {styles.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveStyle(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeStyle === s ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {s === 'all' ? `${t('All', '全部')} (${projects.length})` : s}
                  </button>
                ))}
              </div>
            )}
            <div className="p-5 pt-0">
              <ProjectGrid cols={3} />
            </div>
          </div>
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

export default function AdminCompanyDetailPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CompanyDetailContent />
    </Suspense>
  );
}
