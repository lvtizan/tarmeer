import { forwardRef, useState, useRef, useEffect, useImperativeHandle } from 'react';

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

      {/* Custom trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex items-center justify-between w-full h-[50px] px-5 rounded-2xl border bg-stone-50/80 text-[15px] text-left cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-400 ring-2 ring-red-200/30' : 'border-stone-200'
        } ${!value ? 'text-stone-400' : 'text-[#1c1917]'}`}
      >
        <span className="truncate">{selected?.label || options[0]?.label}</span>
        <svg
          className={`flex-shrink-0 ml-2 w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
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
    </div>
  );
});

AdminSelect.displayName = 'AdminSelect';

export default AdminSelect;
