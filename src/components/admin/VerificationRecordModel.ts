export interface RecordField {
  key: string;
  label: string;
  labelEn?: string;
  type?: string;
  group?: string;
  groupKey?: string;
  fields?: RecordField[];
  options?: Array<string | { value: string; label?: string; labelEn?: string }>;
}
export interface RecordSection { key: string; title: string; titleEn?: string; fields: RecordField[] }
export interface RecordSectionView extends RecordSection { data: Record<string, unknown> }
export function parseRecordJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}
export function parseRecordObject(raw: unknown): Record<string, unknown> {
  const value = parseRecordJson(raw);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function normalizeFields(raw: unknown, depth = 0): RecordField[] {
  if (!Array.isArray(raw) || depth > 8) return [];
  return raw.filter((field): field is RecordField => Boolean(field && typeof field === 'object' && typeof field.key === 'string' && typeof field.label === 'string')).map(field => ({
    ...field,
    fields: normalizeFields(field.fields, depth + 1),
    options: Array.isArray(field.options) ? field.options.filter(option => typeof option === 'string' || Boolean(option && typeof option === 'object' && typeof option.value === 'string')) : [],
  }));
}
export function parseRecordSchema(raw: unknown): RecordSection[] {
  const value = parseRecordJson(raw);
  const sections = Array.isArray(value) ? value : parseRecordObject(value).sections;
  if (!Array.isArray(sections)) return [];
  return sections.filter((section): section is RecordSection => Boolean(section && typeof section === 'object' && typeof section.key === 'string' && typeof section.title === 'string' && Array.isArray(section.fields)))
    .map(section => ({...section, fields: normalizeFields(section.fields)}));
}
export function hasRecordValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.some(hasRecordValue);
  if (typeof value === 'object') return Object.values(value).some(hasRecordValue);
  return true;
}
export function buildRecordSections(record: Record<string, unknown>, schema: unknown): RecordSectionView[] {
  const sections = parseRecordSchema(schema);
  const verification = parseRecordObject(record.verification_data);
  const v7 = typeof record.schema_version === 'string' && record.schema_version !== 'legacy' || Object.keys(verification).length > 0;
  const result = sections.map(section => {
    // V7 answers are flat, but each section must own only its declared keys.
    // Globally unmapped answers are rendered once in the dedicated section below.
    const owned = new Set(section.fields.flatMap(field => [field.key, `${field.key}__other`]));
    const data = v7 ? Object.fromEntries(Object.entries(verification).filter(([key]) => owned.has(key))) : parseRecordObject(record[section.key]);
    return {...section, data};
  });
  if (v7) {
    const known = new Set(sections.flatMap(section => section.fields.flatMap(field => [field.key, `${field.key}__other`])));
    const unknown = Object.fromEntries(Object.entries(verification).filter(([key]) => !known.has(key)));
    if (Object.keys(unknown).length) result.push({key:'__unmapped',title:'Additional saved answers',fields:Object.keys(unknown).map(key => ({key,label:key})),data:unknown});
  } else {
    for (const [key, raw] of Object.entries(record)) {
      if (!/^section_\d+$/.test(key) || key === 'section_9' || sections.some(section => section.key === key)) continue;
      const data = parseRecordObject(raw);
      if (Object.keys(data).length) result.push({key,title:key,fields:[],data});
    }
  }
  return result;
}
export function safeRecordUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw || /[\u0000-\u0020\\]/.test(raw)) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? raw : null; } catch { return null; }
}
export interface RecordFile {url: string; name?: string; type?: string; size?: number; field_key?: string}
export function parseRecordFiles(raw: unknown): RecordFile[] {
  const value = parseRecordJson(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((file): file is RecordFile => Boolean(file && typeof file === 'object' && safeRecordUrl(file.url)));
}

// Explicit public record allowlist: never export auth, capability, or server-only secrets.
export function exportRecordPayload(record: Record<string, unknown>, schema: unknown): Record<string, unknown> {
  const safeKeys = ['id', 'company_name', 'interviewer_name', 'linked_company_name', 'company_ref_id', 'company_ref_source', 'status', 'country', 'submitted_at', 'created_at', 'filled_by', 'schema_version', 'verification_data', 'location_pin'];
  const result = Object.fromEntries(Object.entries(record).filter(([key]) => safeKeys.includes(key) || /^section_\d+$/.test(key)));
  result.photos = parseRecordFiles(record.photos);
  result.attachments = parseRecordFiles(record.attachments);
  result.schema_snapshot = parseRecordSchema(record.schema_snapshot).length ? parseRecordJson(record.schema_snapshot) : parseRecordJson(schema);
  return result;
}

export interface RecordServiceArea { emirate: string; sectors: Array<{group: string; districts: string[]}> }
export function parseRecordServiceAreas(raw: unknown): RecordServiceArea[] {
  const parsed = parseRecordJson(raw);
  const obj: Record<string, unknown> = Array.isArray(parsed) ? {areas:parsed} : parseRecordObject(parsed);
  const list = Array.isArray(obj.areas) ? obj.areas : obj.emirate || obj.districts || obj.sectors ? [obj] : [];
  const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const districts = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  return list.map(value => {
    const area = parseRecordObject(value);
    const sectors = Array.isArray(area.sectors) ? area.sectors.map(value => {const sector = parseRecordObject(value); return {group: text(sector.group), districts: districts(sector.districts)};}) : [{group:text(area.group),districts: districts(area.districts).length ? districts(area.districts) : text(area.district) ? [text(area.district)] : []}];
    return {emirate:text(area.emirate),sectors};
  }).filter(area => area.emirate || area.sectors.some(sector => sector.districts.length > 0));
}
