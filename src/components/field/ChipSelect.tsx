'use client';

interface ChipSelectProps {
  options: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}

export default function ChipSelect({ options, value, onChange, multi = false }: ChipSelectProps) {
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

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`min-h-[44px] px-4 py-2 rounded-2xl border text-sm font-medium transition-colors ${
            isSelected(opt)
              ? 'bg-[#b8864a] text-white border-[#b8864a]'
              : 'border-stone-200 text-stone-600 bg-white'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
