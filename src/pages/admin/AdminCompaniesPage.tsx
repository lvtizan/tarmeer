import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { TableSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import HoverDeleteIconButton from '../../components/ui/HoverDeleteIconButton';

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
}

const PROFILE_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-stone-300 ml-1">↕</span>;
  return <span className="ml-1">{dir === 'desc' ? '↓' : '↑'}</span>;
}

export default function AdminCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'directory') return 'directory';
    if (t === 'applications') return 'applications';
    return 'companies';
  });

  // Companies tab state (company_profiles)
  const [profiles, setProfiles] = useState<CompanyProfileRecord[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profilePage, setProfilePage] = useState(1);
  const [profileStatusFilter, setProfileStatusFilter] = useState<ProfileStatusFilter>('all');
  const [profileSearch, setProfileSearch] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [orderSavingId, setOrderSavingId] = useState<number | null>(null);
  const [profileDeleteLoadingId, setProfileDeleteLoadingId] = useState<number | null>(null);
  const [directoryOrderSavingKey, setDirectoryOrderSavingKey] = useState<string | null>(null);
  const [profileSortDir, setProfileSortDir] = useState<SortDir>('desc');
  const [profileSortActive, setProfileSortActive] = useState(false);
  const [profileBadgeTotal, setProfileBadgeTotal] = useState(0);

  // Applications tab state (pending company_profiles)
  const [pendingProfiles, setPendingProfiles] = useState<CompanyProfileRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingBadgeTotal, setPendingBadgeTotal] = useState(0);

  // Directory tab state (uae_companies)
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [companyPage, setCompanyPage] = useState(1);
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>('all');
  const [companySearch, setCompanySearch] = useState('');
  const [companyLoading, setCompanyLoading] = useState(false);
  const [directorySortDir, setDirectorySortDir] = useState<SortDir>('desc');
  const [directorySortActive, setDirectorySortActive] = useState(false);
  const directoryLoaded = useRef(false);
  const [directoryBadgeTotal, setDirectoryBadgeTotal] = useState(0);

  const [actionLoading, setActionLoading] = useState<number | null>(null);
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
      });
      setProfiles(result.companies);
      setProfileTotal(result.total);
      if (profileStatusFilter === 'all' && !profileSearch) {
        setProfileBadgeTotal(result.total);
      }
    } catch (err: any) { setError(err.message); }
    finally { setProfileLoading(false); }
  }, [profilePage, profileStatusFilter, profileSearch]); // keeps old data while reloading

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const result = await adminApi.getRegisteredCompanies({
        page: pendingPage, limit: 20,
        status: 'pending',
      });
      setPendingProfiles(result.companies);
      setPendingTotal(result.total);
      setPendingBadgeTotal(result.total);
    } catch (err: any) { setError(err.message); }
    finally { setPendingLoading(false); }
  }, [pendingPage]);

  const loadCompanies = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const result = await adminApi.getCompanies({
        page: companyPage, limit: 20,
        claimed: claimedFilter === 'all' ? undefined : claimedFilter,
        search: companySearch || undefined,
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
  }, [companyPage, claimedFilter, companySearch]); // keeps old data while reloading

  const loadTabBadges = useCallback(async () => {
    const [profilesRes, pendingRes, directoryRes] = await Promise.allSettled([
      adminApi.getRegisteredCompanies({ page: 1, limit: 1 }),
      adminApi.getRegisteredCompanies({ page: 1, limit: 1, status: 'pending' }),
      adminApi.getCompanies({ page: 1, limit: 1 }),
    ]);

    if (profilesRes.status === 'fulfilled') {
      setProfileBadgeTotal(profilesRes.value.total || 0);
    }
    if (pendingRes.status === 'fulfilled') {
      setPendingBadgeTotal(pendingRes.value.total || 0);
    }
    if (directoryRes.status === 'fulfilled') {
      setDirectoryBadgeTotal(directoryRes.value.pagination?.total || 0);
    }
  }, []);

  useEffect(() => { if (tab === 'companies') loadProfiles(); }, [tab, loadProfiles]);
  useEffect(() => { if (tab === 'applications') loadPending(); }, [tab, loadPending]);
  useEffect(() => { if (tab === 'directory') loadCompanies(); }, [tab, loadCompanies]);
  useEffect(() => { loadTabBadges(); }, [loadTabBadges, tab]);
  useEffect(() => { setSearchParams({ tab }, { replace: true }); }, [tab, setSearchParams]);
  useEffect(() => {
    setProfilePage(1);
    setProfileSearch('');
    setProfileStatusFilter('all');
    setProfileSortActive(false);
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

  const handleUnbind = async (companyId: number) => {
    if (!confirm('Unbind this company from its owner?')) return;
    setActionLoading(companyId);
    try {
      await adminApi.unbindCompany(companyId);
      loadCompanies();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleSetProfileHomeOrder = async (id: number, value: number) => {
    setOrderSavingId(id);
    try {
      await adminApi.updateCompanyProfileHomeDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, home_display_order: value } : p)));
    } catch (err: any) {
      alert(err.message || 'Failed to update home display order.');
    } finally {
      setOrderSavingId(null);
    }
  };

  const handleSetProfileListOrder = async (id: number, value: number) => {
    setOrderSavingId(id);
    try {
      await adminApi.updateCompanyProfileListDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, list_display_order: value } : p)));
    } catch (err: any) {
      alert(err.message || 'Failed to update list display order.');
    } finally {
      setOrderSavingId(null);
    }
  };

  const handleDeleteProfile = async (profile: CompanyProfileRecord) => {
    const reason = window.prompt(`Delete company "${profile.company_name}"\nPlease enter delete reason / 请输入删除原因：`, '');
    if (!reason || !reason.trim()) return;
    setProfileDeleteLoadingId(profile.id);
    try {
      await adminApi.deleteCompanyProfile(profile.id, reason.trim());
      await loadProfiles();
      await loadTabBadges();
    } catch (err: any) {
      alert(err.message || 'Failed to delete company profile.');
    } finally {
      setProfileDeleteLoadingId(null);
    }
  };

  const handleSetDirectoryHomeOrder = async (id: number, value: number) => {
    const key = `home-${id}`;
    setDirectoryOrderSavingKey(key);
    try {
      await adminApi.updateDirectoryHomeDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, home_display_order: value } : c)));
    } catch (err: any) {
      alert(err.message || 'Failed to update home display order.');
    } finally {
      setDirectoryOrderSavingKey(null);
    }
  };

  const handleSetDirectoryListOrder = async (id: number, value: number) => {
    const key = `list-${id}`;
    setDirectoryOrderSavingKey(key);
    try {
      await adminApi.updateDirectoryListDisplayOrder(id, Number.isFinite(value) ? value : 0);
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, list_display_order: value } : c)));
    } catch (err: any) {
      alert(err.message || 'Failed to update list display order.');
    } finally {
      setDirectoryOrderSavingKey(null);
    }
  };

  const sortedProfiles = profileSortActive
    ? [...profiles].sort((a, b) => profileSortDir === 'desc' ? b.project_count - a.project_count : a.project_count - b.project_count)
    : profiles;

  const sortedDirectory = directorySortActive
    ? [...companies].sort((a, b) => directorySortDir === 'desc' ? b.project_count - a.project_count : a.project_count - b.project_count)
    : companies;

  const profilePages = Math.ceil(profileTotal / 20);
  const pendingPages = Math.ceil(pendingTotal / 20);
  const companyPages = Math.ceil(companyTotal / 20);
  const hasNewApplications = pendingBadgeTotal > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Companies</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 w-fit">
        {([
          ['companies', `Companies (${profileBadgeTotal})`],
          ['directory', `Directory (${directoryBadgeTotal})`],
          ['applications', `Applications (${pendingBadgeTotal})`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
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

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* ── Companies Tab ── */}
      {tab === 'companies' && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
              <select
                value={profileStatusFilter}
                onChange={(e) => { setProfileStatusFilter(e.target.value as ProfileStatusFilter); setProfilePage(1); }}
                className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-stone-500 mb-1">Search</label>
              <input
                type="text" value={profileSearch}
                onChange={(e) => { setProfileSearch(e.target.value); setProfilePage(1); }}
                placeholder="Company name, email..."
                className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
              />
            </div>
            <div className="text-xs text-stone-500 self-end pb-1">{profileTotal} total</div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Owner</th>
                  <th
                    className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                    onClick={() => {
                      if (profileSortActive) {
                        setProfileSortDir(d => d === 'desc' ? 'asc' : 'desc');
                      } else {
                        setProfileSortActive(true);
                        setProfileSortDir('desc');
                      }
                    }}
                  >
                    Projects <SortIcon active={profileSortActive} dir={profileSortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Home Order</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">List Order</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Joined</th>
                </tr>
              </thead>
              <tbody>
                {profileLoading ? (
                  <TableSpinner colSpan={9} />
                ) : sortedProfiles.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-stone-400">No records</td></tr>
                ) : sortedProfiles.map((c) => (
                  <tr
                    key={c.id}
                    className="group border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => navigate(`/admin/profile-companies/${c.id}?tab=companies`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <SmartImage src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-stone-100" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-500">
                            {c.company_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-stone-800">{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.company_type === 'renovation_company' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {c.company_type === 'renovation_company' ? 'Company' : 'Studio'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-800 text-xs">{c.user_name}</div>
                      <div className="text-xs text-stone-400">{c.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-medium">{c.project_count}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PROFILE_STATUS_COLORS[c.status] || 'bg-stone-100 text-stone-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        defaultValue={Number(c.home_display_order || 0)}
                        onBlur={(e) => handleSetProfileHomeOrder(c.id, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                        className="w-16 h-8 px-2 border border-stone-200 rounded-md text-sm bg-white"
                      />
                      {orderSavingId === c.id && (
                        <span className="ml-2 text-xs text-stone-400">Saving...</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        defaultValue={Number(c.list_display_order || 0)}
                        onBlur={(e) => handleSetProfileListOrder(c.id, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                        className="w-16 h-8 px-2 border border-stone-200 rounded-md text-sm bg-white"
                      />
                    </td>
                    <td className="relative px-4 py-3 text-stone-500 text-xs">
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      <HoverDeleteIconButton
                        title="Delete company"
                        loading={profileDeleteLoadingId === c.id}
                        disabled={profileDeleteLoadingId === c.id}
                        onClick={(e) => { e.stopPropagation(); handleDeleteProfile(c); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {profilePages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
                <span className="text-xs text-stone-500">Page {profilePage} of {profilePages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setProfilePage(p => Math.max(1, p - 1))} disabled={profilePage <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
                  <button onClick={() => setProfilePage(p => Math.min(profilePages, p + 1))} disabled={profilePage >= profilePages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Directory Tab ── */}
      {tab === 'directory' && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
              <select
                value={claimedFilter}
                onChange={(e) => { setClaimedFilter(e.target.value as ClaimedFilter); setCompanyPage(1); }}
                className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
              >
                <option value="all">All</option>
                <option value="claimed">Claimed</option>
                <option value="unclaimed">Unclaimed</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-stone-500 mb-1">Search</label>
              <input
                type="text" value={companySearch}
                onChange={(e) => { setCompanySearch(e.target.value); setCompanyPage(1); }}
                placeholder="Company name..."
                className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Owner</th>
                  <th
                    className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                    onClick={() => {
                      if (directorySortActive) {
                        setDirectorySortDir(d => d === 'desc' ? 'asc' : 'desc');
                      } else {
                        setDirectorySortActive(true);
                        setDirectorySortDir('desc');
                      }
                    }}
                  >
                    Projects <SortIcon active={directorySortActive} dir={directorySortDir} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Home Order</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">List Order</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyLoading ? (
                  <TableSpinner colSpan={7} />
                ) : !directoryLoaded.current ? (
                  <TableSpinner colSpan={7} />
                ) : sortedDirectory.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-stone-400">No records</td></tr>
                ) : sortedDirectory.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => navigate(`/admin/companies/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.logo_url && <SmartImage src={c.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-stone-100" />}
                        <div>
                          <div className="font-medium text-stone-800">{c.name_en}</div>
                          <div className="text-xs text-stone-400">{c.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
                    <td className="px-4 py-3">
                      {c.owner_user_id ? (
                        <div>
                          <span className="text-green-600 font-medium text-xs">Claimed</span>
                          <div className="text-xs text-stone-500">{c.owner_name} ({c.owner_email})</div>
                        </div>
                      ) : (
                        <span className="text-stone-400 text-xs">Unclaimed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-700 font-medium">{c.project_count}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        defaultValue={Number(c.home_display_order || 0)}
                        onBlur={(e) => handleSetDirectoryHomeOrder(c.id, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                        className="w-16 h-8 px-2 border border-stone-200 rounded-md text-sm bg-white"
                      />
                      {directoryOrderSavingKey === `home-${c.id}` && (
                        <span className="ml-2 text-xs text-stone-400">Saving...</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        defaultValue={Number(c.list_display_order || 0)}
                        onBlur={(e) => handleSetDirectoryListOrder(c.id, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                        className="w-16 h-8 px-2 border border-stone-200 rounded-md text-sm bg-white"
                      />
                      {directoryOrderSavingKey === `list-${c.id}` && (
                        <span className="ml-2 text-xs text-stone-400">Saving...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditId({ type: 'scraped', id: c.id })}
                        className="text-xs px-3 py-1 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200"
                      >
                        Edit
                      </button>
                      {c.owner_user_id ? (
                        <button
                          onClick={() => handleUnbind(c.id)}
                          disabled={actionLoading === c.id}
                          className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          {actionLoading === c.id ? '...' : 'Unbind'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setBindCompanyId(c.id)}
                          className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          Bind User
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {companyPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
                <span className="text-xs text-stone-500">Page {companyPage} of {companyPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCompanyPage(p => Math.max(1, p - 1))} disabled={companyPage <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
                  <button onClick={() => setCompanyPage(p => Math.min(companyPages, p + 1))} disabled={companyPage >= companyPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Applications Tab (pending company_profiles) ── */}
      {tab === 'applications' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Projects</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoading ? (
                <TableSpinner colSpan={6} />
              ) : pendingProfiles.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-stone-400">No pending applications</td></tr>
              ) : pendingProfiles.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                  onClick={() => navigate(`/admin/profile-companies/${c.id}?tab=applications`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <SmartImage src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-stone-100" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-600">
                          {c.company_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-stone-800">{c.company_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.company_type === 'renovation_company' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {c.company_type === 'renovation_company' ? 'Company' : 'Studio'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800 text-xs">{c.user_name}</div>
                    <div className="text-xs text-stone-400">{c.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-700 font-medium">{c.project_count}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
              <span className="text-xs text-stone-500">Page {pendingPage} of {pendingPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
                <button onClick={() => setPendingPage(p => Math.min(pendingPages, p + 1))} disabled={pendingPage >= pendingPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
              </div>
            </div>
          )}
        </div>
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
