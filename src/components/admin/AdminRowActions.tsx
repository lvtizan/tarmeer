'use client';

import { ReactNode, useState } from 'react';

export interface RowAction {
  icon: ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
}

export default function AdminRowActions({ actions }: { actions: RowAction[] }) {
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          disabled={action.disabled}
          onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTooltip({ label: action.label, x: rect.left + rect.width / 2, y: rect.top });
          }}
          onMouseLeave={() => setTooltip(null)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition disabled:opacity-40 ${
            action.variant === 'danger'
              ? 'text-stone-400 hover:text-red-500 hover:bg-red-50'
              : action.variant === 'warning'
              ? 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
              : action.variant === 'success'
              ? 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
          }`}
        >
          {action.icon}
        </button>
      ))}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 6,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="px-2 py-1 text-[11px] font-medium text-white bg-stone-800 rounded-md whitespace-nowrap shadow-lg"
        >
          {tooltip.label}
          <div
            style={{ position: 'absolute', left: '50%', bottom: -4, transform: 'translateX(-50%)', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #292524' }}
          />
        </div>
      )}
    </div>
  );
}
