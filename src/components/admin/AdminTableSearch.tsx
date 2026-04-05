import { X } from 'lucide-react';

interface AdminTableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export default function AdminTableSearch({
  value,
  onChange,
  placeholder = "Search...",
  label = "Search"
}: AdminTableSearchProps) {
  return (
    <div className="flex-1 min-w-[200px]">
      <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full px-3 pr-9 border border-stone-200 rounded-lg text-sm bg-white"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 transition-colors"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
