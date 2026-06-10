'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import CompanyEditModal from '@/components/admin/CompanyEditModal';
import AdminCompaniesTableTab from '@/components/admin/AdminCompaniesTableTab';
import AdminDirectoryTable from '@/components/admin/AdminDirectoryTable';
import AdminApplicationsTable from '@/components/admin/AdminApplicationsTable';
import AdminSelect from '@/components/ui/AdminSelect';
import BackToAnalytics from '@/components/admin/BackToAnalytics';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

type Tab = 'companies' | 'directory' | 'applications';
type ClaimedFilter = 'all' | 'claimed' | 'unclaimed';
type ProfileStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type SortDir = 'asc' | 'desc';

interface CompanyProfileRecord {
  id: number;
  company_name: string;
  company_type: string;
  status: 'pending' | 'approved' | 'rejected';
  display_order: number;
  home_display_order: number;
  list_display_order: number;
  city: string | null;
  logo_url: string | null;
  user_name: string;
  user_email: string;
  project_count: number;
  created_at: string;
  is_signed?: boolean;
}

interface CompanyRecord {
  id: number;
  name_en: string;
  slug: string;
  city: string;
  logo_url: string | null;
  home_display_order: number;
  list_display_order: number;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  project_count: number;
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useAdminCountry();

  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'directory') return 'directory';
    if (t === 'applications') return 'applications';
    return 'companies';
  });

  // Companies tab state
  const [profiles, setProfiles] = useState<CompanyProfileRecord[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profilePage, setProfilePage] = useState(1);
  const [profileStatusFilter, setProfileStatusFilter] = useState<ProfileStatusFilter>('all');
  const [profileSearch, setProfileSearch] = useState(() => searchParams.get('search') || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [orderSavingId, setOrderSavingId] = useState<number | null>(null);
  const [directoryOrderSavingKey, setDirectoryOrderSavingKey] = useState<string | null>(null);
  const [profileBadgeTotal, setProfileBadgeTotal] = useState(0);
  const [profileSortDir, setProfileSortDir] = useState<SortDir>('desc');
  const [profileSortActive, setProfileSortActive] = useState(true);
  const [profileUpdatedSortDir, setProfileUpdatedSortDir] = useState<SortDir>('desc');
  const [profileUpdatedSortActive, setProfileUpdatedSortActive] = useState(false);

  // Applications tab state
  const [pendingProfiles, setPendingProfiles] = useState<CompanyProfileRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingStatusFilter, setPendingStatusFilter] = useState<ProfileStatusFilter>('pending');
  const [pendingSearch, setPendingSearch] = useState(() => searchParams.get('search') || '');
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingBadgeTotal, setPendingBadgeTotal] = useState(0);
  const [pendingSortDir, setPendingSortDir] = useState<SortDir>('desc');
  const [pendingSortActive, setPendingSortActive] = useState(true);

  // Directory tab state
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [companyPage, setCompanyPage] = useState(1);
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>('all');
  const [companySearch, setCompanySearch] = useState(() => searchParams.get('search') || '');
  const [companyLoading, setCompanyLoading] = useState(false);
  const directoryLoaded = useRef(false);
  const [directoryBadgeTotal, setDirectoryBadgeTotal] = useState(0);
  const [directorySortDir, setDirectorySortDir] = useState<SortDir>('desc');
  const [directorySortActive, setDirectorySortActive] = useState(false);

  const [homeOrderCount, setHomeOrderCount] = useState(0);
  const [bindCompanyId, setBindCompanyId] = useState<number | null>(null);
  const [bindUserId, setBindUserId] = useState('');
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<{ type: 'scraped' | 'profile'; id: number } | null>(null);

  const loadProfiles = useCallback(async () => {
    setProfileLoading(true);
    try {
      const result = await adminApi.getRegisteredCompanies({
        page: profilePage, limit: 20,
        status: profileStatusFilter === 'all' ? undefined : profileStatusFilter,
        search: profileSearch || undefined,
        sort_by: profileUpdatedSortActive ? 'updated_at' : profileSortActive ? 'project_count' : undefined,
        sort_dir: profileUpdatedSortActive ? profileUpdatedSortDir : profileSortActive ? profileSortDir : undefined,
        country,
      });
      setProfiles(result.companies);
      setProfileTotal(result.total);
      if (profileStatusFilter === 'all' && !profileSearch) {
        setProfileBadgeTotal(result.total);
      }
    } catch (err: any) { setError(err.message); }
    finally { setProfileLoading(false); }
  }, [profilePage, profileStatusFilter, profileSearch, profileSortActive, profileSortDir, profileUpdatedSortActive, profileUpdatedSortDir, country]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const result = await adminApi.getRegisteredCompanies({
        page: pendingPage, limit: 20,
        status: pendingStatusFilter === 'all' ? undefined : pendingStatusFilter,
        search: pendingSearch || undefined,
        sort_by: pendingSortActive ? 'project_count' : 'pending_projects',
        sort_dir: pendingSortActive ? pendingSortDir : undefined,
        country,
      });
      setPendingProfiles(result.companies);
      setPendingTotal(result.total);
      if (pendingStatusFilter === 'pending' && !pendingSearch) {
        setPendingBadgeTotal(result.total);
      }
    } catch (err: any) { setError(err.message); }
    finally { setPendingLoading(false); }
  }, [pendingPage, pendingStatusFilter, pendingSearch, pendingSortActive, pendingSortDir, country]);

  const loadCompanies = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const result = await adminApi.getCompanies({
        page: companyPage, limit: 20,
        claimed: claimedFilter === 'all' ? undefined : claimedFilter,
        search: companySearch || undefined,
        sort_by: directorySortActive ? 'project_count' : undefined,
        sort_dir: directorySortActive ? directorySortDir : undefined,
        country,
      });
      setCompanies(result.companies);
      setCompanyTotal(result.pagination.total);
      if (claimedFilter === 'all' && !companySearch) {
        setDirectoryBadgeTotal(result.pagination.total);
      }
      directoryLoaded.current = true;
    } catch (err: any) { setError(err.message); }
    finally {
      directoryLoaded.current = true;
      setCompanyLoading(false);
    }
  }, [companyPage, claimedFilter, companySearch, directorySortActive, directorySortDir, country]);

  const loadTabBadges = useCallback(async () => {
    const [profilesRes, pendingRes, directoryRes] = await Promise.allSettled([
      adminApi.getRegisteredCompanies({ page: 1, limit: 1, country }),
      adminApi.getRegisteredCompanies({ page: 1, limit: 1, status: 'pending', country }),
      adminApi.getCompanies({ page: 1, limit: 1, country }),
    ]);
    if (profilesRes.status === 'fulfilled') setProfileBadgeTotal(profilesRes.value.total || 0);
    if (pendingRes.status === 'fulfilled') setPendingBadgeTotal(pendingRes.value.total || 0);
    if (directoryRes.status === 'fulfilled') setDirectoryBadgeTotal(directoryRes.value.pagination?.total || 0);
  }, [country]);

  const fetchHomeOrderCount = useCallback(async () => {
    try {
      const result = await adminApi.getHomeOrderCount();
      setHomeOrderCount(result.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchHomeOrderCount(); }, [fetchHomeOrderCount]);
  useEffect(() => { if (tab === 'companies') loadProfiles(); }, [tab, loadProfiles]);
  useEffect(() => { if (tab === 'applications') loadPending(); }, [tab, loadPending]);
  useEffect(() => { if (tab === 'directory') loadCompanies(); }, [tab, loadCompanies]);
  useEffect(() => { loadTabBadges(); }, [loadTabBadges, tab]);

  useEffect(() => {
    router.replace(`/admin/companies?tab=${tab}`);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setProfilePage(1);
    setProfileSearch('');
    setProfileStatusFilter('all');
    setProfileSortActive(true);
    setProfileSortDir('desc');
    setPendingPage(1);
    setPendingSearch('');
    setPendingStatusFilter('pending');
    setPendingSortActive(true);
    setPendingSortDir('desc');
    setCompanyPage(1);
    setCompanySearch('');
    setClaimedFilter('all');
    setDirectorySortActive(false);
  }, [tab]);

  useEffect(() => {
    setProfilePage(1);
    setPendingPage(1);
    setCompanyPage(1);
  }, [country]);

  const handleBind = async () => {
    if (!bindCompanyId || !bindUserId) return;
    setBindSubmitting(true);
    try {
      await adminApi.bindUserToCompany(bindCompanyId, parseInt(bindUserId));
      setBindCompanyId(null);
      setBindUserId('');
      loadCompanies();
    } catch (err: any) { alert(err.message); }
    finally { setBindSubmitting(false); }
  };

  const handleSetProfileHomeOrder = async (id: number, value: number) => {
    if (value > 0 && homeOrderCount >= 6) {
      alert('首页最多展示 6 家公司，请先移除一家');
      return;
    }
    setOrderSavingId(id);
    try {
      await adminApi.updateCompanyProfileHomeDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, home_display_order: value } : p)));
      await fetchHomeOrderCount();
    } catch (err: any) { alert(err.message || 'Failed to update.'); }
    finally { setOrderSavingId(null); }
  };

  const handleSetProfileListOrder = async (id: number, value: number) => {
    setOrderSavingId(id);
    try {
      await adminApi.updateCompanyProfileListDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, list_display_order: value } : p)));
    } catch (err: any) { alert(err.message || 'Failed to update.'); }
    finally { setOrderSavingId(null); }
  };

  const handleDeleteProfile = async (profile: CompanyProfileRecord, reason?: string) => {
    const finalReason = reason?.trim() || window.prompt(`Delete company "${profile.company_name}"\nPlease enter delete reason:`, '')?.trim();
    if (!finalReason) return;
    try {
      await adminApi.deleteCompanyProfile(profile.id, finalReason);
      await loadProfiles();
      await loadTabBadges();
    } catch (err: any) { alert(err.message || 'Failed to delete.'); }
  };

  const handleSetDirectoryHomeOrder = async (id: number, value: number) => {
    if (value > 0 && homeOrderCount >= 6) {
      alert('首页最多展示 6 家公司，请先移除一家');
      return;
    }
    setDirectoryOrderSavingKey(`home-${id}`);
    try {
      await adminApi.updateDirectoryHomeDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, home_display_order: value } : c)));
      await fetchHomeOrderCount();
    } catch (err: any) { alert(err.message || 'Failed to update.'); }
    finally { setDirectoryOrderSavingKey(null); }
  };

  const handleSetDirectoryListOrder = async (id: number, value: number) => {
    setDirectoryOrderSavingKey(`list-${id}`);
    try {
      await adminApi.updateDirectoryListDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, list_display_order: value } : c)));
    } catch (err: any) { alert(err.message || 'Failed to update.'); }
    finally { setDirectoryOrderSavingKey(null); }
  };

  const toggleSort = (
    active: boolean,
    setActive: (v: boolean) => void,
    dir: SortDir,
    setDir: (v: SortDir) => void,
    setPageFn: (v: number) => void,
  ) => {
    if (active) {
      if (dir === 'desc') { setDir('asc'); }
      else { setActive(false); }
    } else {
      setActive(true);
      setDir('desc');
    }
    setPageFn(1);
  };

  const [newAppCount, setNewAppCount] = useState(0);
  const [pendingProjectsHint, setPendingProjectsHint] = useState<{ companies: number; projects: number } | null>(null);
  useEffect(() => {
    adminApi.getNotificationCounts().then(d => {
      setNewAppCount(d.newCompanyApps || 0);
      const c = d.pendingProjectCompanies || 0;
      const p = d.pendingProjectCount || 0;
      setPendingProjectsHint(c > 0 ? { companies: c, projects: p } : null);
    }).catch(() => {});
  }, [tab]);
  const hasNewApplications = newAppCount > 0;

  const activeSearch = tab === 'companies' ? profileSearch : tab === 'directory' ? companySearch : pendingSearch;
  const setActiveSearch = (val: string) => {
    if (tab === 'companies') { setProfileSearch(val); setProfilePage(1); }
    else if (tab === 'directory') { setCompanySearch(val); setCompanyPage(1); }
    else { setPendingSearch(val); setPendingPage(1); }
  };

  return (
    <div className="space-y-4">
      <BackToAnalytics />
      <h1 className="text-xl font-bold text-[#2c2c2c]">Companies</h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {([
          { key: 'companies' as Tab, label: 'Companies', count: profileBadgeTotal, dot: false, hint: null as string | null },
          { key: 'directory' as Tab, label: 'Directory', count: directoryBadgeTotal, dot: false, hint: null as string | null },
          { key: 'applications' as Tab, label: 'Applications', count: pendingBadgeTotal, dot: hasNewApplications, hint: pendingProjectsHint ? `${pendingProjectsHint.companies}个装企上传了${pendingProjectsHint.projects}个项目，待审核` : null },
        ]).map(({ key, label, count, dot, hint }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === 'applications') {
                adminApi.markNotificationSeen('companies').then(() => setNewAppCount(0)).catch(() => {});
              }
            }}
            className={`relative rounded-xl border p-3 text-left transition ${
              tab === key ? 'bg-[#b8864a] border-[#b8864a] shadow-md' : 'bg-white border-stone-200 hover:border-[#b8864a]/40'
            }`}
          >
            {dot && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />}
            <p className={`text-[26px] sm:text-[30px] font-bold leading-none mb-1 ${tab === key ? 'text-white' : 'text-stone-800'}`}>
              {count}
            </p>
            <p className={`text-[10px] sm:text-[11px] font-medium leading-tight ${tab === key ? 'text-white/75' : 'text-stone-400'}`}>
              {label}
            </p>
            {hint && (
              <p className={`text-[10px] leading-tight mt-1 ${tab === key ? 'text-white' : 'text-stone-500'}`}>
                {hint}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search companies..."
            value={activeSearch}
            onChange={(e) => setActiveSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a]"
          />
        </div>
        <div className="hidden md:block flex-1" />
        <div className="w-32 flex-shrink-0">
          {tab === 'companies' && (
            <AdminSelect size="sm" value={profileStatusFilter}
              onChange={(val) => { setProfileStatusFilter(val as ProfileStatusFilter); setProfilePage(1); }}
              options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]}
            />
          )}
          {tab === 'directory' && (
            <AdminSelect size="sm" value={claimedFilter}
              onChange={(val) => { setClaimedFilter(val as ClaimedFilter); setCompanyPage(1); }}
              options={[{ value: 'all', label: 'All' }, { value: 'claimed', label: 'Claimed' }, { value: 'unclaimed', label: 'Unclaimed' }]}
            />
          )}
          {tab === 'applications' && (
            <AdminSelect size="sm" value={pendingStatusFilter}
              onChange={(val) => { setPendingStatusFilter(val as ProfileStatusFilter); setPendingPage(1); }}
              options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]}
            />
          )}
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {tab === 'companies' && (
        <AdminCompaniesTableTab
          profiles={profiles}
          loading={profileLoading}
          total={profileTotal}
          page={profilePage}
          onPageChange={setProfilePage}
          onDelete={handleDeleteProfile}
          onSetHomeOrder={handleSetProfileHomeOrder}
          onSetListOrder={handleSetProfileListOrder}
          orderSavingId={orderSavingId}
          sortDir={profileSortDir}
          sortActive={profileSortActive}
          onSortToggle={() => toggleSort(profileSortActive, setProfileSortActive, profileSortDir, setProfileSortDir, setProfilePage)}
          updatedSortDir={profileUpdatedSortDir}
          updatedSortActive={profileUpdatedSortActive}
          onUpdatedSortToggle={() => toggleSort(profileUpdatedSortActive, setProfileUpdatedSortActive, profileUpdatedSortDir, setProfileUpdatedSortDir, setProfilePage)}
          onToggleSigned={async (id, isSigned) => {
            try {
              await adminApi.toggleCompanySigned(id, isSigned);
              setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_signed: isSigned } : p));
            } catch (err: any) {
              alert(err.message || 'Failed to update signed status.');
            }
          }}
          onBulkUnapprove={async (ids) => {
            try {
              await adminApi.bulkUnapproveCompanies(ids);
              await loadProfiles();
              await loadTabBadges();
            } catch (err: any) {
              alert(err.message || 'Failed to unapprove.');
            }
          }}
        />
      )}

      {tab === 'directory' && (
        <AdminDirectoryTable
          companies={companies}
          loading={companyLoading}
          total={companyTotal}
          page={companyPage}
          onPageChange={setCompanyPage}
          onSetHomeOrder={handleSetDirectoryHomeOrder}
          onSetListOrder={handleSetDirectoryListOrder}
          orderSavingKey={directoryOrderSavingKey}
          sortDir={directorySortDir}
          sortActive={directorySortActive}
          onSortToggle={() => toggleSort(directorySortActive, setDirectorySortActive, directorySortDir, setDirectorySortDir, setCompanyPage)}
        />
      )}

      {tab === 'applications' && (
        <AdminApplicationsTable
          profiles={pendingProfiles}
          loading={pendingLoading}
          total={pendingTotal}
          page={pendingPage}
          onPageChange={setPendingPage}
          onDelete={async (profile, reason?) => {
            const finalReason = reason?.trim() || window.prompt(`Delete "${profile.company_name}"\nPlease enter delete reason:`, '')?.trim();
            if (!finalReason) return;
            try {
              await adminApi.deleteCompanyProfile(profile.id, finalReason);
              await loadPending();
              await loadTabBadges();
            } catch (err: any) { alert(err.message || 'Failed to delete.'); }
          }}
          sortDir={pendingSortDir}
          sortActive={pendingSortActive}
          onSortToggle={() => toggleSort(pendingSortActive, setPendingSortActive, pendingSortDir, setPendingSortDir, setPendingPage)}
        />
      )}

      {editId && (
        <CompanyEditModal
          type={editId.type}
          id={editId.id}
          onClose={() => setEditId(null)}
          onSaved={() => loadCompanies()}
        />
      )}

      {bindCompanyId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBindCompanyId(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Bind User to Company</h2>
            <p className="text-sm text-stone-500">
              #{bindCompanyId} — {companies.find(c => c.id === bindCompanyId)?.name_en}
            </p>
            <input
              type="number"
              value={bindUserId}
              onChange={(e) => setBindUserId(e.target.value)}
              placeholder="User ID"
              className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBindCompanyId(null)} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
              <button
                onClick={handleBind}
                disabled={!bindUserId || bindSubmitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >Bind</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
