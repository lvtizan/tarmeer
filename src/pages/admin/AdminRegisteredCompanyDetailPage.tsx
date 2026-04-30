import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { useAdminT } from '../../hooks/useAdminLang';

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
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
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
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAdmin();
  const canApprove = hasPermission('can_approve');

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      {/* Back button */}
      <button
        onClick={() => navigate(`/admin/companies?tab=${backTab}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {t('Back to Companies', '返回公司列表')}
      </button>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="space-y-3">

          {/* ── Card 1: Header ── */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 space-y-3">
            {/* Logo + name + badges + secondary actions */}
            <div className="flex items-start gap-3">
              {company.logo_url ? (
                <SmartImage src={company.logo_url} alt={company.company_name} className="w-12 h-12 rounded-lg object-contain bg-stone-50 border border-stone-100 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-600 flex-shrink-0">
                  {company.company_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-stone-800 leading-snug">{company.company_name}</h1>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {{ design_studio: t('Design Studio', '设计工作室'), renovation_company: t('Renovation & Fit-out', '装修公司'), general_contractor: t('General Contractor', '总承包商'), mep_contractor: t('MEP Contractor', '机电工程'), maintenance_company: t('Maintenance', '维保公司'), specialty_trade: t('Specialty Trade', '专项工程'), landscaping: t('Landscaping & Pools', '景观工程'), furnishing: t('Furnishing', '软装公司') }[company.company_type] || company.company_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPANY_STATUS_COLORS[company.status] || 'bg-stone-100 text-stone-600'}`}>
                    {company.status}
                  </span>
                </div>
              </div>
              {/* Secondary actions — top-right */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => setShowEditModal(true)} className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
                  <Pencil size={15} />
                </button>
                <a href={`/companies/${company.id}?admin_preview=1`} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{company.description}</p>
            )}

            {/* Admin notes */}
            {company.admin_notes && (
              <div className="text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
                <span className="font-medium">{t('Notes:', '备注:')}</span> {company.admin_notes}
              </div>
            )}

            {/* Approve / Reject */}
            {canApprove && company.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button onClick={handleApprove} disabled={isSubmitting} className="flex-1 h-11 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition">
                  {t('Approve', '通过')}
                </button>
                <button onClick={() => setShowRejectModal(true)} disabled={isSubmitting} className="flex-1 h-11 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 border border-red-200 disabled:opacity-50 transition">
                  {t('Reject', '拒绝')}
                </button>
              </div>
            )}
          </div>

          {/* ── Card 2: Portfolio ── */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t('Portfolio', '作品集')}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${projects.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {projects.length} {t('projects', '项目')}
              </span>
            </div>

            {/* Style filter tabs */}
            {styles.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {styles.map((s) => (
                  <button key={s} onClick={() => setActiveStyle(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeStyle === s ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    {s === 'all' ? `${t('All', '全部')} (${projects.length})` : s}
                  </button>
                ))}
              </div>
            )}

            {/* Project grid */}
            {visibleProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-red-200 bg-red-50/40 p-8 text-center">
                <p className="text-sm font-medium text-red-500">{t('No projects uploaded yet', '未上传任何项目')}</p>
                <p className="text-xs text-stone-400 mt-1">{t('Must upload at least 1 project before approval', '审核通过前须至少上传 1 个项目')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {visibleProjects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-stone-200 overflow-hidden group cursor-pointer hover:shadow-md transition-shadow bg-white" onClick={() => navigate(`/admin/profile-companies/${id}/projects/${project.id}`)}>
                    <div className="aspect-video bg-stone-100 overflow-hidden">
                      {project.images[0] ? (
                        <SmartImage src={project.images[0]} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <h3 className="text-sm font-medium text-stone-800 line-clamp-1">{project.title}</h3>
                      <div className="flex flex-wrap gap-1 text-xs text-stone-400">
                        {project.style && <span>{project.style}</span>}
                        {project.location && <span>· {project.location}</span>}
                        {project.year && <span>· {project.year}</span>}
                      </div>
                      {project.rejection_reason && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{project.rejection_reason}</p>}
                      {project.images.length > 1 && <p className="text-xs text-stone-400">{project.images.length} photos</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Card 3: Details + Owner ── */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">{t('Details', '详情')}</h2>
            <div className="space-y-2.5 text-sm">
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
              <InfoRow label={t('Joined', '加入时间')} value={new Date(company.created_at).toLocaleDateString()} />
            </div>
            <div className="mt-4 pt-3 border-t border-stone-100 space-y-2.5 text-sm">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t('Owner Account', '所有者账户')}</h2>
              <InfoRow label={t('Name', '姓名')} value={company.user_name} />
              <InfoRow label={t('Email', '邮箱')} value={company.user_email} />
            </div>
          </div>

          {/* ── Card 4: Services / Specialties (optional) ── */}
          {(services.length > 0 || specialties.length > 0) && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 space-y-4">
              {services.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t('Services', '服务')}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s, i) => <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">{s}</span>)}
                  </div>
                </div>
              )}
              {specialties.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t('Specialties', '专长')}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((s, i) => <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#b8864a]/10 text-[#b8864a]">{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
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
