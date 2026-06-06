'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { useAdminT } from '@/hooks/useAdminLang';
import { UserCheck, Plus, X } from 'lucide-react';
import PasswordInput from '@/components/admin/PasswordInput';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface StaffMember {
  id: number;
  email: string;
  full_name: string;
  is_active: number;
  created_at: string;
  last_login: string | null;
  submitted_count: number;
}

export default function AdminStaffPage() {
  const { t } = useAdminT();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', password: '' });
  const [formError, setFormError] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getStaff();
      setStaff(data.staff || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleToggle = async (id: number, currentActive: number) => {
    const next = currentActive ? 0 : 1;
    try {
      await adminApi.toggleStaff(id, Boolean(next));
      setStaff(list => list.map(s => s.id === id ? { ...s, is_active: next } : s));
      showToast(next ? t('Staff activated', '已启用') : t('Staff deactivated', '已停用'), 'success');
    } catch {
      showToast(t('Failed to update', '更新失败'), 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.email || !form.fullName || !form.password) {
      setFormError(t('All fields required.', '所有字段必填。'));
      return;
    }
    if (form.password.length < 8) {
      setFormError(t('Password must be at least 8 characters.', '密码至少 8 位。'));
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createStaff({ email: form.email, fullName: form.fullName, password: form.password });
      showToast(t('Staff created', '人员已创建'), 'success');
      setForm({ email: '', fullName: '', password: '' });
      setShowForm(false);
      fetchStaff();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('Failed to create', '创建失败'));
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-[#b8864a]" />
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Field Staff', '外勤人员')}</h1>
          <span className="text-sm text-stone-400">{staff.length}</span>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setFormError(''); }}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] transition-colors"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? t('Cancel', '取消') : t('Add Staff', '新增人员')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">{t('New Field Staff Account', '新建外勤账号')}</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{t('Full Name', '姓名')}</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] focus:bg-white"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">{t('Email', '邮箱')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] focus:bg-white"
                  placeholder="staff@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Password', '密码')}</label>
              <PasswordInput
                id="new-staff-password"
                value={form.password}
                onChange={v => setForm(f => ({ ...f, password: v }))}
                placeholder={t('Min. 8 characters', '至少 8 位')}
                required
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="h-9 px-4 rounded-lg bg-[#b8864a] text-white text-sm font-medium hover:bg-[#a67c47] transition-colors disabled:opacity-50"
              >
                {submitting ? t('Creating…', '创建中…') : t('Create Account', '创建账号')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          {t('No field staff yet. Add one above.', '暂无外勤人员，请点击上方新增。')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-medium text-stone-500">{t('Name', '姓名')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden sm:table-cell">{t('Email', '邮箱')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden md:table-cell">{t('Joined', '加入时间')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">{t('Last Login', '最后登录')}</th>
                <th className="px-4 py-3 font-medium text-stone-500 text-right">{t('Submitted', '提交公司')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Status', '状态')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#2c2c2c]">{s.full_name}</div>
                    <div className="text-xs text-stone-400 sm:hidden">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{s.email}</td>
                  <td className={`px-4 py-3 hidden md:table-cell ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(s.created_at)}</td>
                  <td className={`px-4 py-3 hidden lg:table-cell ${ADMIN_TIME_CLS}`}>
                    {s.last_login ? formatAdminDateTime(s.last_login) : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.submitted_count > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-semibold bg-[#f5f0e8] text-[#b8864a]">
                        {s.submitted_count}
                      </span>
                    ) : (
                      <span className="text-stone-300 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {s.is_active ? t('Active', '启用') : t('Inactive', '停用')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggle(s.id, s.is_active)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors min-h-[36px]"
                    >
                      {s.is_active ? t('Deactivate', '停用') : t('Activate', '启用')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
