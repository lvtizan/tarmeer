'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import AdminSelect from '@/components/ui/AdminSelect';
import { EMIRATES } from '@/lib/adminConstants';

interface Props {
  id: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function UserEditModal({ id, onClose, onSaved }: Props) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await adminApi.getUserDetail(id);
        setData((result as { user?: Record<string, unknown> }).user || {});
      } catch (err: unknown) {
        setError((err instanceof Error ? err.message : null) || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.editUser(id, {
        full_name: data.full_name as string,
        email: data.email as string,
        phone: data.phone as string,
        city: data.city as string,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : null) || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: unknown) => setData(prev => ({ ...prev, [key]: val }));

  const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a]";
  const labelCls = "block text-xs font-medium text-stone-500 mb-1";

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-stone-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-stone-900">Edit User</h2>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div>
            <label className={labelCls}>Full Name</label>
            <input className={inputCls} value={(data.full_name as string) || ''} onChange={e => set('full_name', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={(data.email as string) || ''} onChange={e => set('email', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={(data.phone as string) || ''} onChange={e => set('phone', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>City</label>
            <AdminSelect
              value={(data.city as string) || ''}
              onChange={(val) => set('city', val)}
              options={[
                { value: '', label: 'Select' },
                ...EMIRATES.map(c => ({ value: c, label: c })),
              ]}
              className="w-full"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
