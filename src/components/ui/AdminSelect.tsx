interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}

export default function AdminSelect({ value, onChange, options, className = '', disabled }: AdminSelectProps) {
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none bg-white border border-stone-200 rounded-full px-5 pr-10 py-2.5 text-sm text-[#2c2c2c] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] hover:border-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
