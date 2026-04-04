import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { PageSpinner, TableSpinner } from '../../components/ui/Spinner';

const AdminDesignersPage = lazy(() => import('./AdminDesignersPage'));

type Tab = 'companies' | 'studios' | 'applications';
type ClaimedFilter = 'all' | 'claimed' | 'unclaimed';
type AppStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type SortField = 'default' | 'project_count';
type SortDir = 'asc' | 'desc';

interface CompanyRecord {
  id: number;
  name_en: string;
  slug: string;
  city: string;
  logo_url: string | null;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  project_count: number;
}

interface ApplicationRecord {
  id: number;
  user_id: number;
  company_name: string;
  license_number: string | null;
  phone: string | null;
  city: string | null;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  linked_company_id: number | null;
  user_name: string;
  user_email: string;
  created_at: string;
}

export default function AdminCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'studios') return 'studios';
    if (t === 'applications') return 'applications';
    return 'companies';
  });

  // Companies state
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [companyPage, setCompanyPage] = useState(1);
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>('all');
  const [companySearch, setCompanySearch] = useState('');
  const [companyLoading, setCompanyLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Applications state
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [appPage, setAppPage] = useState(1);
  const [appStatusFilter, setAppStatusFilter] = useState<AppStatusFilter>('all');
  const [appLoading, setAppLoading] = useState(true);

  // Review modal
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Bind modal
  const [bindCompanyId, setBindCompanyId] = useState<number | null>(null);
  const [bindUserId, setBindUserId] = useState('');
  const [bindSubmitting, setBindSubmitting] = useState(false);

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<{ type: 'scraped' | 'profile'; id: number } | null>(null);

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
    } catch (err: any) { setError(err.message); }
    finally { setCompanyLoading(false); }
  }, [companyPage, claimedFilter, companySearch]);

  const loadApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const result = await adminApi.getCompanyApplications({
        page: appPage, limit: 20,
        status: appStatusFilter === 'all' ? undefined : appStatusFilter,
      });
      setApplications(result.applications);
      setAppTotal(result.pagination.total);
    } catch (err: any) { setError(err.message); }
    finally { setAppLoading(false); }
  }, [appPage, appStatusFilter]);

  useEffect(() => { if (tab === 'companies') loadCompanies(); }, [tab, loadCompanies]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, loadApplications]);

  useEffect(() => {
    setSearchParams({ tab }, { replace: true });
  }, [tab, setSearchParams]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!reviewApp) return;
    setReviewSubmitting(true);
    try {
      await adminApi.reviewCompanyApplication(reviewApp.id, { status, admin_notes: reviewNotes || undefined });
      setReviewApp(null);
      setReviewNotes('');
      loadApplications();
    } catch (err: any) { alert(err.message); }
    finally { setReviewSubmitting(false); }
  };

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

  const companyPages = Math.ceil(companyTotal / 20);
  const appPages = Math.ceil(appTotal / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Companies</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('companies')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'companies' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Companies ({companyTotal})
        </button>
        <button
          onClick={() => setTab('studios')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'studios' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Studios
        </button>
        <button
          onClick={() => setTab('applications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'applications' ? 'bg-white shadow text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Applications ({appTotal})
        </button>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Studios Tab — self-registered studios/designers (sortable by project count) */}
      {tab === 'studios' && (
        <Suspense fallback={<PageSpinner />}>
          <AdminDesignersPage />
        </Suspense>
      )}

      {/* Companies Tab — scraped UAE company directory */}
      {tab === 'companies' && (
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
                      if (sortField === 'project_count') {
                        setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortField('project_count');
                        setSortDir('desc');
                      }
                    }}
                  >
                    Projects {sortField === 'project_count' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyLoading ? (
                  <TableSpinner colSpan={5} />
                ) : (sortField === 'project_count'
                    ? [...companies].sort((a, b) => sortDir === 'desc' ? b.project_count - a.project_count : a.project_count - b.project_count)
                    : companies
                  ).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => navigate(`/admin/companies/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.logo_url && <img src={c.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-stone-100" />}
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
                  <button onClick={() => setCompanyPage(Math.max(1, companyPage - 1))} disabled={companyPage <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
                  <button onClick={() => setCompanyPage(Math.min(companyPages, companyPage + 1))} disabled={companyPage >= companyPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Applications Tab */}
      {tab === 'applications' && (
        <>
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
              <select
                value={appStatusFilter}
                onChange={(e) => { setAppStatusFilter(e.target.value as AppStatusFilter); setAppPage(1); }}
                className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Applicant</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Company Name</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appLoading ? (
                  <TableSpinner colSpan={6} />
                ) : applications.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-stone-400">No applications</td></tr>
                ) : applications.map((app) => (
                  <tr key={app.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-800">{app.user_name}</div>
                      <div className="text-xs text-stone-400">{app.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{app.company_name}</td>
                    <td className="px-4 py-3 text-stone-600">{app.city || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        app.status === 'approved' ? 'bg-green-100 text-green-700' :
                        app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{app.status}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {app.status === 'pending' && (
                        <button
                          onClick={() => { setReviewApp(app); setReviewNotes(''); }}
                          className="text-xs px-3 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {appPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
                <span className="text-xs text-stone-500">Page {appPage} of {appPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setAppPage(Math.max(1, appPage - 1))} disabled={appPage <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
                  <button onClick={() => setAppPage(Math.min(appPages, appPage + 1))} disabled={appPage >= appPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Modal */}
      {reviewApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setReviewApp(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Review Application</h2>
            <div className="text-sm space-y-2">
              <p><span className="text-stone-500">Applicant:</span> {reviewApp.user_name} ({reviewApp.user_email})</p>
              <p><span className="text-stone-500">Company:</span> {reviewApp.company_name}</p>
              <p><span className="text-stone-500">License:</span> {reviewApp.license_number || '—'}</p>
              <p><span className="text-stone-500">City:</span> {reviewApp.city || '—'}</p>
              {reviewApp.description && <p><span className="text-stone-500">Description:</span> {reviewApp.description}</p>}
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Admin notes..."
              rows={3}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setReviewApp(null)} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">Cancel</button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={reviewSubmitting}
                className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >Reject</button>
              <button
                onClick={() => handleReview('approved')}
                disabled={reviewSubmitting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <CompanyEditModal
          type={editId.type}
          id={editId.id}
          onClose={() => setEditId(null)}
          onSaved={() => { loadCompanies(); loadApplications(); }}
        />
      )}

      {/* Bind Modal */}
      {bindCompanyId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBindCompanyId(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Bind User to Company</h2>
            <p className="text-sm text-stone-500">
              Company ID: #{bindCompanyId} — {companies.find(c => c.id === bindCompanyId)?.name_en}
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
