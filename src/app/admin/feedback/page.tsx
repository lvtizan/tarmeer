'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { PageSpinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import { truncateText } from '@/lib/textUtils';
import AdminPagination from '@/components/admin/AdminPagination';
import { MessageSquare, CheckCheck } from 'lucide-react';

interface FeedbackRecord {
  id: number;
  title: string;
  content: string;
  source: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  company_name: string | null;
  company_type: string | null;
  is_read: 0 | 1;
  created_at: string;
}



const SOURCE_LABEL: Record<string, string> = {
  footer: '网站底部',
  company_portal: '装企后台',
  website: '官网',
};

export default function AdminFeedbackPage() {
  const { t } = useAdminT();
  const router = useRouter();
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [markingRead, setMarkingRead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.request(`/feedback?page=${page}&limit=20`);
      setItems(res.feedback || []);
      setTotal(res.pagination?.total || 0);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      await adminApi.request('/feedback/mark-all-read', { method: 'PUT' });
      setUnreadCount(0);
      setItems(prev => prev.map(it => ({ ...it, is_read: 1 as const })));
    } catch {
      // ignore
    } finally {
      setMarkingRead(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#b8864a]" />
            {t('Feedback', '用户反馈')}
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px]">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {t(`${total} total`, `共 ${total} 条`)}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingRead}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            {t('Mark all read', '全部已读')}
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">{t('No feedback yet', '暂无反馈')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="divide-y divide-stone-100">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/admin/feedback/${item.id}`)}
                className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-stone-50 transition ${!item.is_read ? 'bg-amber-50/30' : ''}`}
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  {item.is_read ? (
                    <div className="w-2 h-2 rounded-full bg-stone-200" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-sm font-semibold ${item.is_read ? 'text-stone-700' : 'text-[#1c1917]'}`}>
                      {item.title}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 shrink-0">
                      {SOURCE_LABEL[item.source] || item.source}
                    </span>
                    {item.company_name && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 shrink-0 font-medium">
                        {item.company_name}
                      </span>
                    )}
                    {item.company_type && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-50 text-stone-500 border border-stone-100 shrink-0">
                        {item.company_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    {truncateText(item.content, 100)}
                  </p>
                  {item.user_name && (
                    <p className="text-xs text-stone-400 mt-1">{item.user_name}{item.user_email ? ` · ${item.user_email}` : ''}</p>
                  )}
                </div>

                <span className={`${ADMIN_TIME_CLS} shrink-0 text-right`}>
                  {formatAdminDateTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        labels={[t('Prev', '上一页'), t('Next', '下一页')]}
        formatInfo={(p, tp) => `${p} / ${tp}`}
      />
    </div>
  );
}
