import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { formatAdminDateTime } from '../../lib/formatTime';
import { ArrowLeft, MessageSquare, User, Clock, Tag } from 'lucide-react';

interface FeedbackDetail {
  id: number;
  title: string;
  content: string;
  source: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  is_read: 0 | 1;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  footer: '网站底部 / Website Footer',
  company_portal: '装企后台 / Company Portal',
  website: '官网 / Website',
};

export default function AdminFeedbackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useAdminT();
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi.request(`/feedback/${id}`)
      .then((res) => { setItem(res.feedback); })
      .catch(() => { setError('Failed to load feedback.'); })
      .finally(() => { setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-20 text-stone-400">
        {t('Loading...', '加载中...')}
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition">
          <ArrowLeft className="w-4 h-4" />
          {t('Back', '返回')}
        </button>
        <p className="text-red-500 text-sm">{error || t('Not found', '未找到')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/feedback')}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('Back to Feedback', '返回反馈列表')}
      </button>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1c1917] px-6 py-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-serif text-lg font-medium leading-snug">{item.title}</h1>
            <div className="flex items-center gap-3 mt-1.5 text-white/60 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatAdminDateTime(item.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {SOURCE_LABEL[item.source] || item.source}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-[15px] text-[#2c2c2c] leading-relaxed whitespace-pre-wrap">{item.content}</p>
        </div>

        {/* Sender info */}
        {(item.user_name || item.user_email) && (
          <div className="px-6 pb-6">
            <div className="flex items-start gap-3 bg-stone-50 rounded-xl p-4 border border-stone-100">
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-stone-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#2c2c2c]">{item.user_name || t('Anonymous', '匿名')}</p>
                {item.user_email && <p className="text-xs text-stone-500 mt-0.5">{item.user_email}</p>}
                {item.user_id && <p className="text-xs text-stone-400 mt-0.5">User ID: {item.user_id}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
