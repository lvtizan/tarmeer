'use client';

/**
 * PhoneRevealButton — shared "show phone number" control.
 *
 * The full number is only returned by POST /api/phone-reveals; clicking also
 * records one reveal (real-intent analytics). Used by both the company detail
 * page (link style) and the expert detail page (bordered button style).
 */

import { useState } from 'react';
import { Phone } from 'lucide-react';

interface PhoneRevealButtonProps {
  /** Maps to the reveal endpoint's target_type. */
  targetType: 'uae' | 'expert';
  /** Numeric DB id of the target. */
  targetId?: number;
  isVn?: boolean;
  /**
   * Visual style:
   * - 'link'   : inline text link (company contact rows)
   * - 'button' : full-width bordered gold button (expert sidebar)
   */
  variant?: 'link' | 'button';
}

export default function PhoneRevealButton({
  targetType,
  targetId,
  isVn = false,
  variant = 'link',
}: PhoneRevealButtonProps) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!targetId) return null;

  const reveal = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/phone-reveals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.phone) setPhone(data.phone);
    } finally {
      setLoading(false);
    }
  };

  const revealLabel = loading ? '…' : isVn ? 'Xem số điện thoại' : 'Show phone number';

  if (phone) {
    if (variant === 'button') {
      return (
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-2.5 text-[#1c1917] font-medium hover:text-[#b8864a] transition"
        >
          <Phone className="w-4 h-4 text-[#c6a065]" /> {phone}
        </a>
      );
    }
    return (
      <a
        href={`tel:${phone}`}
        className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition"
      >
        <Phone className="w-4 h-4 text-[#c6a065]" /> {phone}
      </a>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={reveal}
        disabled={loading}
        className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-[#b8864a] text-[#b8864a] text-sm font-medium hover:bg-[#b8864a] hover:text-white transition disabled:opacity-50"
      >
        <Phone className="w-4 h-4" /> {revealLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={reveal}
      disabled={loading}
      className="flex items-center gap-2.5 text-[#b8864a] hover:underline disabled:opacity-50"
    >
      <Phone className="w-4 h-4" /> {revealLabel}
    </button>
  );
}
