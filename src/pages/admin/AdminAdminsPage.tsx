import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/adminApi';

interface Admin {
  id: number;
  email: string;
  full_name: string;
  role: string;
  permissions: {
    can_approve?: boolean;
    can_sort?: boolean;
    can_view_stats?: boolean;
  } | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    email: '',
    password: '',
    fullName: '',
    permissions: {
      can_approve: false,
      can_sort: false,
      can_view_stats: true,
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const result = await adminApi.getAdmins();
      setAdmins(result.admins);
    } catch (err) {
      console.error('Error loading admins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    
    if (!createData.email || !createData.password || !createData.fullName) {
      setError('All fields are required');
      return;
    }

    if (createData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.createSubAdmin({
        email: createData.email,
        password: createData.password,
        fullName: createData.fullName,
        permissions: createData.permissions,
      });
      setShowCreateModal(false);
      setCreateData({
        email: '',
        password: '',
        fullName: '',
        permissions: {
          can_approve: false,
          can_sort: false,
          can_view_stats: true,
        },
      });
      await loadAdmins();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: Admin) => {
    const action = admin.is_active ? 'deactivate' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${admin.full_name}?`)) {
      return;
    }

    try {
      await adminApi.updateAdmin(admin.id, { isActive: !admin.is_active });
      await loadAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`Delete admin "${admin.full_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await adminApi.deleteAdmin(admin.id);
      await loadAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2c2c2c]">Admin Users</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#b8864a] text-white rounded-lg text-sm hover:bg-[#a67c47] transition-colors"
        >
          Create Sub-Admin
        </button>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Admin</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Permissions</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Last Login</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-[#2c2c2c]">{admin.full_name}</p>
                    <p className="text-sm text-stone-500">{admin.email}</p>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    admin.role === 'super_admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {admin.role === 'super_admin' ? 'Super Admin' : 'Sub Admin'}
                  </span>
                </td>
                <td className="py-4 px-4">
                  {admin.permissions ? (
                    <div className="flex flex-wrap gap-1">
                      {admin.permissions.can_approve && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Approve</span>
                      )}
                      {admin.permissions.can_sort && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Sort</span>
                      )}
                      {admin.permissions.can_view_stats && (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-700 text-xs rounded">Stats</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-stone-400 text-sm">All permissions</span>
                  )}
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    admin.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {admin.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-4 px-4 text-sm text-stone-500">
                  {formatDate(admin.last_login)}
                </td>
                <td className="py-4 px-4 text-right">
                  {admin.role !== 'super_admin' && (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggleActive(admin)}
                        className={`px-3 py-1.5 text-sm rounded ${
                          admin.is_active
                            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {admin.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-4">
              Create Sub-Admin
            </h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={createData.fullName}
                  onChange={(e) => setCreateData({ ...createData, fullName: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createData.permissions.can_approve}
                      onChange={(e) => setCreateData({
                        ...createData,
                        permissions: { ...createData.permissions, can_approve: e.target.checked }
                      })}
                      className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                    <span className="text-sm">Can approve/reject designers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createData.permissions.can_sort}
                      onChange={(e) => setCreateData({
                        ...createData,
                        permissions: { ...createData.permissions, can_sort: e.target.checked }
                      })}
                      className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                    <span className="text-sm">Can change display order</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createData.permissions.can_view_stats}
                      onChange={(e) => setCreateData({
                        ...createData,
                        permissions: { ...createData.permissions, can_view_stats: e.target.checked }
                      })}
                      className="w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                    />
                    <span className="text-sm">Can view statistics</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#b8864a] text-white rounded-lg hover:bg-[#a67c47] disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
