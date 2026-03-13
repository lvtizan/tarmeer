import { Loader2 } from 'lucide-react';

interface LoadingButtonProps {
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function LoadingButton({
  type = 'button',
  loading = false,
  disabled = false,
  children,
  className = '',
  onClick,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      {/* Loading状态：只显示转圈动画 */}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
        </span>
      )}
      
      {/* 正常状态：显示文字内容 */}
      <span className={loading ? 'opacity-0' : ''}>
        {children}
      </span>
    </button>
  );
}
