'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Phone, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

interface Inquiry {
  id: number;
  name: string;
  phone: string;
  city: string | null;
  area_range: string | null;
  message: string | null;
  created_at: string;
}

function timeAgo(iso: string, lang: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return lang === 'vi' ? 'vừa xong' : 'just now';
  if (diff < 3600) return lang === 'vi' ? `${Math.floor(diff / 60)} phút trước` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return lang === 'vi' ? `${Math.floor(diff / 3600)} giờ trước` : `${Math.floor(diff / 3600)}h ago`;
  return lang === 'vi' ? `${Math.floor(diff / 86400)} ngày trước` : `${Math.floor(diff / 86400)}d ago`;
}

export default function ExpertInquiriesPage() {
  const { lang } = useSiteLocale();
  const t = (en: string, vi: string) => (lang === 'vi' ? vi : en);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/experts/me/inquiries')
      .then((d: { inquiries?: Inquiry[] }) => setInquiries(d.inquiries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif text-[#1c1917]">{t('Inquiries', 'Tin nhắn')}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {t('Visitors who reached out through your profile', 'Khách hàng liên hệ qua trang hồ sơ của bạn')}
          </p>
        </div>
        {inquiries.length > 0 && (
          <span className="text-sm font-medium text-stone-500">{inquiries.length}</span>
        )}
      </div>

      {inquiries.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">
            {t('No inquiries yet', 'Chưa có tin nhắn nào')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(inq => {
            const expanded = expandedId === inq.id;
            return (
              <div
                key={inq.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : inq.id)}
                  className="w-full text-left px-5 py-4 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-[#b8864a]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-[#b8864a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#1c1917]">{inq.name}</span>
                      {inq.city && (
                        <span className="text-xs text-stone-400">{inq.city}</span>
                      )}
                      <span className="text-xs text-stone-400 flex items-center gap-1 ml-auto shrink-0">
                        <Clock className="w-3 h-3" />{timeAgo(inq.created_at, lang)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">
                      {inq.message || t('(no message)', '(không có tin nhắn)')}
                    </p>
                  </div>
                  <div className="shrink-0 text-stone-400 mt-0.5">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-stone-100 pt-4 space-y-3">
                    <a
                      href={`tel:${inq.phone}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:underline"
                    >
                      <Phone className="w-4 h-4" /> {inq.phone}
                    </a>
                    {inq.area_range && inq.area_range !== 'N/A' && (
                      <p className="text-xs text-stone-500">
                        {t('Area', 'Diện tích')}: {inq.area_range}
                      </p>
                    )}
                    {inq.message && (
                      <p className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">
                        {inq.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
