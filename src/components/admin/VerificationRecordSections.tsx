'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRecordSections, hasRecordValue, parseRecordSchema, safeRecordUrl, type RecordField } from './VerificationRecordModel';

function RecordValue({ value, field, depth = 0 }: { value: unknown; field?: RecordField; depth?: number }) {
  if (!hasRecordValue(value)) return <span className="text-stone-400">—</span>;
  if (depth > 8) return <span className="break-all text-sm">{JSON.stringify(value)}</span>;
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <div key={index} className={typeof item === 'object' && item !== null ? 'rounded-lg border border-stone-200 p-3' : ''}><RecordValue value={item} field={field} depth={depth + 1} /></div>)}</div>;
  if (typeof value === 'object' && value !== null) {
    const children = field?.fields || [];
    return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => {
      const child = children.find(candidate => candidate.key === key);
      return <div key={key} className="min-w-0"><dt className="mb-0.5 break-words text-xs text-stone-500">{child?.labelEn || child?.label || key}</dt><dd><RecordValue value={item} field={child} depth={depth + 1} /></dd></div>;
    })}</dl>;
  }
  const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  const option = field?.options?.find(candidate => typeof candidate === 'string' ? candidate === text : candidate.value === text);
  const label = option && typeof option === 'object' ? option.labelEn || option.label || text : text;
  const href = field?.type === 'url' ? safeRecordUrl(text) : null;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-[#b8864a] underline">{label}</a> : <span className="whitespace-pre-wrap break-words text-sm text-stone-800 [overflow-wrap:anywhere]">{label}</span>;
}

const recordSectionId = (key: string) => `record-section-${key}`;
const decodeHash = (hash: string) => { try { return decodeURIComponent(hash); } catch { return hash; } };

export default function VerificationRecordSections({ record, schema }: { record: Record<string, unknown>; schema: unknown }) {
  const sections = useMemo(() => buildRecordSections(record, schema), [record, schema]);
  const hasSnapshot = parseRecordSchema(record.schema_snapshot).length > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveIndex(0);
    if (!sections.length) return;
    const nodes = sections.map(section => document.getElementById(recordSectionId(section.key))).filter((node): node is HTMLElement => !!node);
    if (!nodes.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveIndex(Number((visible.target as HTMLElement).dataset.sectionIndex));
    }, { rootMargin: '-18% 0px -62% 0px', threshold: [0.1, 0.35, 0.6] });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

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
    if (window.matchMedia('(min-width: 1280px)').matches) {
      nav.scrollTop += linkRect.top - navRect.top - (nav.clientHeight - link.clientHeight) / 2;
    } else {
      nav.scrollLeft += linkRect.left - navRect.left - (nav.clientWidth - link.clientWidth) / 2;
    }
  }, [activeIndex, sections]);

  if (!sections.length) return <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">No questionnaire answers saved.</p>;

  return <div className="mx-auto min-w-0 max-w-[1500px] xl:grid xl:grid-cols-[232px_minmax(0,1fr)] xl:gap-7">
    <aside className="print:hidden xl:sticky xl:top-24 xl:flex xl:max-h-[calc(100dvh-10rem)] xl:self-start xl:flex-col">
      <nav ref={navRef} aria-label="Record sections" className="flex gap-2 overflow-x-auto pb-2 xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:rounded-xl xl:border xl:border-stone-200 xl:bg-white xl:p-2">
        {sections.map((section, index) => {
          const selected = activeIndex === index;
          return <a key={section.key} href={`#${recordSectionId(section.key)}`} data-section-key={section.key} aria-current={selected ? 'location' : undefined} onClick={() => setActiveIndex(index)} className={`flex max-w-60 shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors xl:w-full xl:max-w-none ${selected ? 'border-[#b8864a]/35 bg-[#b8864a]/10 text-[#8b6537]' : 'border-stone-200 bg-white text-stone-600 hover:border-[#b8864a]/40 hover:text-[#8b6537] xl:border-transparent xl:bg-transparent'}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${selected ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-500'}`}>{index + 1}</span>
            <span className="min-w-0 whitespace-normal break-words leading-4 [overflow-wrap:anywhere]">{section.titleEn || section.title}</span>
          </a>;
        })}
      </nav>
      <p className="mt-3 hidden shrink-0 px-2 text-xs leading-5 text-stone-400 xl:block">Select a section to review. The current section stays highlighted while you scroll.</p>
    </aside>

    <div className="min-w-0 space-y-4">
      {!hasSnapshot && <p className="text-xs text-stone-500">Labels use the available survey schema. Additional saved answers are preserved below.</p>}
      {sections.map((section, index) => {
        const known = new Set(section.fields.flatMap(field => [field.key, `${field.key}__other`]));
        const fields: RecordField[] = [...section.fields, ...Object.keys(section.data).filter(key => !known.has(key)).map(key => ({ key, label: key }))];
        const filled = section.fields.filter(field => hasRecordValue(section.data[field.key]) || hasRecordValue(section.data[`${field.key}__other`])).length;
        return <section key={section.key} id={recordSectionId(section.key)} data-section-index={index} className="scroll-mt-24 overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:px-5"><h2 className="break-words text-sm font-semibold text-stone-700">{section.titleEn || section.title}</h2><span className="shrink-0 text-xs text-stone-400">{filled}/{section.fields.length}</span></div>
          <dl className="divide-y divide-stone-100">{fields.map((field, fieldIndex) => <div key={field.key} className="grid grid-cols-1 gap-1.5 px-4 py-3.5 print:break-inside-avoid sm:grid-cols-[minmax(140px,220px)_minmax(0,1fr)] sm:gap-5 sm:px-5">{field.group && field.group !== fields[fieldIndex - 1]?.group && <h3 className="mb-1 border-b border-stone-100 pb-2 text-xs font-semibold text-[#b8864a] sm:col-span-2">{field.group}</h3>}<dt className="break-words text-sm text-stone-500">{field.labelEn || field.label}</dt><dd className="min-w-0"><RecordValue value={section.data[field.key]} field={field} />{hasRecordValue(section.data[`${field.key}__other`]) && <div className="mt-1"><RecordValue value={section.data[`${field.key}__other`]} /></div>}</dd></div>)}</dl>
          {!fields.length && <p className="p-4 text-sm text-stone-400">No answers saved.</p>}
        </section>;
      })}
    </div>
  </div>;
}
