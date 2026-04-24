import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? '已复制' : `复制: ${text}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-100 shrink-0 ${className}`}
    >
      {copied
        ? <Check className="w-3 h-3 text-green-500" />
        : <Copy className="w-3 h-3 text-stone-400 hover:text-stone-600" />
      }
    </button>
  );
}
