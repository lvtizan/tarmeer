import { Loader2 } from 'lucide-react';

interface LoadingButtonProps {
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  loadingText?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function LoadingButton({
  type = 'button',
  loading = false,
  disabled = false,
  children,
  loadingText,
  className = '',
  onClick,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span>{loading ? (loadingText ?? children) : children}</span>
    </button>
  );
}
