import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';

type RoleFilter = 'all' | 'user' | 'designer' | 'company';
type StatusFilter = 'all' | 'active' | 'suspended';

interface UserRecord {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  role: 'user' | 'designer' | 'company';
  status: 'active' | 'suspended';
  email_verified: boolean;
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  user: 'bg-stone-100 text-stone-700',
  designer: 'bg-amber-100 text-amber-800',
  company: 'bg-blue-100 text-blue-800',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
};

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(() => {
    const r = searchParams.get('role');
    return r === 'user' || r === 'designer' || r === 'company' ? r : 'all';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'active' || s === 'suspended' ? s : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Detail panel
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getUsers({
        page,
        limit: 20,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setUsers(result.users);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (roleFilter !== 'all') params.role = roleFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, roleFilter, statusFilter, search, setSearchParams]);

  const totalPages = Math.ceil(total / 20);

  const handleStatusToggle = async (user: UserRecord) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    setActionLoading(user.id);
    try {
      await adminApi.updateUserStatus(user.id, newStatus);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetail = async (userId: number) => {
    setDetailLoading(true);
    try {
      const data = await adminApi.getUserDetail(userId);
      setSelectedUser(data);
    } catch {
      setSelectedUser(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Users</h1>
        <span className="text-sm text-stone-500">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as RoleFilter); setPage(1); }}
            className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="designer">Designer</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="h-9 px-3 border border-stone-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-stone-500 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name or email..."
            className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
          />
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Registered</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-stone-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-stone-400">No users found</td></tr>
              ) : users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition"
                  onClick={() => handleViewDetail(user.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{user.full_name}</div>
                    {user.city && <div className="text-xs text-stone-400">{user.city}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusToggle(user); }}
                      disabled={actionLoading === user.id}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                        user.status === 'active'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      } disabled:opacity-50`}
                    >
                      {actionLoading === user.id ? '...' : user.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedUser && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800">
              {selectedUser.user.full_name}
            </h2>
            <button onClick={() => setSelectedUser(null)} className="text-stone-400 hover:text-stone-600 text-sm">
              Close
            </button>
          </div>
          {detailLoading ? (
            <div className="text-stone-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-stone-500">Email:</span>{' '}
                <span className="text-stone-800">{selectedUser.user.email}</span>
              </div>
              <div>
                <span className="text-stone-500">Phone:</span>{' '}
                <span className="text-stone-800">{selectedUser.user.phone || '—'}</span>
              </div>
              <div>
                <span className="text-stone-500">City:</span>{' '}
                <span className="text-stone-800">{selectedUser.user.city || '—'}</span>
              </div>
              <div>
                <span className="text-stone-500">Role:</span>{' '}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[selectedUser.user.role]}`}>
                  {selectedUser.user.role}
                </span>
              </div>
              {selectedUser.designer && (
                <div className="col-span-2 p-3 bg-amber-50 rounded-lg">
                  <span className="text-amber-800 font-medium">Linked Designer:</span>{' '}
                  ID #{selectedUser.designer.id}, status: {selectedUser.designer.status}
                </div>
              )}
              {selectedUser.company && (
                <div className="col-span-2 p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-800 font-medium">Linked Company:</span>{' '}
                  {selectedUser.company.slug} (ID #{selectedUser.company.id})
                </div>
              )}
              {selectedUser.companyApplications?.length > 0 && (
                <div className="col-span-2 p-3 bg-stone-50 rounded-lg">
                  <span className="text-stone-700 font-medium">Company Applications:</span>
                  <ul className="mt-1 space-y-1">
                    {selectedUser.companyApplications.map((app: any) => (
                      <li key={app.id} className="text-xs text-stone-600">
                        {app.company_name} — <span className={app.status === 'approved' ? 'text-green-600' : app.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}>{app.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
