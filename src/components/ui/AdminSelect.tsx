'use client';

import { forwardRef, useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  error?: boolean;
  size?: 'sm' | 'lg';
  searchable?: boolean;
  /** 下拉项列数，默认 1。设 2 时列表用双列网格（适合选项多但文字短，如单位）。分组模式下忽略。 */
  columns?: 1 | 2;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ value, onChange, options, className = '', disabled, error, size = 'lg', searchable = false, columns = 1, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid }, ref) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const internalSelectRef = useRef<HTMLSelectElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => internalSelectRef.current as HTMLSelectElement);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { if (!open) setSearch(''); }, [open]);
    useEffect(() => {
      if (open && searchable) setTimeout(() => searchRef.current?.focus(), 50);
    }, [open, searchable]);

    useEffect(() => {
      if (!open) return;
      const handleClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }, [open]);

    const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const updateDropPos = useCallback(() => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useEffect(() => {
      if (!open) return;
      updateDropPos();
      window.addEventListener('scroll', updateDropPos, true);
      window.addEventListener('resize', updateDropPos);
      return () => {
        window.removeEventListener('scroll', updateDropPos, true);
        window.removeEventListener('resize', updateDropPos);
      };
    }, [open, updateDropPos]);

    const selected = options.find((o) => o.value === value);
    const q = search.toLowerCase();
    const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    const hasGroups = !q && options.some((o) => o.group);

    function renderOptions(opts: SelectOption[], itemClass: string) {
      if (!hasGroups) {
        return opts.map((opt) => (
          <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
            className={`w-full text-left transition hover:bg-stone-50 ${itemClass} ${columns === 2 && (opt.value === '' || opt.value === '__custom__') ? 'col-span-2' : ''} ${opt.value === value ? 'text-[#b8864a] font-medium bg-[#b8864a]/5' : opt.value === '' ? 'text-stone-400' : 'text-[#1c1917]'}`}>
            {opt.label}
          </button>
        ));
      }
      const groups: string[] = [];
      opts.forEach((o) => { if (o.group && !groups.includes(o.group)) groups.push(o.group); });
      const ungrouped = opts.filter((o) => !o.group);
      return (
        <>
          {groups.map((grp) => (
            <div key={grp}>
              <div className="px-5 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase text-[#b8864a]">{grp}</div>
              {opts.filter((o) => o.group === grp).map((opt) => (
                <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left transition hover:bg-stone-50 ${itemClass} ${opt.value === value ? 'text-[#b8864a] font-medium bg-[#b8864a]/5' : opt.value === '' ? 'text-stone-400' : 'text-[#1c1917]'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
          {ungrouped.map((opt) => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left transition hover:bg-stone-50 ${itemClass} ${opt.value === value ? 'text-[#b8864a] font-medium bg-[#b8864a]/5' : opt.value === '' ? 'text-stone-400' : 'text-[#1c1917]'}`}>
              {opt.label}
            </button>
          ))}
        </>
      );
    }

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <select ref={internalSelectRef} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="sr-only" tabIndex={-1} aria-hidden="true">
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button id={id} type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid}
          className={`flex items-center justify-between w-full border bg-stone-50/80 text-left cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${size === 'sm' ? 'h-9 px-3 rounded-lg text-sm' : 'h-[50px] px-5 rounded-2xl text-[15px]'} ${error ? 'border-red-400 ring-2 ring-red-200/30' : 'border-stone-200'} ${!value ? 'text-stone-400' : 'text-[#1c1917]'} ${className}`}>
          <span className="truncate">{selected?.label || options[0]?.label}</span>
          <svg className={`flex-shrink-0 ml-2 w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && dropPos && mounted && createPortal(
          <div className="flex flex-col fixed z-[9999] bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden"
            style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: '70vh' }}>
            {searchable && (
              <div className="flex-shrink-0 px-3 py-2.5 border-b border-stone-100">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                    className="w-full h-9 pl-8 pr-3 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:border-[#b8864a] focus:bg-white transition" />
                </div>
                {q && filtered.length === 0 && <p className="text-xs text-stone-400 text-center py-2">No results</p>}
              </div>
            )}
            <ul className={`overflow-y-auto flex-1 ${columns === 2 && !hasGroups ? 'grid grid-cols-2 gap-x-1' : ''}`}>
              {renderOptions(filtered, `${size === 'sm' ? 'px-3 py-2 text-sm' : 'px-5 py-3 text-[15px]'}`)}
            </ul>
          </div>,
          document.body
        )}
      </div>
    );
  }
);

AdminSelect.displayName = 'AdminSelect';
export default AdminSelect;
