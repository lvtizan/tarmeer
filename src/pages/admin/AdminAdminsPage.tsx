import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAdminT } from '../../hooks/useAdminLang';

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
  const { t } = useAdminT();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPermissionsAdmin, setEditPermissionsAdmin] = useState<Admin | null>(null);
  const [editPermissions, setEditPermissions] = useState({ can_approve: false, can_sort: false, can_view_stats: false });
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permError, setPermError] = useState('');
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

  const openPermissions = (admin: Admin) => {
    setEditPermissionsAdmin(admin);
    setEditPermissions({
      can_approve: !!admin.permissions?.can_approve,
      can_sort: !!admin.permissions?.can_sort,
      can_view_stats: !!admin.permissions?.can_view_stats,
    });
    setPermError('');
  };

  const savePermissions = async () => {
    if (!editPermissionsAdmin) return;
    setSavingPermissions(true);
    setPermError('');
    try {
      await adminApi.updateAdmin(editPermissionsAdmin.id, { permissions: editPermissions });
      setEditPermissionsAdmin(null);
      await loadAdmins();
    } catch (err: any) {
      setPermError(err.message || 'Failed to update permissions.');
    } finally {
      setSavingPermissions(false);
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
    if (!dateStr) return t('Never', '从未');
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <PageSpinner />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#2c2c2c]">{t('Admin Users', '管理员用户')}</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#b8864a] text-white rounded-lg text-sm hover:bg-[#a67c47] transition-colors"
        >
          {t('Create Sub-Admin', '创建子管理员')}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Admin', '管理员')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Role', '角色')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Permissions', '权限')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Status', '状态')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">{t('Last Login', '最后登录')}</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">{t('Actions', '操作')}</th>
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
                    {admin.role === 'super_admin' ? t('Super Admin', '超级管理员') : t('Sub Admin', '子管理员')}
                  </span>
                </td>
                <td className="py-4 px-4">
                  {admin.role === 'super_admin' ? (
                    <span className="text-stone-400 text-sm">{t('All permissions', '全部权限')}</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {admin.permissions?.can_approve && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">{t('Approve', '审批')}</span>
                      )}
                      {admin.permissions?.can_sort && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{t('Sort', '排序')}</span>
                      )}
                      {admin.permissions?.can_view_stats && (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-700 text-xs rounded">{t('Stats', '统计')}</span>
                      )}
                      {!admin.permissions?.can_approve && !admin.permissions?.can_sort && !admin.permissions?.can_view_stats && (
                        <span className="text-stone-400 text-xs">{t('No permissions', '无权限')}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => openPermissions(admin)}
                        className="text-xs font-medium text-[#b8864a] hover:text-[#a67c47] underline underline-offset-2"
                      >
                        {t('Edit Permissions', '编辑权限')}
                      </button>
                    </div>
                  )}
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    admin.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {admin.is_active ? t('Active', '活跃') : t('Inactive', '已停用')}
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
                        {admin.is_active ? t('Deactivate', '停用') : t('Activate', '启用')}
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                      >
                        {t('Delete', '删除')}
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
              {t('Create Sub-Admin', '创建子管理员')}
            </h3>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  {t('Full Name', '姓名')}
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
                  {t('Email', '邮箱')}
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
                  {t('Password', '密码')}
                </label>
                <input
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
                  placeholder={t('Minimum 8 characters', '至少8个字符')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t('Permissions', '权限')}
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
                    <span className="text-sm">{t('Can approve/reject designers', '可审批/拒绝设计师')}</span>
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
                    <span className="text-sm">{t('Can change display order', '可修改展示顺序')}</span>
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
                    <span className="text-sm">{t('Can view statistics', '可查看统计')}</span>
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
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#b8864a] text-white rounded-lg hover:bg-[#a67c47] disabled:opacity-50"
              >
                {isSubmitting ? t('Creating...', '创建中...') : t('Create Admin', '创建管理员')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editPermissionsAdmin && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onMouseDown={() => setEditPermissionsAdmin(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[#2c2c2c] mb-1">{t('Edit Permissions', '编辑权限')}</h3>
            <p className="text-sm text-stone-500 mb-5">
              {editPermissionsAdmin.full_name} · {editPermissionsAdmin.email}
            </p>

            {permError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
                {permError}
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPermissions.can_approve}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_approve: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                />
                <div>
                  <div className="text-[15px] font-medium text-[#2c2c2c]">{t('Approval Permission', '审批权限')}</div>
                  <div className="text-[12px] text-stone-500">{t('Approve/reject designers and company applications', '审批/拒绝设计师和公司申请')}</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPermissions.can_sort}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_sort: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                />
                <div>
                  <div className="text-[15px] font-medium text-[#2c2c2c]">{t('Sort Permission', '排序权限')}</div>
                  <div className="text-[12px] text-stone-500">{t('Change homepage and list display order', '修改首页和列表展示顺序')}</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editPermissions.can_view_stats}
                  onChange={(e) => setEditPermissions({ ...editPermissions, can_view_stats: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-[#b8864a] focus:ring-[#b8864a]"
                />
                <div>
                  <div className="text-[15px] font-medium text-[#2c2c2c]">{t('View Statistics', '查看统计')}</div>
                  <div className="text-[12px] text-stone-500">{t('View analytics and report pages', '查看数据分析和报表页面')}</div>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditPermissionsAdmin(null)}
                className="h-11 px-4 text-stone-600 hover:text-[#2c2c2c] text-[15px]"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={savePermissions}
                disabled={savingPermissions}
                className="h-11 px-5 bg-[#b8864a] text-white rounded-xl hover:bg-[#a67c47] disabled:opacity-50 text-[15px] font-medium"
              >
                {savingPermissions ? t('Saving...', '保存中...') : t('Save', '保存')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
