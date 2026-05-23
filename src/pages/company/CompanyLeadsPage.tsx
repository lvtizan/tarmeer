// src/pages/company/CompanyLeadsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { Inbox, Phone, MapPin, Clock, CheckCircle2, Circle, Star } from 'lucide-react';
import { api } from '../../lib/api';

interface Inquiry {
  id: number;
  name: string | null;
  phone: string;
  city: string | null;
  area_range: string;
  message: string | null;
  status: 'new' | 'contacted' | 'resolved';
  created_at: string;
}

type FilterTab = 'all' | 'new' | 'contacted' | 'resolved';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_CONFIG = {
  new:       { label: 'New',       color: 'bg-stone-100 text-stone-600',  icon: Circle },
  contacted: { label: 'Contacted', color: 'bg-blue-50 text-blue-700',     icon: CheckCircle2 },
  resolved:  { label: 'Converted', color: 'bg-green-50 text-green-700',   icon: Star },
} as const;

const STATUS_CYCLE: Record<Inquiry['status'], Inquiry['status']> = {
  new: 'contacted',
  contacted: 'resolved',
  resolved: 'new',
};

function LeadCard({ inquiry, onStatusChange }: { inquiry: Inquiry; onStatusChange: (id: number, status: Inquiry['status']) => void }) {
  const [updating, setUpdating] = useState(false);
  const cfg = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG.new;
  const Icon = cfg.icon;

  const handleStatusClick = async () => {
    if (updating) return;
    const next = STATUS_CYCLE[inquiry.status];
    setUpdating(true);
    try {
      await api.request(`/inquiries/${inquiry.id}/my-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(inquiry.id, next);
    } catch {
      // silent — keep current status
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col gap-3">
      {/* Header row: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#2c2c2c]">{inquiry.name || 'Anonymous'}</p>
          <a
            href={`tel:${inquiry.phone}`}
            className="flex items-center gap-1 text-[13px] text-[#b8864a] hover:underline mt-0.5"
          >
            <Phone className="w-3.5 h-3.5" />
            {inquiry.phone}
          </a>
        </div>
        <button
          onClick={handleStatusClick}
          disabled={updating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition shrink-0 ${cfg.color} ${updating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
          title="Click to change status"
          aria-label={`Status: ${cfg.label}. Click to change.`}
        >
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </button>
      </div>

      {/* Meta: city + area */}
      {(inquiry.city || inquiry.area_range) && (
        <div className="flex items-center gap-1 text-[13px] text-stone-500">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {[inquiry.city, inquiry.area_range].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Message — full display, no truncation */}
      {inquiry.message && (
        <p className="text-[14px] text-stone-700 leading-relaxed bg-stone-50 rounded-xl px-4 py-3">
          {inquiry.message}
        </p>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-1 text-[12px] text-stone-400">
        <Clock className="w-3.5 h-3.5" />
        {timeAgo(inquiry.created_at)}
      </div>
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'new',       label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'resolved',  label: 'Converted' },
];

export default function CompanyLeadsPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<FilterTab>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res: any = await api.get('/inquiries/mine?limit=100');
      setInquiries(res.inquiries ?? []);
    } catch {
      setInquiries([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (id: number, status: Inquiry['status']) => {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const filtered = tab === 'all' ? inquiries : inquiries.filter(i => i.status === tab);
  const newCount = inquiries.filter(i => i.status === 'new').length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">Leads</h1>
        <p className="text-sm text-stone-500 mt-1">
          Homeowner inquiries submitted through your company page.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key
                ? 'bg-[#b8864a] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t.label}
            {t.key === 'new' && newCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[11px] rounded-full px-1.5 py-0.5">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {!loading && loadError ? (
        <div className="text-center py-8 text-stone-500 text-sm">
          Failed to load leads. <button onClick={load} className="text-[#b8864a] underline">Try again</button>
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Loading leads…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">
            {tab === 'all'
              ? 'No leads yet. Once homeowners submit inquiries on your company page, they will appear here.'
              : `No ${TABS.find(t => t.key === tab)?.label ?? tab} leads.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(inq => (
            <LeadCard key={inq.id} inquiry={inq} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
