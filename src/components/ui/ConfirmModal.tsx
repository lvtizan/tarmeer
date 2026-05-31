'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ConfirmOptions {
  title: string;
  message?: string;
  /** If set, user must type this exact string before confirming */
  requireText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

type Setter = (options: ConfirmOptions) => void;
let _show: Setter | null = null;

/** Show a confirmation modal. For destructive ops, set requireText to force typed confirmation. */
export function showConfirm(options: ConfirmOptions) {
  _show?.(options);
}

export default function ConfirmModal() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setTyped('');
    setLoading(false);
  }, []);

  useEffect(() => {
    _show = show;
    return () => { _show = null; };
  }, [show]);

  useEffect(() => {
    if (options?.requireText) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [options]);

  if (!options) return null;

  const { title, message, requireText, confirmLabel = '确认删除', cancelLabel = '取消', onConfirm } = options;
  const canConfirm = !requireText || typed === requireText;

  async function handleConfirm() {
    if (!canConfirm || loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setOptions(null);
      setLoading(false);
    }
  }

  function handleCancel() {
    if (loading) return;
    setOptions(null);
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-semibold text-[#2c2c2c]">{title}</h3>

        {message && (
          <p className="text-sm text-stone-500 leading-relaxed">{message}</p>
        )}

        {requireText && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-500">
              请输入 <span className="font-medium text-red-600">「{requireText}」</span> 以确认：
            </p>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder={requireText}
              className="h-[42px] px-4 rounded-xl border border-stone-200 bg-stone-50 text-[14px] text-[#1c1917] placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-400 focus:bg-white"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
