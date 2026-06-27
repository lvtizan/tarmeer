'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { useAdminT } from '@/hooks/useAdminLang';
import { formatAdminDateTime } from '@/lib/formatTime';
import { ArrowLeft, MessageSquare, User, Clock, Tag, Send } from 'lucide-react';

interface FeedbackDetail {
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

interface FeedbackReply {
  id: number;
  feedback_id: number;
  sender: 'admin' | 'user';
  content: string;
  created_at: string;
}

const SOURCE_LABEL: Record<string, string> = {
  footer: '网站底部 / Website Footer',
  company_portal: '装企后台 / Company Portal',
  website: '官网 / Website',
};

export default function AdminFeedbackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useAdminT();
  const [item, setItem] = useState<FeedbackDetail | null>(null);
  const [companyHref, setCompanyHref] = useState<string | null>(null);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi.request(`/feedback/${id}`)
      .then((res) => {
        setItem(res.feedback);
        setReplies(res.replies || []);
        if (res.company_profile_id) setCompanyHref(`/admin/profile-companies/${res.company_profile_id}`);
        else if (res.company_directory_id) setCompanyHref(`/admin/companies/${res.company_directory_id}`);
        else setCompanyHref(null);
      })
      .catch(() => { setError('Failed to load feedback.'); })
      .finally(() => { setLoading(false); });
  }, [id]);

  const sendReply = async () => {
    const content = replyText.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await adminApi.request(`/feedback/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) });
      setReplies(res.replies || []);
      setReplyText('');
    } catch {
      setError(t('Failed to send reply.', '回复发送失败。'));
    } finally {
      setSending(false);
    }
  };

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
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition">
          <ArrowLeft className="w-4 h-4" />
          {t('Back', '返回')}
        </button>
        <p className="text-red-500 text-sm">{error || t('Not found', '未找到')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/admin/feedback')}
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
        {(item.user_name || item.user_email || item.company_name) && (
          <div className="px-6 pb-6">
            <div className="flex items-start gap-3 bg-stone-50 rounded-xl p-4 border border-stone-100">
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-stone-500" />
              </div>
              <div className="min-w-0">
                {item.company_name && (
                  <div className="flex items-center gap-2 mb-1">
                    {companyHref ? (
                      <button onClick={() => router.push(companyHref)} className="text-sm font-semibold text-[#b8864a] hover:underline text-left transition" title={t('Open company detail', '打开公司详情')}>
                        {item.company_name}
                      </button>
                    ) : (
                      <p className="text-sm font-semibold text-[#2c2c2c]">{item.company_name}</p>
                    )}
                    {item.company_type && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                        {item.company_type}
                      </span>
                    )}
                  </div>
                )}
                {item.user_name && <p className="text-sm text-stone-600">{item.user_name}</p>}
                {item.user_email && <p className="text-xs text-stone-500 mt-0.5">{item.user_email}</p>}
                {item.user_id && <p className="text-xs text-stone-400 mt-0.5">User ID: {item.user_id}</p>}
              </div>
            </div>
          </div>
        )}
        {/* 对话线程 — 卡片内,顶部分隔线区分原文 */}
        {replies.length > 0 && (
          <div className="px-6 py-5 space-y-3 border-t border-stone-100">
            {replies.map((r) => (
              <div key={r.id} className={`flex ${r.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${r.sender === 'admin' ? 'bg-[#b8864a] text-white rounded-br-sm' : 'bg-stone-100 text-[#2c2c2c] rounded-bl-sm'}`}>
                  <div className="text-[11px] opacity-70 mb-0.5">
                    {r.sender === 'admin' ? t('Us', '我们') : (item.user_name || item.company_name || t('User', '用户'))} · {formatAdminDateTime(r.created_at)}
                  </div>
                  {r.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 回复框 — 卡片内,顶部分隔线;空内容时发送灰色 */}
        <div className="border-t border-stone-100 p-6">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            placeholder={t('Type a reply to the user…', '回复用户…')}
            className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-[#2c2c2c] outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/20 placeholder:text-stone-400"
          />
          <div className="flex justify-end mt-2.5">
            <button
              onClick={sendReply}
              disabled={!replyText.trim() || sending}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition ${replyText.trim() && !sending ? 'bg-[#b8864a] text-white hover:bg-[#a07640]' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}
            >
              <Send className="w-4 h-4" />
              {sending ? t('Sending…', '发送中…') : t('Send Reply', '发送回复')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
