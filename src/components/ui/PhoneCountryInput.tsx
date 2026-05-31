'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { validatePhone } from '@/lib/phoneValidation';

export const PHONE_COUNTRIES = [
  { code: '+971', flag: '🇦🇪', name: 'UAE',     maxDigits: 9  },
  { code: '+86',  flag: '🇨🇳', name: '中国',    maxDigits: 11 },
  { code: '+966', flag: '🇸🇦', name: 'KSA',     maxDigits: 9  },
  { code: '+974', flag: '🇶🇦', name: 'Qatar',   maxDigits: 8  },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait',  maxDigits: 8  },
  { code: '+968', flag: '🇴🇲', name: 'Oman',    maxDigits: 8  },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain', maxDigits: 8  },
  { code: '+91',  flag: '🇮🇳', name: 'India',   maxDigits: 10 },
  { code: '+44',  flag: '🇬🇧', name: 'UK',      maxDigits: 10 },
  { code: '+1',   flag: '🇺🇸', name: 'US',      maxDigits: 10 },
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
  /** 'sm' = h-9 rounded-lg (admin form); 'lg' = h-[50px] rounded-2xl (default) */
  size?: 'sm' | 'lg';
}

export default function PhoneCountryInput({ value, onChange, placeholder, size = 'lg' }: PhoneCountryInputProps) {
  const { code: initCode, digits: initDigits } = parsePhone(value);
  const initCountry = PHONE_COUNTRIES.find(c => c.code === initCode) ?? PHONE_COUNTRIES[0];
  const [code, setCode] = useState(initCode);
  const [digits, setDigits] = useState(initDigits.slice(0, initCountry.maxDigits));
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const normalizedInit = initCode + initDigits.slice(0, initCountry.maxDigits);
  const prevValueRef = useRef(normalizedInit);

  // If the stored value was truncated on mount, push the normalized value up immediately
  useEffect(() => {
    if (value && value !== normalizedInit) {
      onChange(normalizedInit);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = PHONE_COUNTRIES.find(c => c.code === code) ?? PHONE_COUNTRIES[0];

  // Sync from parent when value changes externally (e.g. API load)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const { code: c, digits: d } = parsePhone(value);
      const country = PHONE_COUNTRIES.find(x => x.code === c) ?? PHONE_COUNTRIES[0];
      setCode(c);
      setDigits(d.slice(0, country.maxDigits));
    }
  }, [value]);

  // Reset touched when country changes so error doesn't linger on truncated digits
  const selectCode = (c: string) => {
    const country = PHONE_COUNTRIES.find(x => x.code === c) ?? PHONE_COUNTRIES[0];
    const trimmed = digits.slice(0, country.maxDigits);
    setCode(c);
    setDigits(trimmed);
    setTouched(false);
    setOpen(false);
    prevValueRef.current = c + trimmed;
    onChange(c + trimmed);
  };

  const handleDigits = (d: string) => {
    const clean = d.replace(/[^0-9]/g, '').slice(0, selected.maxDigits);
    setDigits(clean);
    prevValueRef.current = code + clean;
    onChange(code + clean);
  };

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const isComplete = digits.length === selected.maxDigits;
  const formatError = touched && isComplete ? validatePhone(digits, code) : null;
  const hasLengthError = touched && digits.length > 0 && digits.length < selected.maxDigits;
  const hasError = hasLengthError || !!formatError;

  const defaultPlaceholder = '0'.repeat(selected.maxDigits);

  return (
    <div>
      <div className={`flex ${size === 'sm' ? 'h-9 rounded-lg' : 'h-[50px] rounded-2xl'} border bg-stone-50/80 overflow-visible focus-within:ring-2 focus-within:bg-white transition relative ${
        hasError
          ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-400/15'
          : isComplete
          ? 'border-[#B8864A]/60 focus-within:border-[#B8864A] focus-within:ring-[#B8864A]/15'
          : 'border-stone-200 focus-within:border-[#B8864A] focus-within:ring-[#B8864A]/15'
      }`}>
        {/* Country selector */}
        <div ref={dropRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1.5 h-full px-3 ${size === 'sm' ? 'px-2.5 text-sm' : 'text-[15px]'} text-[#1c1917] border-r border-stone-200 hover:bg-stone-100/50 transition ${size === 'sm' ? 'rounded-l-lg' : 'rounded-l-2xl'}`}
          >
            <span>{selected.flag}</span>
            <span className="text-sm text-stone-500">{selected.code}</span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-stone-200 rounded-2xl shadow-lg py-1 min-w-[170px]">
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
                  <span className="text-stone-400 text-xs">{c.code} · {c.maxDigits}位</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Number input */}
        <input
          type="tel"
          value={digits}
          onChange={e => handleDigits(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder ?? defaultPlaceholder}
          maxLength={selected.maxDigits}
          className={`flex-1 h-full px-3 bg-transparent ${size === 'sm' ? 'text-sm' : 'text-[15px]'} text-[#1c1917] placeholder:text-stone-400 focus:outline-none min-w-0`}
        />
      </div>

      {/* Validation hint */}
      {formatError && (
        <p className="text-xs text-red-500 mt-1.5">{formatError}</p>
      )}
      {hasLengthError && (
        <p className="text-xs text-red-500 mt-1.5">
          需要 {selected.maxDigits} 位数字，已输入 {digits.length} 位
        </p>
      )}
    </div>
  );
}
