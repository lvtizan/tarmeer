import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

/** Inline spinner — use inside buttons, table cells, etc. */
export function Spinner({ size = 'md', text }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <span className="inline-flex items-center gap-2 text-stone-400">
      <Loader2 className={`${sizeClass} animate-spin`} />
      {text && <span className="text-sm">{text}</span>}
    </span>
  );
}

/** Full-area centered spinner — use as page/section loading state */
export function PageSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <span className="inline-flex items-center gap-2.5 text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">{text}</span>
      </span>
    </div>
  );
}

/** Table row spinner — use inside <tbody> when table is loading */
export function TableSpinner({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16">
        <div className="flex items-center justify-center gap-2.5 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </td>
    </tr>
  );
}
