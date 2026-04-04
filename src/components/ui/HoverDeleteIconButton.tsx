import type { MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';

interface HoverDeleteIconButtonProps {
  title?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export default function HoverDeleteIconButton({
  title = 'Delete',
  loading = false,
  disabled = false,
  onClick,
}: HoverDeleteIconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-red-200 bg-white text-red-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? '...' : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
