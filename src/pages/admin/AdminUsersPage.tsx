import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Pencil, Shield, Home, Building2, X } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { TableSpinner } from '../../components/ui/Spinner';
import HoverDeleteIconButton from '../../components/ui/HoverDeleteIconButton';
import UserEditModal from '../../components/admin/UserEditModal';

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

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
};

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_projects', label: 'Manage Projects', desc: 'Can create, edit and delete projects' },
  { key: 'manage_company', label: 'Manage Company', desc: 'Can edit company profile' },
  { key: 'view_analytics', label: 'View Analytics', desc: 'Can view analytics data' },
  { key: 'manage_inquiries', label: 'Manage Inquiries', desc: 'Can view and respond to inquiries' },
  { key: 'manage_users', label: 'Manage Users', desc: 'Can manage other users (admin only)' },
  { key: 'import_companies', label: 'Import Companies', desc: 'Can import companies' },
  { key: 'manage_complaints', label: 'Manage Complaints', desc: 'Can handle complaints' },
  { key: 'export_data', label: 'Export Data', desc: 'Can export data' },
];

// ── Permission Modal ────────────────────────────────────────────────────────

interface PermissionModalProps {
  user: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}

function PermissionModal({ user, onClose, onSaved }: PermissionModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getUserPermissions(user.id)
      .then(({ permissions }) => setChecked(new Set(permissions)))
      .catch((e) => setError(e.message || 'Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [user.id]);

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.updateUserPermissions(user.id, Array.from(checked));
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = user.role === 'company' ? '公司' : user.role === 'user' ? '业主' : user.role;
  const RoleIcon = user.role === 'company' ? Building2 : user.role === 'user' ? Home : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-[#b8864a]" />
              <h2 className="text-xl font-bold text-stone-800">Permissions</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">{user.full_name}</span>
              {RoleIcon && <RoleIcon size={13} className="text-stone-400" />}
              <span>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition mt-0.5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
          ) : (
            AVAILABLE_PERMISSIONS.map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={checked.has(key)}
                  onChange={() => toggle(key)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-[#b8864a] cursor-pointer"
                />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-stone-800 group-hover:text-[#b8864a] transition">
                    {label}
                  </span>
                  <span className="block text-xs text-stone-400">{desc}</span>
                </span>
              </label>
            ))
          )}
          {error && <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-2xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 h-10 rounded-2xl bg-[#b8864a] hover:bg-[#a07540] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
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
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserRecord | null>(null);

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

  const handleDeleteUser = async (user: UserRecord) => {
    const reason = window.prompt(`Delete user "${user.full_name}"\nPlease enter delete reason / 请输入删除原因：`, '');
    if (!reason || !reason.trim()) return;
    setDeleteLoadingId(user.id);
    try {
      await adminApi.deleteUser(user.id, reason.trim());
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setDeleteLoadingId(null);
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
                <TableSpinner colSpan={6} />
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-stone-400">No users found</td></tr>
              ) : users.map((user) => (
                <tr
                  key={user.id}
                  className="group border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-800">{user.full_name}</div>
                    {user.city && <div className="text-xs text-stone-400">{user.city}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role === 'user' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                        <Home size={11} /> 业主
                      </span>
                    ) : user.role === 'company' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Building2 size={11} /> 公司
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#b8864a]/10 text-[#b8864a]">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="relative px-4 py-3 text-stone-500 text-xs">
                    <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    <HoverDeleteIconButton
                      title="Delete user"
                      loading={deleteLoadingId === user.id}
                      disabled={deleteLoadingId === user.id}
                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
                    />
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditUserId(user.id); }}
                      className="text-xs px-3 py-1 rounded-lg font-medium transition bg-stone-50 text-stone-600 hover:bg-stone-100 flex items-center gap-1"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPermissionUser(user); }}
                      className="text-xs px-3 py-1 rounded-lg font-medium transition bg-stone-50 text-stone-600 hover:bg-stone-100 flex items-center gap-1"
                      title="Manage permissions"
                    >
                      <Shield size={12} /> Permissions
                    </button>
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

      {editUserId && (
        <UserEditModal
          id={editUserId}
          onClose={() => setEditUserId(null)}
          onSaved={() => loadUsers()}
        />
      )}

      {permissionUser && (
        <PermissionModal
          user={permissionUser}
          onClose={() => setPermissionUser(null)}
          onSaved={() => loadUsers()}
        />
      )}
    </div>
  );
}
