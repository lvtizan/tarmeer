import { ChevronDown } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: ReactNode;
  wrapperClassName?: string;
  chevronClassName?: string;
};

export default function SelectField({
  icon,
  wrapperClassName = '',
  chevronClassName = '',
  className = '',
  children,
  ...props
}: SelectFieldProps) {
  const baseClassName = [
    'h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-4 pr-12 text-sm text-[#2c2c2c]',
    'focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/40 outline-none transition-colors',
    'cursor-pointer appearance-none',
    icon ? 'pl-10' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['relative', wrapperClassName].filter(Boolean).join(' ')}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-stone-400">
          {icon}
        </span>
      )}
      <select {...props} className={baseClassName}>
        {children}
      </select>
      <ChevronDown
        className={[
          'pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b8864a]',
          chevronClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      />
    </div>
  );
}
