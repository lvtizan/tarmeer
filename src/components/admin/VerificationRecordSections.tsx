import { buildRecordSections, hasRecordValue, parseRecordSchema, safeRecordUrl, type RecordField } from './VerificationRecordModel';

function RecordValue({value, field, depth = 0}: {value: unknown; field?: RecordField; depth?: number}) {
  if (!hasRecordValue(value)) return <span className="text-stone-400">—</span>;
  if (depth > 8) return <span className="break-all text-sm">{JSON.stringify(value)}</span>;
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <div key={index} className={typeof item === 'object' && item !== null ? 'rounded-lg border border-stone-200 p-3' : ''}><RecordValue value={item} field={field} depth={depth+1}/></div>)}</div>;
  if (typeof value === 'object' && value !== null) {
    const children = field?.fields || [];
    return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => {
      const child = children.find(f => f.key === key);
      return <div key={key} className="min-w-0"><dt className="text-xs text-stone-500 mb-0.5 break-words">{child?.labelEn || child?.label || key}</dt><dd><RecordValue value={item} field={child} depth={depth+1}/></dd></div>;
    })}</dl>;
  }
  const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  const option = field?.options?.find(option => typeof option === 'string' ? option === text : option.value === text);
  const label = option && typeof option === 'object' ? option.labelEn || option.label || text : text;
  const href = field?.type === 'url' ? safeRecordUrl(text) : null;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] underline break-all">{label}</a> : <span className="text-sm text-stone-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{label}</span>;
}

export default function VerificationRecordSections({record, schema}: {record: Record<string, unknown>; schema: unknown}) {
  const sections = buildRecordSections(record, schema);
  const hasSnapshot = parseRecordSchema(record.schema_snapshot).length > 0;
  return <div className="space-y-4 min-w-0">
    {!hasSnapshot && <p className="text-xs text-stone-500">Labels use the available survey schema. Additional saved answers are preserved below.</p>}
    {sections.length > 1 && <nav aria-label="Record sections" className="flex gap-2 overflow-x-auto pb-2 print:hidden">{sections.map((section,index) => <a key={section.key} href={`#record-section-${index}`} className="shrink-0 max-w-60 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 whitespace-normal">{index+1}. {section.titleEn || section.title}</a>)}</nav>}
    {sections.map((section,index) => {
      const known = new Set(section.fields.flatMap(field => [field.key,`${field.key}__other`]));
      const fields: RecordField[] = [...section.fields,...Object.keys(section.data).filter(key => !known.has(key)).map(key => ({key,label:key}))];
      const filled = section.fields.filter(field => hasRecordValue(section.data[field.key]) || hasRecordValue(section.data[`${field.key}__other`])).length;
      return <section key={section.key} id={`record-section-${index}`} className="scroll-mt-20 rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-stone-700 break-words">{section.titleEn || section.title}</h2><span className="text-xs text-stone-400 shrink-0">{filled}/{section.fields.length}</span></div>
        <dl className="divide-y divide-stone-100">{fields.map((field,fieldIndex) => <div key={field.key} className="grid grid-cols-1 sm:grid-cols-[minmax(140px,220px)_minmax(0,1fr)] gap-1.5 sm:gap-5 px-4 sm:px-5 py-3.5 print:break-inside-avoid">{field.group && field.group !== fields[fieldIndex-1]?.group && <h3 className="sm:col-span-2 text-xs font-semibold text-[#b8864a] border-b border-stone-100 pb-2 mb-1">{field.group}</h3>}<dt className="text-sm text-stone-500 break-words">{field.labelEn || field.label}</dt><dd className="min-w-0"><RecordValue value={section.data[field.key]} field={field}/>{hasRecordValue(section.data[`${field.key}__other`]) && <div className="mt-1"><RecordValue value={section.data[`${field.key}__other`]}/></div>}</dd></div>)}</dl>
        {!fields.length && <p className="p-4 text-sm text-stone-400">No answers saved.</p>}
      </section>;
    })}
    {!sections.length && <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-500">No questionnaire answers saved.</p>}
  </div>;
}
