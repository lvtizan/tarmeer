'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Inbox, Phone, MessageSquare, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface InquiryItem {
  id: number;
  name: string | null;
  phone: string;
  city: string | null;
  area_range: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Contacted', cls: 'bg-amber-100 text-amber-700' },
  resolved: { label: 'Resolved', cls: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', cls: 'bg-stone-100 text-stone-500' },
};

export default function CompanyInquiriesPage() {
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [revealedPhones, setRevealedPhones] = useState<Record<number, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((page = 1) => {
    setLoading(true);
    setError('');
    api.get(`/inquiries/mine?page=${page}&limit=20`)
      .then((d: unknown) => {
        const data = d as { inquiries?: InquiryItem[]; pagination?: Pagination } | null;
        setInquiries(data?.inquiries || []);
        if (data?.pagination) setPagination(data.pagination);
      })
      .catch(() => setError('Failed to load inquiries. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(1); }, [load]);

  const handleReveal = (inq: InquiryItem) => {
    if (revealedPhones[inq.id]) return;
    setRevealedPhones(prev => ({ ...prev, [inq.id]: inq.phone }));
  };

  const handleStatus = async (id: number, status: string) => {
    setUpdatingStatus(id);
    try {
      await api.patch(`/inquiries/${id}/my-status`, { status });
      setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, status } : inq));
    } catch { /* ignore */ }
    finally { setUpdatingStatus(null); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c] flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#b8864a]" />
            Inquiries Inbox
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {pagination.total > 0 ? `${pagination.total} inquiries total` : 'Messages from potential clients'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {inquiries.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b8864a]/10">
            <MessageSquare className="h-7 w-7 text-[#b8864a]" />
          </div>
          <p className="text-sm font-semibold text-stone-700">No inquiries yet</p>
          <p className="mt-1 text-xs text-stone-500">When clients contact you, their messages will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map(inq => {
            const statusInfo = STATUS_LABEL[inq.status] || STATUS_LABEL.new;
            const phone = revealedPhones[inq.id];
            return (
              <div key={inq.id} className={`bg-white rounded-xl border p-4 transition ${inq.status === 'new' ? 'border-blue-200' : 'border-stone-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-[#2c2c2c] text-sm">{inq.name || 'Anonymous'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {phone ? (
                          <span className="font-medium text-[#2c2c2c]">{phone}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReveal(inq)}
                            className="font-medium text-[#b8864a] hover:underline"
                          >
                            {maskPhone(inq.phone)} — click to reveal
                          </button>
                        )}
                      </span>
                      {inq.city && <span>{inq.city}</span>}
                      {inq.area_range && <span>{inq.area_range}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(inq.created_at)}
                      </span>
                    </div>

                    {inq.message && (
                      <p className="text-sm text-stone-600 bg-stone-50 rounded-lg px-3 py-2 leading-relaxed">
                        {inq.message}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <select
                      value={inq.status}
                      onChange={e => handleStatus(inq.id, e.target.value)}
                      disabled={updatingStatus === inq.id}
                      className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 disabled:opacity-50"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => load(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-stone-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => load(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
