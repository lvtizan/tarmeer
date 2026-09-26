'use client';

import { CalendarDays } from 'lucide-react';

export const OPEN_MALL_VISIT_EVENT = 'tarmeer:open-mall-visit';

interface MallVisitTriggerProps {
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export default function MallVisitTrigger({
  label = 'Talk to a Material Consultant',
  className = '',
  showIcon = true,
}: MallVisitTriggerProps) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_MALL_VISIT_EVENT))}
      className={className}
    >
      {showIcon && <CalendarDays className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );
}
