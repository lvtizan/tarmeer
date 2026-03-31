import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface Inquiry {
  id: number;
  name: string;
  phone: string;
  city: string;
  area_range: string;
  message: string | null;
  status: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  archived: 'bg-stone-100 text-stone-500',
};

export default function MyInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const token = api.getToken();
    fetch(`${API_BASE}/inquiries/mine?page=${page}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setInquiries(data.inquiries || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Received Inquiries</h1>

      {loading ? (
        <div className="py-20 text-center text-stone-400">Loading...</div>
      ) : inquiries.length === 0 ? (
        <div className="py-20 text-center text-stone-400">No inquiries yet.</div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <div key={inq.id} className="bg-white rounded-xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-stone-800">{inq.name}</h3>
                  <p className="text-sm text-stone-500">{inq.phone} · {inq.city} · {inq.area_range}</p>
                  {inq.message && <p className="text-sm text-stone-600 mt-2">{inq.message}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inq.status] || 'bg-stone-100 text-stone-500'}`}>
                    {inq.status}
                  </span>
                  <div className="text-xs text-stone-400 mt-1">{new Date(inq.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
              <span className="px-3 py-1 text-xs text-stone-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
