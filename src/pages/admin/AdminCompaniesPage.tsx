import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import AdminCompaniesTableTab from '../../components/admin/AdminCompaniesTableTab';
import AdminDirectoryTable from '../../components/admin/AdminDirectoryTable';
import AdminApplicationsTable from '../../components/admin/AdminApplicationsTable';
import AdminSelect from '../../components/ui/AdminSelect';

type Tab = 'companies' | 'directory' | 'applications';
type ClaimedFilter = 'all' | 'claimed' | 'unclaimed';
type ProfileStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type SortDir = 'asc' | 'desc';

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

export default function AdminCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
      });
      setProfiles(result.companies);
      setProfileTotal(result.total);
      if (profileStatusFilter === 'all' && !profileSearch) {
        setProfileBadgeTotal(result.total);
      }
    } catch (err: any) { setError(err.message); }
    finally { setProfileLoading(false); }
  }, [profilePage, profileStatusFilter, profileSearch, profileSortActive, profileSortDir, profileUpdatedSortActive, profileUpdatedSortDir]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const result = await adminApi.getRegisteredCompanies({
        page: pendingPage, limit: 20,
        status: pendingStatusFilter === 'all' ? undefined : pendingStatusFilter,
        search: pendingSearch || undefined,
        sort_by: pendingSortActive ? 'project_count' : undefined,
        sort_dir: pendingSortActive ? pendingSortDir : undefined,
      });
      setPendingProfiles(result.companies);
      setPendingTotal(result.total);
      if (pendingStatusFilter === 'pending' && !pendingSearch) {
        setPendingBadgeTotal(result.total);
      }
    } catch (err: any) { setError(err.message); }
    finally { setPendingLoading(false); }
  }, [pendingPage, pendingStatusFilter, pendingSearch, pendingSortActive, pendingSortDir]);

  const loadCompanies = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const result = await adminApi.getCompanies({
        page: companyPage, limit: 20,
        claimed: claimedFilter === 'all' ? undefined : claimedFilter,
        search: companySearch || undefined,
        sort_by: directorySortActive ? 'project_count' : undefined,
        sort_dir: directorySortActive ? directorySortDir : undefined,
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
  }, [companyPage, claimedFilter, companySearch, directorySortActive, directorySortDir]);

  const loadTabBadges = useCallback(async () => {
    const [profilesRes, pendingRes, directoryRes] = await Promise.allSettled([
      adminApi.getRegisteredCompanies({ page: 1, limit: 1 }),
      adminApi.getRegisteredCompanies({ page: 1, limit: 1, status: 'pending' }),
      adminApi.getCompanies({ page: 1, limit: 1 }),
    ]);
    if (profilesRes.status === 'fulfilled') setProfileBadgeTotal(profilesRes.value.total || 0);
    if (pendingRes.status === 'fulfilled') setPendingBadgeTotal(pendingRes.value.total || 0);
    if (directoryRes.status === 'fulfilled') setDirectoryBadgeTotal(directoryRes.value.pagination?.total || 0);
  }, []);

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
  useEffect(() => { setSearchParams({ tab }, { replace: true }); }, [tab, setSearchParams]);
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
    const finalReason = reason?.trim() || window.prompt(`Delete company "${profile.company_name}"\nPlease enter delete reason / 请输入删除原因：`, '')?.trim();
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
    setPage: (v: number) => void,
  ) => {
    if (active) {
      if (dir === 'desc') {
        setDir('asc');
      } else {
        setActive(false);
      }
    } else {
      setActive(true);
      setDir('desc');
    }
    setPage(1);
  };

  const [newAppCount, setNewAppCount] = useState(0);
  useEffect(() => {
    adminApi.getNotificationCounts().then(d => setNewAppCount(d.newCompanyApps || 0)).catch(() => {});
  }, [tab]);
  const hasNewApplications = newAppCount > 0;

  // Unified search value for the active tab
  const activeSearch = tab === 'companies' ? profileSearch : tab === 'directory' ? companySearch : pendingSearch;
  const setActiveSearch = (val: string) => {
    if (tab === 'companies') { setProfileSearch(val); setProfilePage(1); }
    else if (tab === 'directory') { setCompanySearch(val); setCompanyPage(1); }
    else { setPendingSearch(val); setPendingPage(1); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-[#2c2c2c]">Companies</h1>

      {/* PC: tabs + search + filter in one row  |  Mobile: tabs row, then search+filter row */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1 shrink-0">
          {([
            ['companies', `Companies (${profileBadgeTotal})`],
            ['directory', `Directory (${directoryBadgeTotal})`],
            ['applications', `Applications (${pendingBadgeTotal})`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === 'applications') {
                  adminApi.markNotificationSeen('companies').then(() => setNewAppCount(0)).catch(() => {});
                }
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <span className="relative inline-flex items-start">
                {label}
                {t === 'applications' && hasNewApplications && (
                  <span className="absolute -top-0.5 -right-2.5 inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Search — full width on mobile (basis-full), flex-1 on PC */}
        <input
          type="text"
          value={activeSearch}
          onChange={(e) => setActiveSearch(e.target.value)}
          placeholder="Search..."
          className="basis-full sm:basis-auto sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />

        {/* Filter dropdown */}
        <div className="w-36 shrink-0">
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

      {/* ── Companies Tab ── */}
      {tab === 'companies' && (
        <>
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
        </>
      )}

      {/* ── Directory Tab ── */}
      {tab === 'directory' && (
        <>
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
        </>
      )}

      {/* ── Applications Tab ── */}
      {tab === 'applications' && (
        <>
          <AdminApplicationsTable
            profiles={pendingProfiles}
            loading={pendingLoading}
            total={pendingTotal}
            page={pendingPage}
            onPageChange={setPendingPage}
            onDelete={async (profile, reason?) => {
              const finalReason = reason?.trim() || window.prompt(`Delete "${profile.company_name}"\nPlease enter delete reason / 请输入删除原因：`, '')?.trim();
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
        </>
      )}

      {/* Edit Modal */}
      {editId && (
        <CompanyEditModal
          type={editId.type}
          id={editId.id}
          onClose={() => setEditId(null)}
          onSaved={() => loadCompanies()}
        />
      )}

      {/* Bind Modal */}
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
