'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/* ── Shared styles ── */
const base = "w-full rounded-2xl border border-stone-200 bg-stone-50/80 text-[#1c1917] outline-none transition focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/15 focus:bg-white placeholder:text-stone-400";
const inputSize = "h-[50px] px-5 text-[15px]";
const textareaSize = "px-5 py-4 text-[15px]";
const labelStyle = "mb-1.5 block text-sm font-medium text-stone-700";

/* ── Label ── */
export function FormLabel({ children, required, icon }: { children: ReactNode; required?: boolean; icon?: ReactNode }) {
  return (
    <label className={labelStyle}>
      {icon && <span className="inline-flex text-[#b8864a] mr-1 align-[-2px]">{icon}</span>}
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

/* ── Input ── */
export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`${base} ${inputSize} ${className}`} {...props} />
  )
);
FormInput.displayName = 'FormInput';

/* ── Textarea ── */
export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea ref={ref} className={`${base} ${textareaSize} resize-y ${className}`} {...props} />
  )
);
FormTextarea.displayName = 'FormTextarea';

/* ── Select ── */
export const FormSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={`${base} ${inputSize} appearance-none cursor-pointer pr-10 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b8864a]" />
    </div>
  )
);
FormSelect.displayName = 'FormSelect';

/* ── Tag button ── */
export function FormTag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'border-[#b8864a] bg-[#b8864a] text-white' : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-[#b8864a]/45'
      }`}>
      {label}
    </button>
  );
}
