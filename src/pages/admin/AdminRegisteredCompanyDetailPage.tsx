import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2, Star, Check, ImagePlus, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { useAdminT } from '../../hooks/useAdminLang';
import { showToast } from '../../components/ui/Toast';

interface CompanyProfile {
  id: number;
  company_name: string;
  company_type: 'design_studio' | 'renovation_company' | string;
  status: 'pending' | 'approved' | 'rejected';
  description: string | null;
  contact_person: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  address: string | null;
  services: string | null;
  specialties: string | null;
  trade_license_number: string | null;
  establishment_year: number | null;
  logo_url: string | null;
  cover_image_url: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
  crm_tenant_id: string | null;
  crm_provisioned_at: string | null;
  crm_first_login_at: string | null;
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
  rejection_reason: string | null;
  created_at: string;
  is_published?: number;
}

const COMPANY_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function AdminRegisteredCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useAdminT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAdmin();
  // 来源页：优先 history.state（从列表点进来时塞的），否则按 backTab 回 /admin/companies
  const fromState = (location.state || {}) as { from?: string; fromLabel?: string };
  const canApprove = hasPermission('can_approve');

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [crmProvisioning, setCrmProvisioning] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingProjectId, setRejectingProjectId] = useState<number | null>(null);
  const [projectRejectReason, setProjectRejectReason] = useState('');
  const [projectRejectLoading, setProjectRejectLoading] = useState(false);
  const [projectActionError, setProjectActionError] = useState('');
  const [rejectionTemplates, setRejectionTemplates] = useState<Array<{ id: number; text: string }>>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);

  const loadDetail = () => {
    if (!id) return;
    setLoading(true);
    adminApi.getCompanyProfileDetail(Number(id))
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

  const handleApprove = async () => {
    setIsSubmitting(true);
    setActionError('');
    try {
      await adminApi.approveCompanyProfile(Number(id));
      loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      await adminApi.rejectCompanyProfile(Number(id), rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetCover = async (url: string) => {
    if (!company) return;
    const prev = company.cover_image_url;
    const next = prev === url ? null : url;
    setCompany({ ...company, cover_image_url: next });
    try {
      await adminApi.setCompanyCoverImage(company.id, next);
      showToast(next ? t('Cover updated', '封面已设置') : t('Cover cleared', '封面已清除'), 'success');
    } catch (err: any) {
      setCompany({ ...company, cover_image_url: prev });
      showToast(err?.message || t('Failed to update cover', '封面设置失败'), 'error');
    }
  };

  const handleAddToShowcase = async (url: string) => {
    try {
      // 读取当前配置
      const data = await adminApi.request('/system-config');
      const rows = (data.config as { config_key: string; config_value: string }[]);
      const row = rows.find(r => r.config_key === 'showcase_images');
      let images: string[] = [];
      if (row) { try { images = JSON.parse(row.config_value); } catch { } }
      if (images.includes(url)) { showToast(t('Already added', '已在展示列表中'), 'success'); return; }
      // 立即写入原图 URL
      await adminApi.request('/system-config', {
        method: 'PUT',
        body: JSON.stringify({ configs: [{ key: 'showcase_images', value: JSON.stringify([...images, url]) }] }),
      });
      showToast(t('Added', '设置成功'), 'success');
      // 后台静默压缩并替换为优化版本
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
          if (row2) { try { imgs2 = JSON.parse(row2.config_value); } catch { } }
          const replaced = imgs2.map((u: string) => u === url ? optimizedUrl : u);
          await adminApi.request('/system-config', {
            method: 'PUT',
            body: JSON.stringify({ configs: [{ key: 'showcase_images', value: JSON.stringify(replaced) }] }),
          });
        } catch { /* 静默失败，保留原图 URL */ }
      })();
    } catch {
      showToast(t('Failed', '设置失败'), 'error');
    }
  };

  const openProjectRejectModal = async (projectId: number) => {
    setRejectingProjectId(projectId);
    setProjectRejectReason('');
    setProjectActionError('');
    if (!templatesLoaded) {
      try {
        const { templates } = await adminApi.getRejectionTemplates();
        setRejectionTemplates(templates);
        setTemplatesLoaded(true);
      } catch {
        // ignore
      }
    }
  };

  const handleProjectReject = async () => {
    if (!rejectingProjectId || !projectRejectReason.trim()) return;
    setProjectRejectLoading(true);
    setProjectActionError('');
    try {
      await adminApi.rejectProject(rejectingProjectId, projectRejectReason);
      setProjects((prev: any[]) =>
        prev.map((p: any) =>
          p.id === rejectingProjectId
            ? { ...p, status: 'rejected', rejection_reason: projectRejectReason.trim() }
            : p
        )
      );
      setRejectingProjectId(null);
      setProjectRejectReason('');
      showToast('Project rejected.', 'success');
    } catch (err: any) {
      setProjectActionError(err.message || 'Failed to reject project.');
    } finally {
      setProjectRejectLoading(false);
    }
  };

  const handleProjectApprove = async (projectId: number) => {
    try {
      await adminApi.approveProject(projectId);
      setProjects((prev: any[]) =>
        prev.map((p: any) =>
          p.id === projectId ? { ...p, status: 'published', rejection_reason: null } : p
        )
      );
      showToast('Project approved.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to approve project.', 'error');
    }
  };

  const handleCrmProvision = async () => {
    if (!company) return;
    setCrmProvisioning(true);
    try {
      const result = await adminApi.request(`/profile-companies/${company.id}/crm-provision`, { method: 'POST' });
      setCompany((prev) => prev ? { ...prev, crm_tenant_id: result.crm_tenant_id } : prev);
      showToast('CRM 已开通', 'success');
    } catch (err: any) {
      showToast(err.message || '开通 CRM 失败', 'error');
    } finally {
      setCrmProvisioning(false);
    }
  };

  const handleTogglePublished = async () => {
    if (!company) return;
    const next = !(company.is_published !== 0);
    setTogglingPublished(true);
    try {
      await adminApi.toggleCompanyPublished(company.id, next);
      setCompany((prev) => prev ? { ...prev, is_published: next ? 1 : 0 } : prev);
      showToast(next ? '装企已上架' : '装企已下架', 'success');
    } catch (err: any) {
      showToast(err?.message || '操作失败', 'error');
    } finally {
      setTogglingPublished(false);
    }
  };

  const handleToggleProjectPublished = async (projectId: number, currentPublished: number | undefined) => {
    const next = !(currentPublished !== 0);
    try {
      await adminApi.toggleProjectPublished(Number(id), projectId, next);
      setProjects((prev) =>
        prev.map((p) => p.id === projectId ? { ...p, is_published: next ? 1 : 0 } : p)
      );
      showToast(next ? '项目已显示' : '项目已隐藏', 'success');
    } catch (err: any) {
      showToast(err?.message || '操作失败', 'error');
    }
  };

  const backTab = (() => {
    const tab = searchParams.get('tab');
    if (tab === 'applications' || tab === 'directory') return tab;
    return 'companies';
  })();

  if (loading) return <PageSpinner />;
  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!company) return <div className="p-6 text-stone-400">{t('Company not found.', '公司未找到')}</div>;

  const services = parseJsonArray(company.services);
  const specialties = parseJsonArray(company.specialties);

  return (
    <div className="w-full space-y-4">
      {/* Back button — 优先用从哪来的 from（如已签约列表），其次回 /admin/companies?tab=... */}
      <button
        onClick={() => navigate(fromState.from || `/admin/companies?tab=${backTab}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {fromState.fromLabel ? `返回${fromState.fromLabel}` : t('Back to Companies', '返回公司列表')}
      </button>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* ── MOBILE layout (< md / 768px): Header → Portfolio → Details → Services ── */}
      <div className="md:hidden space-y-3">
        {/* Card 1: Header */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
          {company.logo_url && (
            <SmartImage
              src={company.logo_url}
              alt={company.company_name}
              className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
            />
          )}
          <div>
            <h1 className="text-lg font-bold text-stone-800">{company.company_name}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                {{ design_studio: t('Design Studio', '设计工作室'), renovation_company: t('Renovation & Fit-out', '装修公司'), general_contractor: t('General Contractor', '总承包商'), mep_contractor: t('MEP Contractor', '机电工程'), maintenance_company: t('Maintenance', '维保公司'), specialty_trade: t('Specialty Trade', '专项工程'), landscaping: t('Landscaping & Pools', '景观工程'), furnishing: t('Furnishing', '软装公司') }[company.company_type] || company.company_type}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPANY_STATUS_COLORS[company.status] || 'bg-stone-100 text-stone-600'}`}>
                {company.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <Pencil size={14} />
                {t('Edit', '编辑')}
              </button>
              <a
                href={`/companies/${company.id}?admin_preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <ExternalLink size={14} />
                {t('Preview', '预览')}
              </a>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                {t('Delete', '删除')}
              </button>
            </div>
          </div>
          {company.description && (
            <p className="text-sm text-stone-600 leading-relaxed break-all">{company.description}</p>
          )}
          {canApprove && company.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {t('Approve', '通过')}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50"
              >
                {t('Reject', '拒绝')}
              </button>
            </div>
          )}
          {company.status === 'approved' && (
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
          )}
          {company.admin_notes && (
            <div className="mt-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
              <span className="font-medium">{t('Admin notes:', '管理员备注:')}</span> {company.admin_notes}
            </div>
          )}
        </div>

        {/* CRM card (mobile) */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">CRM</h2>
          {company.crm_tenant_id ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-700 font-medium">已开通</span>
                {company.crm_first_login_at ? (
                  <span className="text-stone-400 text-xs">· 已激活</span>
                ) : (
                  <span className="text-amber-600 text-xs">· 未激活</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-stone-400">未开通</span>
              <button
                onClick={handleCrmProvision}
                disabled={crmProvisioning || company.status !== 'approved'}
                className="px-3 py-1 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07040] disabled:opacity-50 transition"
              >
                {crmProvisioning ? '开通中…' : '开通'}
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Portfolio */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <h2 className="text-sm font-semibold text-stone-800">
              {t('Portfolio', '项目作品')} ({projects.length})
            </h2>
          </div>
          {styles.length > 1 && (
            <div className="flex gap-1 flex-wrap px-5 pb-3">
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
          {visibleProjects.length === 0 ? (
            <div className="p-12 text-center text-stone-400">
              {t('No projects yet', '暂无项目')}
            </div>
          ) : (
            <div className="p-5 pt-0">
              <div className="grid grid-cols-2 gap-3">
                {visibleProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`bg-white rounded-xl border overflow-hidden group cursor-pointer hover:shadow-md transition-shadow ${project.is_published === 0 ? 'border-amber-200' : 'border-stone-200'}`}
                    onClick={() => navigate(`/admin/profile-companies/${id}/projects/${project.id}`)}
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
                      {project.is_published === 0 && (
                        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                      )}
                      {project.images.length > 1 && (
                        <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full pointer-events-none">
                          {project.images.length}
                        </div>
                      )}
                      <div
                        className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleProjectPublished(project.id, project.is_published)}
                          className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${
                            project.is_published === 0
                              ? 'bg-amber-500 text-white !opacity-100'
                              : 'bg-white/95 text-stone-700 hover:bg-stone-100'
                          }`}
                          title={project.is_published === 0 ? '显示项目' : '隐藏项目'}
                        >
                          {project.is_published === 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span className="text-[9px] leading-none">{project.is_published === 0 ? '显示' : '隐藏'}</span>
                        </button>
                        {project.images[0] && (() => {
                          const isCover = company.cover_image_url === project.images[0];
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSetCover(project.images[0])}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${
                                  isCover
                                    ? 'bg-[#b8864a] text-white !opacity-100'
                                    : 'bg-white/95 text-stone-700 hover:bg-[#b8864a] hover:text-white'
                                }`}
                                title={isCover ? t('Click to clear cover', '再次点击清除封面') : t('Set as cover', '设为封面')}
                              >
                                {isCover ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                                <span className="text-[9px] leading-none">{t('Cover', '封面')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddToShowcase(project.images[0])}
                                className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md bg-white/95 text-stone-700 shadow-sm hover:bg-[#b8864a] hover:text-white transition-colors"
                                title={t('Add to login page showcase', '添加到登录页展示')}
                              >
                                <ImagePlus className="w-3 h-3" />
                                <span className="text-[9px] leading-none">{t('Showcase', '展示')}</span>
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className="text-xs font-medium text-stone-800 leading-snug line-clamp-1">{project.title}</h3>
                      <div className="flex flex-wrap gap-1 text-xs text-stone-400">
                        {project.style && <span>{project.style}</span>}
                        {project.location && <span>· {project.location}</span>}
                      </div>
                      {(project.status === 'pending' || project.status === 'rejected') && (
                        <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleProjectApprove(project.id)}
                            className="flex-1 rounded-lg border border-green-200 bg-green-50 px-1.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => openProjectRejectModal(project.id)}
                            className="flex-1 rounded-lg border border-red-200 bg-red-50 px-1.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Details + Owner merged */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">{t('Details', '详情')}</h2>
          <div className="space-y-3">
            {company.contact_person && <InfoRow label={t('Contact', '联系人')} value={company.contact_person} />}
            {company.phone && <InfoRow label={t('Phone', '电话')} value={company.phone} />}
            {company.city && <InfoRow label={t('City', '城市')} value={company.city} />}
            {company.address && <InfoRow label={t('Address', '地址')} value={company.address} />}
            {company.establishment_year && <InfoRow label={t('Est.', '成立')} value={String(company.establishment_year)} />}
            {company.trade_license_number && <InfoRow label={t('License', '执照')} value={company.trade_license_number} />}
            {company.website && (
              <div className="flex gap-2">
                <span className="text-stone-400 w-20 flex-shrink-0">{t('Website', '网站')}</span>
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline truncate">{company.website}</a>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <InfoRow label={t('Joined', '加入时间')} value={new Date(company.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} />
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Owner Account', '所有者账户')}</p>
            <div className="font-medium text-stone-800">{company.user_name}</div>
            <div className="mt-1 text-stone-500">{company.user_email}</div>
          </div>
        </div>

        {/* Card 4: Services / Specialties */}
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
      </div>

      {/* ── DESKTOP layout (md+ / ≥768px): Left sidebar w-80 | Right flex-1 ── */}
      <div className="hidden md:flex md:items-start gap-6">
        {/* LEFT: Company Info */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {company.logo_url && (
              <SmartImage
                src={company.logo_url}
                alt={company.company_name}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-stone-800">{company.company_name}</h1>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {{ design_studio: t('Design Studio', '设计工作室'), renovation_company: t('Renovation & Fit-out', '装修公司'), general_contractor: t('General Contractor', '总承包商'), mep_contractor: t('MEP Contractor', '机电工程'), maintenance_company: t('Maintenance', '维保公司'), specialty_trade: t('Specialty Trade', '专项工程'), landscaping: t('Landscaping & Pools', '景观工程'), furnishing: t('Furnishing', '软装公司') }[company.company_type] || company.company_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPANY_STATUS_COLORS[company.status] || 'bg-stone-100 text-stone-600'}`}>
                  {company.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <Pencil size={14} />
                  {t('Edit', '编辑')}
                </button>
                <a
                  href={`/companies/${company.id}?admin_preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <ExternalLink size={14} />
                  {t('Preview', '预览')}
                </a>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  {t('Delete', '删除')}
                </button>
              </div>
            </div>
            {company.description && (
              <p className="text-sm text-stone-600 leading-relaxed break-all">{company.description}</p>
            )}
            {/* Admin actions */}
            {canApprove && company.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {t('Approve', '通过')}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50"
                >
                  {t('Reject', '拒绝')}
                </button>
              </div>
            )}
            {company.status === 'approved' && (
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
            )}
            {company.admin_notes && (
              <div className="mt-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
                <span className="font-medium">{t('Admin notes:', '管理员备注:')}</span> {company.admin_notes}
              </div>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Details', '详情')}</h2>
            {company.contact_person && <InfoRow label={t('Contact', '联系人')} value={company.contact_person} />}
            {company.phone && <InfoRow label={t('Phone', '电话')} value={company.phone} />}
            {company.city && <InfoRow label={t('City', '城市')} value={company.city} />}
            {company.address && <InfoRow label={t('Address', '地址')} value={company.address} />}
            {company.establishment_year && <InfoRow label={t('Est.', '成立')} value={String(company.establishment_year)} />}
            {company.trade_license_number && <InfoRow label={t('License', '执照')} value={company.trade_license_number} />}
            {company.website && (
              <div className="flex gap-2">
                <span className="text-stone-400 w-20 flex-shrink-0">{t('Website', '网站')}</span>
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline truncate">{company.website}</a>
              </div>
            )}
            <div className="pt-1 border-t border-stone-100">
              <InfoRow label={t('Joined', '加入时间')} value={new Date(company.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} />
            </div>
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

          {/* Owner account */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Owner Account', '所有者账户')}</h2>
            <div className="font-medium text-stone-800">{company.user_name}</div>
            <div className="text-stone-500">{company.user_email}</div>
          </div>

          {/* CRM status card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">CRM</h2>
            {company.crm_tenant_id ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-green-700 font-medium">已开通</span>
                </div>
                {company.crm_first_login_at ? (
                  <div className="text-stone-500">
                    首次登录：{new Date(company.crm_first_login_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-amber-700">未激活</span>
                  </div>
                )}
                <div className="text-stone-400 text-xs break-all">tenant: {company.crm_tenant_id}</div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-stone-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-stone-300" />
                  未开通
                </div>
                <button
                  onClick={handleCrmProvision}
                  disabled={crmProvisioning || company.status !== 'approved'}
                  className="w-full py-1.5 rounded-lg bg-[#b8864a] text-white text-xs font-medium hover:bg-[#a07040] disabled:opacity-50 transition"
                >
                  {crmProvisioning ? '开通中…' : '开通 CRM'}
                </button>
                {company.status !== 'approved' && (
                  <p className="text-xs text-stone-400">审批通过后可开通</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Portfolio */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {/* Header inside card */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-base font-bold text-stone-800">
                {t('Portfolio', '作品集')} <span className="text-stone-400 font-normal text-sm">({projects.length} {t('projects', '项目')})</span>
              </h2>
              <button
                onClick={() => navigate(`/admin/profile-companies/${id}/projects/new`)}
                className="btn-primary px-4 py-2 text-sm"
              >
                + {t('Add Project', '添加项目')}
              </button>
            </div>

            {/* Style tabs */}
            {styles.length > 1 && (
              <div className="flex gap-1 flex-wrap px-5 pb-3">
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
              <div className="p-12 text-center text-stone-400">
                {t('No projects yet', '暂无项目')}
              </div>
            ) : (
              <div className="p-5 pt-0">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleProjects.map((project) => (
                    <div
                      key={project.id}
                      className={`bg-white rounded-xl border overflow-hidden group cursor-pointer hover:shadow-md transition-shadow ${project.is_published === 0 ? 'border-amber-200' : 'border-stone-200'}`}
                      onClick={() => navigate(`/admin/profile-companies/${id}/projects/${project.id}`)}
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
                        {project.is_published === 0 && (
                          <div className="absolute inset-0 bg-black/40 flex items-start justify-end p-2 pointer-events-none">
                            <span className="text-xs font-medium bg-amber-500 text-white rounded px-2 py-0.5">已隐藏</span>
                          </div>
                        )}
                        {project.images.length > 1 && (
                          <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full pointer-events-none">
                            {project.images.length}
                          </div>
                        )}
                        <div
                          className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleProjectPublished(project.id, project.is_published)}
                            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${
                              project.is_published === 0
                                ? 'bg-amber-500 text-white !opacity-100'
                                : 'bg-white/95 text-stone-700 hover:bg-stone-100'
                            }`}
                            title={project.is_published === 0 ? '显示项目' : '隐藏项目'}
                          >
                            {project.is_published === 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            <span className="text-[9px] leading-none">{project.is_published === 0 ? '显示' : '隐藏'}</span>
                          </button>
                          {project.images[0] && (() => {
                            const isCover = company.cover_image_url === project.images[0];
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSetCover(project.images[0])}
                                  className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md shadow-sm transition-colors ${
                                    isCover
                                      ? 'bg-[#b8864a] text-white !opacity-100'
                                      : 'bg-white/95 text-stone-700 hover:bg-[#b8864a] hover:text-white'
                                  }`}
                                  title={isCover ? t('Click to clear cover', '再次点击清除封面') : t('Set as cover', '设为封面')}
                                >
                                  {isCover ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                                  <span className="text-[9px] leading-none">{t('Cover', '封面')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddToShowcase(project.images[0])}
                                  className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md bg-white/95 text-stone-700 shadow-sm hover:bg-[#b8864a] hover:text-white transition-colors"
                                  title={t('Add to login page showcase', '添加到登录页展示')}
                                >
                                  <ImagePlus className="w-3 h-3" />
                                  <span className="text-[9px] leading-none">{t('Showcase', '展示')}</span>
                                </button>
                              </>
                            );
                          })()}
                        </div>
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
                        {project.rejection_reason && (
                          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{project.rejection_reason}</p>
                        )}
                        {(project.status === 'pending' || project.status === 'rejected') && (
                          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleProjectApprove(project.id)}
                              className="flex-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openProjectRejectModal(project.id)}
                              className="flex-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('Reject Company', '拒绝公司')}</h2>
            <p className="text-sm text-stone-500">{company.company_name}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('Reason for rejection...', '拒绝原因...')}
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="px-4 py-2 text-sm text-stone-600">{t('Cancel', '取消')}</button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? t('Rejecting...', '拒绝中...') : t('Reject', '拒绝')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project reject modal */}
      {rejectingProjectId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('Reject Project', '拒绝项目')}</h2>

            {/* Template history */}
            {rejectionTemplates.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-stone-500">{t('Recent reasons (click to use):', '历史话术（点击填入）:')}</p>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {rejectionTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setProjectRejectReason(tpl.text)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition line-clamp-2"
                    >
                      {tpl.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={projectRejectReason}
              onChange={(e) => setProjectRejectReason(e.target.value)}
              placeholder={t('Reason for rejection...', '拒绝原因...')}
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
            />

            {projectActionError && (
              <p className="text-xs text-red-600">{projectActionError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setRejectingProjectId(null); setProjectRejectReason(''); }}
                className="px-4 py-2 text-sm text-stone-600"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={handleProjectReject}
                disabled={projectRejectLoading || !projectRejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {projectRejectLoading ? t('Rejecting...', '拒绝中...') : t('Reject', '拒绝')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#2c2c2c]">{t('Delete Company', '删除装企')}</h2>
            <p className="text-sm text-[#6b6b6b]">
              {t(
                `This will permanently delete "${company.company_name}" and the owner account, including all projects, inquiries, and related data. This cannot be undone.`,
                `将永久删除「${company.company_name}」及其所有者账号，包括所有项目、询盘和关联数据，不可恢复。`
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-1.5">
                {t('Delete reason', '删除原因')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder={t('Enter delete reason...', '请输入删除原因...')}
                className="w-full h-[42px] px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 focus:bg-white"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteReason(''); }}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-2xl text-sm text-stone-600 hover:bg-stone-100 transition"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={async () => {
                  if (!deleteReason.trim()) return;
                  setDeleteLoading(true);
                  try {
                    await adminApi.deleteCompanyProfile(Number(id), deleteReason.trim());
                    navigate('/admin/companies');
                  } catch (err: any) {
                    setActionError(err.message || t('Delete failed', '删除失败'));
                  } finally {
                    setDeleteLoading(false);
                    setShowDeleteModal(false);
                  }
                }}
                disabled={deleteLoading || !deleteReason.trim()}
                className="px-4 py-2 rounded-2xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteLoading ? t('Deleting...', '删除中...') : t('Confirm Delete', '确认删除')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <CompanyEditModal
          type="profile"
          id={Number(id)}
          onClose={() => setShowEditModal(false)}
          onSaved={() => loadDetail()}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-stone-700">{value}</span>
    </div>
  );
}
