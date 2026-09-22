'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { shouldPinDesktopSidebar } from '@/lib/fixedSidebar';

interface FilterSidebarProps {
  hasActiveFilters: boolean;
  onClearAll: () => void;
  renderFilters: (compact: boolean) => React.ReactNode;
  filtersLabel?: string;
  clearLabel?: string;
  desktopStickyTopClass?: string;
  desktopMaxHeightClass?: string;
  desktopFixed?: boolean;
  desktopFixedTop?: number;
  mobileTriggerWrapperClass?: string;
  closeOnMobileSelection?: boolean;
}

export default function FilterSidebar({
  hasActiveFilters,
  onClearAll,
  renderFilters,
  filtersLabel = 'Filters',
  clearLabel = 'Clear filters',
  desktopStickyTopClass = 'lg:top-24',
  desktopMaxHeightClass = 'max-h-[calc(100vh-7rem)]',
  desktopFixed = false,
  desktopFixedTop = 96,
  mobileTriggerWrapperClass = 'mb-3',
  closeOnMobileSelection = false,
}: FilterSidebarProps) {
  const asideRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const anchorTopRef = useRef(0);
  const panelStyleRef = useRef<React.CSSProperties | undefined>(undefined);
  const [desktopPinned, setDesktopPinned] = useState(false);
  const [desktopPanelHeight, setDesktopPanelHeight] = useState<number | null>(null);
  const [desktopPanelStyle, setDesktopPanelStyle] = useState<React.CSSProperties | undefined>(undefined);

  useEffect(() => {
    const clearPinned = () => {
      const wasPinned = pinnedRef.current;
      pinnedRef.current = false;
      anchorTopRef.current = 0;
      panelStyleRef.current = undefined;
      if (wasPinned) setDesktopPinned(false);
      setDesktopPanelHeight((height) => (height === null ? height : null));
      setDesktopPanelStyle((style) => (style === undefined ? style : undefined));
    };
    if (!desktopFixed) {
      clearPinned();
      return;
    }

    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    let frameId: number | null = null;
    const updatePosition = () => {
      const aside = asideRef.current;
      const panel = panelRef.current;
      if (!aside || !panel || !desktopQuery.matches) {
        clearPinned();
        return;
      }

      const asideRect = aside.getBoundingClientRect();
      if (!pinnedRef.current) anchorTopRef.current = asideRect.top + window.scrollY;

      const panelHeight = panel.getBoundingClientRect().height;
      const parentBottom = aside.parentElement?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
      const shouldPin = shouldPinDesktopSidebar({
        scrollY: window.scrollY,
        anchorTop: anchorTopRef.current,
        parentBottom,
        fixedTop: desktopFixedTop,
        panelHeight,
        viewportHeight: window.innerHeight,
      });

      if (!shouldPin) {
        clearPinned();
        return;
      }

      pinnedRef.current = true;
      setDesktopPinned((pinned) => (pinned ? pinned : true));
      setDesktopPanelHeight((height) => (height === panelHeight ? height : panelHeight));
      const nextStyle: React.CSSProperties = {
        position: 'fixed',
        top: desktopFixedTop,
        left: asideRect.left,
        width: asideRect.width,
        maxHeight: `calc(100vh - ${desktopFixedTop + 16}px)`,
      };
      const currentStyle = panelStyleRef.current;
      const styleChanged = !currentStyle
        || currentStyle.left !== nextStyle.left
        || currentStyle.width !== nextStyle.width
        || currentStyle.top !== nextStyle.top
        || currentStyle.maxHeight !== nextStyle.maxHeight;
      if (styleChanged) {
        panelStyleRef.current = nextStyle;
        setDesktopPanelStyle(nextStyle);
      }
    };
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    desktopQuery.addEventListener('change', scheduleUpdate);
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (asideRef.current?.parentElement) resizeObserver.observe(asideRef.current.parentElement);
    if (panelRef.current) resizeObserver.observe(panelRef.current);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      desktopQuery.removeEventListener('change', scheduleUpdate);
      resizeObserver.disconnect();
      clearPinned();
    };
  }, [desktopFixed, desktopFixedTop]);

  return (
    <>
      {/* Mobile trigger button — rendered inline, caller positions it */}
      <div className={`lg:hidden ${mobileTriggerWrapperClass}`}>
        <MobileFilterTrigger
          hasActiveFilters={hasActiveFilters}
          label={filtersLabel}
          renderFilters={renderFilters}
          clearLabel={clearLabel}
          onClearAll={onClearAll}
          closeOnSelection={closeOnMobileSelection}
        />
      </div>

      {/* Desktop sticky sidebar */}
      <aside
        ref={asideRef}
        className="w-60 flex-shrink-0 hidden lg:block"
        style={desktopPinned && desktopPanelHeight ? { minHeight: desktopPanelHeight } : undefined}
      >
        <div
          ref={panelRef}
          className={`lg:sticky ${desktopStickyTopClass} ${desktopMaxHeightClass} overflow-y-auto custom-scrollbar`}
          style={desktopPanelStyle}
        >
          <div className="bg-white rounded-[22px] border border-stone-100 p-5 shadow-sm shadow-stone-100/50 space-y-6">
            {renderFilters(false)}
          </div>
        </div>
      </aside>

      <style>{`
        .custom-scrollbar { scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
        .custom-scrollbar:hover { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d6d3d1; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
      `}</style>
    </>
  );
}

function MobileFilterTrigger({
  hasActiveFilters,
  label,
  renderFilters,
  clearLabel,
  onClearAll,
  closeOnSelection,
}: {
  hasActiveFilters: boolean;
  label: string;
  renderFilters: (compact: boolean) => React.ReactNode;
  clearLabel: string;
  onClearAll: () => void;
  closeOnSelection: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={dialogId}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {label}
        {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#b8864a]" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm overflow-y-auto overscroll-contain bg-white"
          >
            <div className="flex items-center justify-between p-4 border-b border-stone-200 sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-[#1c1917]">{label}</h3>
              <button ref={closeRef} type="button" onClick={close} aria-label={`Close ${label}`} className="p-2 rounded-lg hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className="p-5 space-y-6"
              onClick={(event) => {
                if (closeOnSelection && (event.target as HTMLElement).closest('button')) close();
              }}
            >
              {renderFilters(true)}
            </div>
            {hasActiveFilters && (
              <div className="sticky bottom-0 bg-white border-t border-stone-200 p-4">
                <button
                  onClick={() => { onClearAll(); close(); }}
                  className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  {clearLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
