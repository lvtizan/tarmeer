'use client';

import Link from 'next/link';

interface TarmeerLogoProps {
  to?: string;
  className?: string;
}

export default function TarmeerLogo({ to = '/', className = '' }: TarmeerLogoProps) {
  return (
    <Link
      href={to}
      className={`flex items-center gap-2 font-serif text-xl sm:text-2xl font-bold text-[#2c2c2c] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/tarmeer_logo.svg"
        alt=""
        width="36"
        height="36"
        className="h-8 sm:h-9 w-auto"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      TARMEER
    </Link>
  );
}
