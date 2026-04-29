import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/adminApi';
import { Spinner } from '../../components/ui/Spinner';
import { useAdminT } from '../../hooks/useAdminLang';
import AdminSelect from '../../components/ui/AdminSelect';
import { MapPin } from 'lucide-react';

interface VisitRecord {
  id: number;
  company_name: string;
  interviewer_name: string;
  linked_company_name: string | null;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
];

export default function AdminVisitRecordsPage() {
  const { t } = useAdminT();
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getInterviews();
      setRecords(data.interviews || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = records.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.company_name.toLowerCase().includes(q) ||
        r.interviewer_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <MapPin className="w-5 h-5 text-[#b8864a]" />
        <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Visit Records', '访谈记录')}</h1>
        <span className="text-sm text-stone-400">{records.length}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search company / staff…', '搜索公司 / 人员…')}
          className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
        />
        <AdminSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          className="w-36 h-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          {t('No records found.', '暂无记录。')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-medium text-stone-500">#</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Company', '公司')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Staff', '人员')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Status', '状态')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Submitted', '提交时间')}</th>
                <th className="px-4 py-3 font-medium text-stone-500">{t('Created', '创建时间')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-400">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#2c2c2c]">{r.company_name || '—'}</div>
                    {r.linked_company_name && r.linked_company_name !== r.company_name && (
                      <div className="text-xs text-stone-400 mt-0.5">→ {r.linked_company_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{r.interviewer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'submitted'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status === 'submitted' ? t('Submitted', '已提交') : t('Draft', '草稿')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(r.submitted_at)}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
