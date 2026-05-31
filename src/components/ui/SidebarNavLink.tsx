'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarNavLinkProps {
  to: string;
  end?: boolean;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

const BASE_CLASS =
  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer';

const ACTIVE_CLASS = 'bg-[#b8864a]/10 text-[#2c2c2c]';
const INACTIVE_CLASS = 'text-stone-600 hover:bg-stone-50';

export default function SidebarNavLink({
  to,
  end,
  children,
  className = '',
  activeClassName = ACTIVE_CLASS,
  inactiveClassName = INACTIVE_CLASS,
}: SidebarNavLinkProps) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname.startsWith(to);

  return (
    <Link
      href={to}
      className={`${BASE_CLASS} ${isActive ? activeClassName : inactiveClassName} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
