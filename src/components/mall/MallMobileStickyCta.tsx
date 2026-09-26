'use client';

import { useEffect, useState } from 'react';
import MallVisitTrigger from './MallVisitTrigger';

export default function MallMobileStickyCta() {
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.01 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      data-testid="mall-mobile-sticky-cta"
      aria-hidden={footerVisible}
      inert={footerVisible}
      className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 transition duration-200 motion-reduce:transition-none sm:hidden ${
        footerVisible ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <MallVisitTrigger
        label="Talk to a Material Consultant"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#b8864a] px-5 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(28,25,23,0.28)]"
      />
    </div>
  );
}
