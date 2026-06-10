'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import AdminSelect from '@/components/ui/AdminSelect';
import { Hammer, FileText, ExternalLink } from 'lucide-react';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface ExpertRow {
  id: number;
  slug: string;
  full_name: string;
  avatar_url: string | null;
  services: string[];
  city: string | null;
  phone: string | null;
  user_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  country: string;
  is_certified: boolean;
  is_signed: boolean;
  certificates: string[];
  license_url: string | null;
  experience_years: number | null;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminExpertsPage() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchExperts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getExperts({
        country,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setExperts(data.experts || []);
    } catch {
      setExperts([]);
    }
    setLoading(false);
  }, [country, statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchExperts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchExperts, search]);

  const handleStatus = async (id: number, status: 'approved' | 'rejected' | 'pending') => {
    setUpdatingId(id);
    try {
      await adminApi.updateExpertStatus(id, status);
      setExperts(list => list.map(e => e.id === id ? { ...e, status } : e));
      showToast(
        status === 'approved' ? t('Expert approved', '已通过审核')
          : status === 'rejected' ? t('Expert rejected', '已驳回')
          : t('Status updated', '状态已更新'),
        'success'
      );
    } catch {
      showToast(t('Failed to update', '更新失败'), 'error');
    }
    setUpdatingId(null);
  };

  const handleToggleSigned = async (id: number, next: boolean) => {
    try {
      await adminApi.toggleExpertSigned(id, next);
      setExperts(list => list.map(e => e.id === id ? { ...e, is_signed: next } : e));
      showToast(next ? t('Marked as signed', '已标记签约') : t('Signed removed', '已取消签约'), 'success');
    } catch {
      showToast(t('Failed to update', '更新失败'), 'error');
    }
  };

  const handleToggleCertified = async (id: number, next: boolean) => {
    try {
      await adminApi.toggleExpertCertified(id, next);
      setExperts(list => list.map(e => e.id === id ? { ...e, is_certified: next } : e));
      showToast(next ? t('Certification enabled', '已开通认证') : t('Certification removed', '已取消认证'), 'success');
    } catch {
      showToast(t('Failed to update', '更新失败'), 'error');
    }
  };

  const openDocs = (e: ExpertRow) => {
    const urls = [...(Array.isArray(e.certificates) ? e.certificates : []), ...(e.license_url ? [e.license_url] : [])];
    urls.forEach(url => window.open(url, '_blank', 'noopener'));
  };

  const statusBadge = (status: ExpertRow['status']) => {
    if (status === 'approved') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">{t('Approved', '已上架')}</span>;
    }
    if (status === 'rejected') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">{t('Rejected', '已驳回')}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">{t('Pending', '待审核')}</span>;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Hammer className="w-5 h-5 text-[#b8864a]" />
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Experts', '专家管理')}</h1>
        <span className="text-sm text-stone-400">{experts.length}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search name or email…', '搜索姓名或邮箱…')}
          className="basis-full sm:basis-auto sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />
        <AdminSelect
          size="sm"
          className="w-36"
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
          options={[
            { value: 'all', label: t('All Status', '全部状态') },
            { value: 'pending', label: t('Pending', '待审核') },
            { value: 'approved', label: t('Approved', '已上架') },
            { value: 'rejected', label: t('Rejected', '已驳回') },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : experts.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          {t('No experts found.', '暂无专家。')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-medium text-stone-500">{t('Expert', '专家')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden md:table-cell">{t('Services', '服务')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden sm:table-cell">{t('City', '城市')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">{t('Years', '从业年限')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Documents', '证件')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Status', '状态')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Signed', '已签约')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Certified', '认证')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">{t('Created', '创建时间')}</th>
              </tr>
            </thead>
            <tbody>
              {experts.map(e => {
                const docCount = (Array.isArray(e.certificates) ? e.certificates.length : 0) + (e.license_url ? 1 : 0);
                return (
                  <tr key={e.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {e.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.avatar_url} alt={e.full_name} className="w-9 h-9 rounded-full object-cover bg-stone-100 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#f5f0e8] text-[#b8864a] flex items-center justify-center text-sm font-semibold shrink-0">
                            {(e.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-[#2c2c2c] flex items-center gap-1.5">
                            <span className="truncate">{e.full_name}</span>
                            {e.status === 'approved' && e.slug && (
                              <a
                                href={`/experts/${e.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t('Open public page', '查看主页')}
                                className="text-stone-300 hover:text-[#b8864a] transition shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-stone-400 truncate">{e.user_email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {Array.isArray(e.services) && e.services.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {e.services.slice(0, 3).map(s => (
                            <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600">{s}</span>
                          ))}
                          {e.services.length > 3 && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-400">+{e.services.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{e.city || <span className="text-stone-300">—</span>}</td>
                    <td className="px-4 py-3 text-stone-500 hidden lg:table-cell">
                      {e.experience_years != null ? t(`${e.experience_years} yrs`, `${e.experience_years} 年`) : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {docCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openDocs(e)}
                          title={t('Open certificates / license in new tabs', '在新窗口查看资格证 / 营业执照')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {docCount}
                        </button>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusBadge(e.status)}
                        {e.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={updatingId === e.id}
                              onClick={() => handleStatus(e.id, 'approved')}
                              className="text-xs px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {t('Approve', '通过')}
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === e.id}
                              onClick={() => handleStatus(e.id, 'rejected')}
                              className="text-xs px-2 py-1 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
                            >
                              {t('Reject', '驳回')}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSigned(e.id, !e.is_signed)}
                        className={`w-9 h-5 rounded-full relative transition-colors ${e.is_signed ? 'bg-[#b8864a]' : 'bg-stone-300'}`}
                      >
                        <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${e.is_signed ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleCertified(e.id, !e.is_certified)}
                        title="普通认证（¥1000）"
                        className={`w-9 h-5 rounded-full relative transition-colors ${e.is_certified ? 'bg-blue-500' : 'bg-stone-300'}`}
                      >
                        <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${e.is_certified ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </td>
                    <td className={`px-4 py-3 hidden lg:table-cell ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(e.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
