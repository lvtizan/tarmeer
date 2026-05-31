'use client';

import { useState, useEffect, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let _addToast: ((text: string, type?: ToastType) => void) | null = null;

/** Call from anywhere: showToast('Saved!', 'success') */
export function showToast(text: string, type: ToastType = 'info') {
  _addToast?.(text, type);
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-[#b8864a] text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-[#b8864a] text-white',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-6 py-3 rounded-2xl shadow-lg text-[14px] font-medium animate-[fadeInDown_0.3s_ease-out] ${TYPE_STYLES[toast.type]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
