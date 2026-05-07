import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const PHONE_COUNTRIES = [
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+86',  flag: '🇨🇳', name: '中国' },
  { code: '+966', flag: '🇸🇦', name: 'KSA' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+1',   flag: '🇺🇸', name: 'US' },
];

function parsePhone(value: string): { code: string; digits: string } {
  if (!value) return { code: '+971', digits: '' };
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (value.startsWith(c.code)) return { code: c.code, digits: value.slice(c.code.length) };
  }
  return { code: '+971', digits: value };
}

interface PhoneCountryInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function PhoneCountryInput({ value, onChange, placeholder = '501234567' }: PhoneCountryInputProps) {
  const { code: initCode, digits: initDigits } = parsePhone(value);
  const [code, setCode] = useState(initCode);
  const [digits, setDigits] = useState(initDigits);
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef(value);

  // Sync from parent when value changes externally (e.g. API load)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const { code: c, digits: d } = parsePhone(value);
      setCode(c);
      setDigits(d);
    }
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectCode = (c: string) => {
    setCode(c);
    setOpen(false);
    prevValueRef.current = c + digits;
    onChange(c + digits);
  };

  const handleDigits = (d: string) => {
    const clean = d.replace(/[^0-9]/g, '');
    setDigits(clean);
    prevValueRef.current = code + clean;
    onChange(code + clean);
  };

  const selected = PHONE_COUNTRIES.find(c => c.code === code) ?? PHONE_COUNTRIES[0];

  return (
    <div className="flex h-[50px] rounded-2xl border border-stone-200 bg-stone-50/80 overflow-visible focus-within:border-[#B8864A] focus-within:ring-2 focus-within:ring-[#B8864A]/15 focus-within:bg-white transition relative">
      <div ref={dropRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 h-full px-3 text-[15px] text-[#1c1917] border-r border-stone-200 hover:bg-stone-100/50 transition rounded-l-2xl"
        >
          <span>{selected.flag}</span>
          <span className="text-sm text-stone-500">{selected.code}</span>
          <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-stone-200 rounded-2xl shadow-lg py-1 min-w-[160px]">
            {PHONE_COUNTRIES.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => selectCode(c.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-stone-50 transition ${
                  c.code === code ? 'text-[#b8864a] font-medium' : 'text-[#2c2c2c]'
                }`}
              >
                <span>{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-stone-400 text-xs">{c.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        value={digits}
        onChange={e => handleDigits(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-full px-3 bg-transparent text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none min-w-0"
      />
    </div>
  );
}
