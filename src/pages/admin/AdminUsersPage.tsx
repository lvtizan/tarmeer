import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Pencil, Shield, X, Trash2, Ban, CircleCheck } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { TableSpinner } from '../../components/ui/Spinner';
import CopyButton from '../../components/ui/CopyButton';
import UserEditModal from '../../components/admin/UserEditModal';
import DeleteReasonModal from '../../components/admin/DeleteReasonModal';
import AdminRowActions from '../../components/admin/AdminRowActions';
import { useAdminT } from '../../hooks/useAdminLang';

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

function PermissionModal({ user, onClose, onSaved }: { user: UserRecord; onClose: () => void; onSaved: () => void }) {
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

  const roleLabel = user.role === 'user' ? '业主' : user.role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-[#b8864a]" />
              <h2 className="text-xl font-bold text-stone-800">Permissions</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">{user.full_name}</span>
              <span>{roleLabel}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition mt-0.5">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
          ) : (
            AVAILABLE_PERMISSIONS.map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked.has(key)}
                  onChange={() => toggle(key)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-[#b8864a] cursor-pointer"
                />
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-stone-800 group-hover:text-[#b8864a] transition">{label}</span>
                  <span className="block text-xs text-stone-400">{desc}</span>
                </span>
              </label>
            ))
          )}
          {error && <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">{error}</div>}
        </div>
        <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-stone-100">
          <button onClick={onClose} className="flex-1 h-10 rounded-2xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex-1 h-10 rounded-2xl bg-[#b8864a] hover:bg-[#a07540] text-white text-sm font-medium transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { t } = useAdminT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [search] = useState(() => searchParams.get('search') || '');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; names: string[] } | null>(null);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [registeredSort, setRegisteredSort] = useState<'asc' | 'desc' | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getUsers({ page, limit: 20, search: search || undefined });
      setUsers(result.users);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, search, setSearchParams]);

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

  const handleDeleteUser = (user: UserRecord) => {
    setDeleteModal({ ids: [user.id], names: [user.full_name] });
  };

  const handleBulkDeleteClick = () => {
    const selected = users.filter((u) => selectedIds.has(u.id));
    setDeleteModal({ ids: selected.map((u) => u.id), names: selected.map((u) => u.full_name) });
  };

  const handleDeleteConfirm = async (reason: string) => {
    if (!deleteModal) return;
    setBulkDeleteLoading(true);
    try {
      for (const id of deleteModal.ids) {
        setDeleteLoadingId(id);
        await adminApi.deleteUser(id, reason);
      }
      setSelectedIds(new Set());
      setDeleteModal(null);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setDeleteLoadingId(null);
      setBulkDeleteLoading(false);
    }
  };

  const sortedUsers = registeredSort
    ? [...users].sort((a, b) => {
        const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return registeredSort === 'asc' ? d : -d;
      })
    : users;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800">Users</h1>
        <span className="text-sm text-stone-500">{total} total</span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-4 h-11">
          <span className="text-sm text-stone-500">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDeleteClick}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 transition"
          >
            <Trash2 size={14} /> Delete ({selectedIds.size})
          </button>
        </div>
      )}

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-sm">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && users.every((u) => selectedIds.has(u.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(users.map((u) => u.id)));
                      else setSelectedIds(new Set());
                    }}
                    className="h-4 w-4 rounded border-stone-300 accent-[#b8864a] cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Phone</th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                  onClick={() => setRegisteredSort(s => s === 'desc' ? 'asc' : 'desc')}
                >
                  Registered {registeredSort === 'asc' ? '↑' : registeredSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSpinner colSpan={7} />
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-stone-400">No users found</td></tr>
              ) : sortedUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition ${selectedIds.has(user.id) ? 'bg-amber-50/40' : ''}`}
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                >
                  <td className="px-4 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(user.id); else next.delete(user.id);
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-stone-300 accent-[#b8864a] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 font-medium text-stone-800">
                      <span>{user.full_name}</span>
                      <CopyButton text={user.full_name} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-stone-500">{user.city || <span className="text-stone-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-stone-600">{user.email}</td>
                  <td className="px-4 py-3.5 text-stone-600">{user.phone || <span className="text-stone-300">—</span>}</td>
                  <td className="px-4 py-3.5 text-stone-500 text-sm">
                    <div>{new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {new Date(user.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <AdminRowActions actions={[
                      {
                        icon: <Pencil size={14} />,
                        label: t('Edit', '编辑'),
                        onClick: (e) => { e.stopPropagation(); setEditUserId(user.id); },
                      },
                      {
                        icon: <Shield size={14} />,
                        label: t('Permissions', '权限'),
                        onClick: (e) => { e.stopPropagation(); setPermissionUser(user); },
                      },
                      {
                        icon: user.status === 'active' ? <Ban size={14} /> : <CircleCheck size={14} />,
                        label: user.status === 'active' ? t('Suspend', '停用') : t('Activate', '启用'),
                        variant: user.status === 'active' ? 'warning' : 'success',
                        disabled: actionLoading === user.id,
                        onClick: (e) => { e.stopPropagation(); handleStatusToggle(user); },
                      },
                      {
                        icon: <Trash2 size={14} />,
                        label: t('Delete', '删除'),
                        variant: 'danger',
                        disabled: deleteLoadingId === user.id,
                        onClick: (e) => { e.stopPropagation(); handleDeleteUser(user); },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {editUserId && (
        <UserEditModal id={editUserId} onClose={() => setEditUserId(null)} onSaved={() => loadUsers()} />
      )}

      {permissionUser && (
        <PermissionModal user={permissionUser} onClose={() => setPermissionUser(null)} onSaved={() => loadUsers()} />
      )}

      {deleteModal && (
        <DeleteReasonModal
          names={deleteModal.names}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModal(null)}
          loading={bulkDeleteLoading}
        />
      )}
    </div>
  );
}
