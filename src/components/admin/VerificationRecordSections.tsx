'use client';

import { useEffect, useMemo, useRef, useState, Fragment, type CSSProperties } from 'react';
import { buildRecordSections, hasRecordValue, parseRecordSchema, safeRecordUrl, type RecordField } from './VerificationRecordModel';

function RecordValue({ value, field, depth = 0 }: { value: unknown; field?: RecordField; depth?: number }) {
  if (!hasRecordValue(value)) return <span className="text-stone-400 text-base font-normal">—</span>;
  if (depth > 8) return <span className="break-all text-base">{JSON.stringify(value)}</span>;

  let parsed = value;
  if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
    try {
      const maybeArr = JSON.parse(value);
      if (Array.isArray(maybeArr)) parsed = maybeArr;
    } catch {
      // Keep as string
    }
  }

  // Render arrays of primitive values (e.g. multi-select options) as horizontal tags/chips
  if (Array.isArray(parsed)) {
    const isPrimitiveArray = parsed.every(item => item === null || typeof item !== 'object');
    if (isPrimitiveArray) {
      const activeItems = parsed.filter(hasRecordValue);
      if (!activeItems.length) return <span className="text-stone-400 text-base font-normal">—</span>;
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {activeItems.map((item, index) => {
            const text = typeof item === 'boolean' ? (item ? 'Yes' : 'No') : String(item);
            const option = field?.options?.find(c => typeof c === 'string' ? c === text : c.value === text);
            const label = option && typeof option === 'object' ? option.labelEn || option.label || text : text;
            return (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-800 border border-stone-200/80 text-sm sm:text-base font-medium leading-normal break-words"
              >
                {label}
              </span>
            );
          })}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {parsed.map((item, index) => (
          <div key={index} className={typeof item === 'object' && item !== null ? 'rounded-lg border border-stone-200 p-3 bg-stone-50/40' : ''}>
            <RecordValue value={item} field={field} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  // If a multi-type field value was saved as newline or comma-separated string, render as tags
  if ((field?.type === 'multi' || field?.type === 'choices') && typeof parsed === 'string') {
    const items = parsed.split(/\r?\n|;\s*|,\s*/).map(s => s.trim()).filter(Boolean);
    if (items.length > 1) {
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {items.map((item, index) => {
            const option = field?.options?.find(c => typeof c === 'string' ? c === item : c.value === item);
            const label = option && typeof option === 'object' ? option.labelEn || option.label || item : item;
            return (
              <span
                key={index}
                className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-800 border border-stone-200/80 text-sm sm:text-base font-medium leading-normal break-words"
              >
                {label}
              </span>
            );
          })}
        </div>
      );
    }
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const children = field?.fields || [];
    return (
      <dl className="space-y-2">
        {Object.entries(parsed).map(([key, item]) => {
          const child = children.find(candidate => candidate.key === key);
          return (
            <div key={key} className="min-w-0">
              <dt className="mb-0.5 break-words text-base text-stone-500 font-normal">
                {child?.labelEn || child?.label || key}
              </dt>
              <dd>
                <RecordValue value={item} field={child} depth={depth + 1} />
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  const text = typeof parsed === 'boolean' ? (parsed ? 'Yes' : 'No') : String(parsed);
  const option = field?.options?.find(candidate => typeof candidate === 'string' ? candidate === text : candidate.value === text);
  const label = option && typeof option === 'object' ? option.labelEn || option.label || text : text;
  const href = field?.type === 'url' ? safeRecordUrl(text) : null;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-[#b8864a] underline text-base font-medium">
      {label}
    </a>
  ) : (
    <span className="whitespace-pre-wrap break-words text-base text-stone-800 [overflow-wrap:anywhere] leading-normal font-medium">
      {label}
    </span>
  );
}

const recordSectionId = (key: string) => `record-section-${key}`;
const decodeHash = (hash: string) => { try { return decodeURIComponent(hash); } catch { return hash; } };

export default function VerificationRecordSections({ record, schema, stickyOffset = 0 }: { record: Record<string, unknown>; schema: unknown; stickyOffset?: number }) {
  const sections = useMemo(() => buildRecordSections(record, schema), [record, schema]);
  const hasSnapshot = parseRecordSchema(record.schema_snapshot).length > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [scrollportHeight, setScrollportHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setScrollportHeight(0);
      return;
    }
    const scrollport = navRef.current?.closest('main');
    if (!scrollport || typeof ResizeObserver === 'undefined') return;
    const measure = () => setScrollportHeight(scrollport.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollport);
    return () => observer.disconnect();
  }, [isDesktop]);

  useEffect(() => {
    const measure = () => setViewportHeight(window.visualViewport?.height || window.innerHeight);
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [sections]);

  useEffect(() => {
    if (!sections.length) return;
    const nodes = sections.map(section => document.getElementById(recordSectionId(section.key))).filter((node): node is HTMLElement => !!node);
    if (!nodes.length) return;
    const scrollport = isDesktop ? nodes[0].closest('main') : null;
    const rootHeight = isDesktop ? scrollportHeight : viewportHeight;
    const availableHeight = Math.max(1, rootHeight - (isDesktop ? stickyOffset : 0));
    const observationBand = Math.min(160, availableHeight);
    const topInset = isDesktop ? Math.min(stickyOffset, Math.max(0, rootHeight - observationBand)) : 0;
    const bottomInset = Math.max(0, rootHeight - topInset - observationBand);
    const scrollSource = nodes[0].closest('main') || document.scrollingElement;
    const isAtEnd = () => Boolean(
      scrollSource
      && scrollSource.scrollHeight > scrollSource.clientHeight + 2
      && scrollSource.scrollHeight - scrollSource.scrollTop - scrollSource.clientHeight <= 2,
    );
    const observer = new IntersectionObserver(entries => {
      if (isAtEnd()) {
        setActiveIndex(nodes.length - 1);
        return;
      }
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveIndex(Number((visible.target as HTMLElement).dataset.sectionIndex));
    }, {
      root: scrollport,
      rootMargin: `-${topInset}px 0px -${bottomInset}px 0px`,
      threshold: [0.1, 0.35, 0.6],
    });
    nodes.forEach(node => observer.observe(node));
    const selectActiveFromScrollPosition = () => {
      if (isAtEnd()) {
        setActiveIndex(nodes.length - 1);
        return;
      }
      const observationTop = scrollport
        ? scrollport.getBoundingClientRect().top + topInset
        : topInset;
      const currentIndex = nodes.reduce((current, node, index) => (
        node.getBoundingClientRect().top <= observationTop + 1 ? index : current
      ), 0);
      setActiveIndex(currentIndex);
    };
    scrollSource?.addEventListener('scroll', selectActiveFromScrollPosition, { passive: true });
    selectActiveFromScrollPosition();
    return () => {
      observer.disconnect();
      scrollSource?.removeEventListener('scroll', selectActiveFromScrollPosition);
    };
  }, [isDesktop, scrollportHeight, sections, stickyOffset, viewportHeight]);

  useEffect(() => {
    const selectHashTarget = () => {
      const hash = decodeHash(window.location.hash.slice(1));
      const index = sections.findIndex(section => recordSectionId(section.key) === hash);
      if (index < 0) return;
      setActiveIndex(index);
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
    };
    selectHashTarget();
    window.addEventListener('hashchange', selectHashTarget);
    return () => window.removeEventListener('hashchange', selectHashTarget);
  }, [sections]);

  useEffect(() => {
    const activeKey = sections[activeIndex]?.key;
    const nav = navRef.current;
    const links = nav?.querySelectorAll<HTMLAnchorElement>('[data-section-key]') || [];
    const link = Array.from(links).find(item => item.dataset.sectionKey === activeKey);
    if (!nav || !link) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (isDesktop) {
      nav.scrollTop += linkRect.top - navRect.top - (nav.clientHeight - link.clientHeight) / 2;
    } else {
      nav.scrollLeft += linkRect.left - navRect.left - (nav.clientWidth - link.clientWidth) / 2;
    }
  }, [activeIndex, isDesktop, sections]);

  if (!sections.length) return <p className="rounded-xl border border-stone-200 bg-white p-5 text-base text-stone-500">No questionnaire answers saved.</p>;

  return <div style={{ '--record-overview-offset': `${stickyOffset}px` } as CSSProperties} className="mx-auto min-w-0 max-w-[1500px] xl:grid xl:grid-cols-[232px_minmax(0,1fr)] xl:gap-7">
    <aside style={isDesktop && scrollportHeight > stickyOffset ? { maxHeight: `${scrollportHeight - stickyOffset}px` } : undefined} className="print:hidden xl:sticky xl:top-[var(--record-overview-offset)] xl:flex xl:max-h-[calc(100dvh-4rem-var(--record-overview-offset))] xl:self-start xl:flex-col">
      <nav ref={navRef} aria-label="Record sections" className="flex gap-2 overflow-x-auto pb-2 xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:rounded-xl xl:border xl:border-stone-200 xl:bg-white xl:p-2">
        {sections.map((section, index) => {
          const selected = activeIndex === index;
          const filled = section.fields.filter(field => hasRecordValue(section.data[field.key]) || hasRecordValue(section.data[`${field.key}__other`])).length;
          return <a key={section.key} href={`#${recordSectionId(section.key)}`} data-section-key={section.key} aria-current={selected ? 'location' : undefined} onClick={() => setActiveIndex(index)} className={`flex max-w-60 shrink-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors xl:w-full xl:max-w-none ${selected ? 'border-[#b8864a]/35 bg-[#b8864a]/10 text-[#8b6537]' : 'border-stone-200 bg-white text-stone-600 hover:border-[#b8864a]/40 hover:text-[#8b6537] xl:border-transparent xl:bg-transparent'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${selected ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-500'}`}>{index + 1}</span>
              <span className="min-w-0 whitespace-normal break-words text-base font-medium leading-snug [overflow-wrap:anywhere]">{section.titleEn || section.title}</span>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-mono ${filled > 0 ? 'bg-stone-100 text-stone-600' : 'text-stone-300'}`}>
              {filled}/{section.fields.length}
            </span>
          </a>;
        })}
      </nav>
      <div className="mt-3 hidden shrink-0 px-2 space-y-2 xl:block">
        <p className="text-xs leading-5 text-stone-400">Select a section to review. The current section stays highlighted while you scroll.</p>
        <button
          type="button"
          onClick={() => setHideEmpty(v => !v)}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            hideEmpty
              ? 'bg-[#b8864a]/10 border-[#b8864a]/30 text-[#8b6537]'
              : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
          }`}
        >
          <span>{hideEmpty ? '✓ Showing filled only' : 'Hide empty fields'}</span>
        </button>
      </div>
    </aside>

    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        {!hasSnapshot ? (
          <p className="text-xs text-stone-500">Labels use the available survey schema. Additional saved answers are preserved below.</p>
        ) : <div />}
        <button
          type="button"
          onClick={() => setHideEmpty(v => !v)}
          className={`xl:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            hideEmpty
              ? 'bg-[#b8864a]/10 border-[#b8864a]/30 text-[#8b6537]'
              : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
          }`}
        >
          <span>{hideEmpty ? '✓ Showing filled only' : 'Hide empty fields'}</span>
        </button>
      </div>
      {sections.map((section, index) => {
        const known = new Set(section.fields.flatMap(field => [field.key, `${field.key}__other`]));
        const fields: RecordField[] = [...section.fields, ...Object.keys(section.data).filter(key => !known.has(key)).map(key => ({ key, label: key }))];
        const filled = section.fields.filter(field => hasRecordValue(section.data[field.key]) || hasRecordValue(section.data[`${field.key}__other`])).length;
        const visibleFields = hideEmpty
          ? fields.filter(field => hasRecordValue(section.data[field.key]) || hasRecordValue(section.data[`${field.key}__other`]))
          : fields;
        return <section key={section.key} id={recordSectionId(section.key)} data-section-index={index} className="scroll-mt-24 overflow-hidden rounded-xl border border-stone-200 bg-white xl:scroll-mt-[var(--record-overview-offset)]">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:px-5">
            <h2 className="break-words text-base sm:text-lg font-semibold text-stone-800">{section.titleEn || section.title}</h2>
            <span className="shrink-0 text-sm text-stone-400 font-mono">{filled}/{section.fields.length}</span>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 p-3 sm:p-5">
            {visibleFields.map((field, fieldIndex) => {
              const isGroupStart = field.group && field.group !== visibleFields[fieldIndex - 1]?.group;
              const hasSubFields = Boolean(field.fields && field.fields.length > 0);
              const val = section.data[field.key];
              const isComplex = hasSubFields || (typeof val === 'object' && val !== null && !Array.isArray(val)) || field.type === 'textarea';
              return (
                <Fragment key={field.key}>
                  {isGroupStart && (
                    <h3 className="col-span-full pt-3 pb-1 text-xs sm:text-sm font-semibold text-[#b8864a] uppercase tracking-wider border-b border-stone-100 mb-1">
                      {field.group}
                    </h3>
                  )}
                  <div className={`min-w-0 py-1.5 px-2 rounded-md hover:bg-stone-50/70 transition-colors ${isComplex ? 'col-span-full' : 'col-span-1'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,280px)_minmax(0,1fr)] gap-1.5 sm:gap-4 items-baseline">
                      <dt className="break-words text-base text-stone-500 font-normal leading-normal">{field.labelEn || field.label}</dt>
                      <dd className="min-w-0 text-base text-stone-800 font-medium leading-normal">
                        <RecordValue value={section.data[field.key]} field={field} />
                        {hasRecordValue(section.data[`${field.key}__other`]) && (
                          <div className="mt-1"><RecordValue value={section.data[`${field.key}__other`]} /></div>
                        )}
                      </dd>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </dl>
          {!fields.length && <p className="p-4 text-base text-stone-400">No answers saved.</p>}
          {hideEmpty && fields.length > 0 && !visibleFields.length && (
            <p className="p-4 text-sm text-stone-400 italic">No filled answers in this section.</p>
          )}
        </section>;
      })}
    </div>
  </div>;
}
