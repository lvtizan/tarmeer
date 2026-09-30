'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Option = { value: string; label: string; disabled?: boolean };

/** Scoped to public procurement filters; preserves disabled price-sort options. */
export default function ProcurementSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const active = Array.from(buttons || []).find(button => button.dataset.value === value);
    (active || buttons?.[0])?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, value]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return <div ref={root} className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <label id={`${id}-label`} htmlFor={id} className="mb-1 block text-xs text-stone-700">{label}</label>
    <button ref={trigger} id={id} type="button" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-options` : undefined} aria-labelledby={`${id}-label ${id}-value`}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}
      className="flex min-h-10 w-full items-center gap-3 rounded-lg border border-stone-300 bg-white py-2 pl-3 pr-4 text-left text-sm text-stone-700 outline-none transition focus-visible:border-[#b8864a] focus-visible:ring-2 focus-visible:ring-[#b8864a]/25">
      <span id={`${id}-value`} className="min-w-0 flex-1 truncate">{selected?.label || 'Any'}</span>
      <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[#b8864a] transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div ref={list} id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`}
      className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg"
      onKeyDown={event => {
        const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
      }}>
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value}
        aria-disabled={option.disabled || undefined} disabled={option.disabled} tabIndex={-1} data-value={option.value}
        onClick={() => { onChange(option.value); close(); }}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-[#f5f0e8] focus:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-white ${option.value === value ? 'bg-[#f5f0e8] font-medium text-[#92652e]' : 'text-stone-700'}`}>
        <span className="min-w-0 flex-1 break-words">{option.label}</span>
        {option.value === value && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
      </button>)}
    </div>}
  </div>;
}
