import type { ReactNode } from 'react';

type AuthCardShellProps = {
  children: ReactNode;
  className?: string;
};

export default function AuthCardShell({ children, className = '' }: AuthCardShellProps) {
  return (
    <div className={`w-full max-w-[440px] lg:w-[440px] ${className}`.trim()}>
      <div className="bg-white rounded-[28px] border border-stone-200 shadow-[0_4px_40px_rgba(0,0,0,0.06)] p-8 sm:p-10">
        {children}
      </div>
    </div>
  );
}

