'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full h-[48px] px-4 pr-10 rounded-xl border text-left text-[15px] flex items-center transition
          ${disabled
            ? 'bg-stone-50 border-stone-200 text-stone-300 cursor-not-allowed'
            : 'bg-white border-stone-200 text-[#1c1917] active:border-[#b8864a] focus:outline-none'
          }
          ${open ? 'border-[#b8864a] ring-2 ring-[#b8864a]/15' : ''}
          ${value ? 'text-[#1c1917]' : 'text-stone-400'}
        `}
      >
        <span className="flex-1 truncate">{value || placeholder}</span>
        {value && !disabled ? (
          <X
            className="absolute right-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400"
            onMouseDown={clear}
          />
        ) : null}
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-stone-200 shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="px-3 pt-3 pb-2 border-b border-stone-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-stone-50 border border-stone-200 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:border-[#b8864a]"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-400 text-center">No results</p>
            ) : filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className={`w-full text-left px-4 py-2.5 text-[14px] transition
                  ${opt === value
                    ? 'bg-[#b8864a]/8 text-[#b8864a] font-medium'
                    : 'text-[#1c1917] hover:bg-stone-50'
                  }
                `}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
