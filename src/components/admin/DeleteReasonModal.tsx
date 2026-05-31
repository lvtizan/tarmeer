'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';

interface Props {
  names: string[];
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export default function DeleteReasonModal({ names, onConfirm, onCancel, loading }: Props) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 size={18} className="text-red-500" />
              <h2 className="text-xl font-bold text-stone-800">
                Delete {names.length === 1 ? 'Record' : `${names.length} Records`}
              </h2>
            </div>
            <p className="text-sm text-stone-500">
              {names.length === 1
                ? names[0]
                : names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '')}
            </p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 transition mt-0.5">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <label className="block text-sm font-medium text-stone-600">
            Delete reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入删除原因..."
            rows={3}
            className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a] resize-none"
            autoFocus
          />
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2 border-t border-stone-100">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-2xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className="flex-1 h-10 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
