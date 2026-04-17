import { forwardRef, useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react';

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(({ value, onChange, options, className = '', disabled, error }, ref) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalSelectRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle(ref, () => internalSelectRef.current as HTMLSelectElement);

  const selected = options.find((o) => o.value === value);

  // Desktop outside-click to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Lock body scroll while mobile modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Calculate fixed position for desktop dropdown (avoids overflow clipping)
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

  const optionList = options.map((opt) => (
    <button
      key={opt.value}
      type="button"
      onClick={() => { onChange(opt.value); setOpen(false); }}
      className={`w-full text-left px-5 py-4 text-[15px] transition hover:bg-stone-50 ${
        opt.value === value
          ? 'text-[#b8864a] font-medium bg-[#b8864a]/5'
          : opt.value === ''
          ? 'text-stone-400'
          : 'text-[#1c1917]'
      }`}
    >
      {opt.label}
    </button>
  ));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden native select for form compatibility */}
      <select
        ref={internalSelectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex items-center justify-between w-full h-[50px] px-5 rounded-2xl border bg-stone-50/80 text-[15px] text-left cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-400 ring-2 ring-red-200/30' : 'border-stone-200'
        } ${!value ? 'text-stone-400' : 'text-[#1c1917]'} ${className}`}
      >
        <span className="truncate">{selected?.label || options[0]?.label}</span>
        <svg
          className={`flex-shrink-0 ml-2 w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Mobile: fixed centered modal */}
          <div
            className="sm:hidden fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-6"
            onMouseDown={() => setOpen(false)}
          >
            <div
              className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-stone-100">
                <p className="text-sm font-semibold text-[#2c2c2c]">Select an option</p>
              </div>
              <div className="divide-y divide-stone-100">
                {optionList}
              </div>
            </div>
          </div>

          {/* Desktop: fixed dropdown (escapes overflow-hidden containers) */}
          {dropPos && (
            <ul
              className="hidden sm:block fixed z-[9999] bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
              style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
            >
              {options.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full text-left px-5 py-3 text-[15px] transition hover:bg-stone-50 ${
                      opt.value === value
                        ? 'text-[#b8864a] font-medium bg-[#b8864a]/5'
                        : opt.value === ''
                        ? 'text-stone-400'
                        : 'text-[#1c1917]'
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
});

AdminSelect.displayName = 'AdminSelect';

export default AdminSelect;
