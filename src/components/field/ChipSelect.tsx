'use client';

import { useEffect, useRef } from 'react';

interface ChipSelectProps {
  options: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  otherText?: string;
  onOtherTextChange?: (text: string) => void;
}

export default function ChipSelect({ options, value, onChange, multi = false, otherText = '', onOtherTextChange }: ChipSelectProps) {
  const selected = multi ? (Array.isArray(value) ? value : []) : (value as string);

  function toggle(opt: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt]);
    } else {
      onChange(opt === selected ? '' : opt);
    }
  }

  function isSelected(opt: string) {
    return multi ? (Array.isArray(value) && value.includes(opt)) : value === opt;
  }

  const otherActive = isSelected('Other') && onOtherTextChange !== undefined;
  const otherRef = useRef<HTMLTextAreaElement>(null);

  // Auto-size on mount / draft hydration
  useEffect(() => {
    const el = otherRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [otherActive, otherText]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = isSelected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`min-h-[44px] px-4 py-2 rounded-2xl border text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#b8864a] text-white border-[#b8864a]'
                  : 'border-stone-200 text-stone-600 bg-white'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {otherActive && (
        <textarea
          ref={otherRef}
          value={otherText}
          onChange={(e) => {
            onOtherTextChange!(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder="Please specify…"
          rows={3}
          className="w-full min-h-[88px] px-4 py-3 rounded-2xl border border-[#b8864a]/40 bg-white text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15 focus:border-[#b8864a] resize-none overflow-hidden leading-relaxed"
        />
      )}
    </div>
  );
}
