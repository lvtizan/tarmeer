'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import SourcingRequestForm from '@/components/sourcing/SourcingRequestForm';
import { OPEN_MALL_VISIT_EVENT } from './MallVisitTrigger';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MallVisitDrawer() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    const show = () => {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_MALL_VISIT_EVENT, show);
    return () => window.removeEventListener(OPEN_MALL_VISIT_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, open]);

  return (
    <div
      className={`fixed inset-0 z-[100] ${open ? 'visible' : 'pointer-events-none invisible'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close consultation form"
        onClick={close}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mall-visit-title"
        className={`absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-[#faf8f5] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl transition-transform duration-300 motion-reduce:transition-none sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[460px] sm:rounded-none sm:px-8 sm:py-8 ${
          open ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0'
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b8864a]">Plan Your Next Step</p>
            <h2 id="mall-visit-title" className="mt-2 font-serif text-2xl font-semibold text-[#1c1917]">
              Start with a material conversation
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Tell us what you are sourcing. We will guide you online, in the UAE, or in China.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close consultation form"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SourcingRequestForm
          variant="sourcing"
          title="Tell us what you need"
          subtitle="A sourcing specialist replies within one business day."
          submitLabel="Talk to a Consultant"
          inline
        />
      </div>
    </div>
  );
}
