export interface VerificationField {
  key: string; label: string; labelEn?: string; type: string; options?: (string | {label:string; value:string})[];
  required?: boolean; min?: number; max?: number; step?: number; placeholder?: string; help?: string;
  group?: string; groupKey?:string; role?: string; accept?:string; maxBytes?:number; maxItems?:number; visibleWhen?: {field:string; values?:string[]; not?:boolean; notEmpty?:boolean; excludeValues?:string[]};
  copyFrom?: string; copyLabel?: string; fields?: VerificationField[]; exclusiveValue?: string;
}
export interface VerificationSection {key:string; title:string; titleEn?:string; description?:string; fields:VerificationField[];}
export interface VerificationSchema {version:string; country:string; title?:string; sections:VerificationSection[];}
export type VerificationValue = string | string[] | Record<string,unknown>[];
export type VerificationData = Record<string, VerificationValue>;
export interface VerificationEvidence {name:string; url:string; type:string; size?:number; field_key?:string;}
export interface VerificationRecord {id:number; country?:string; company_name?:string; company_ref_id?:number|null; company_ref_source?:string|null; schema_version?:string; schema_snapshot?:VerificationSchema|string|null; verification_data?:VerificationData|string|null; attachments?:VerificationEvidence[]|string|null; [key:string]:unknown;}
export function parseVerificationData(raw: unknown): VerificationData {
  if (raw === null || raw === undefined) return {};
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Saved answers are invalid. Please contact an administrator.');
  const normalize = (entry: unknown): VerificationValue => {
    if (entry === null) return '';
    if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
    if (Array.isArray(entry)) {
      if (entry.every(item => typeof item === 'string')) return entry as string[];
      if (entry.every(item => item && typeof item === 'object' && !Array.isArray(item))) return entry.map(item => Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, normalize(nested)])));
    }
    throw new Error('Saved answers contain an invalid value. Please contact an administrator.');
  };
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
}
export function visibleField(field:VerificationField, data:VerificationData):boolean {
  if (!field.visibleWhen) return true;
  const rule=field.visibleWhen; const value=data[rule.field];
  const present=rule.excludeValues ? (Array.isArray(value) && value.some(v=>typeof v==='string'&&!rule.excludeValues!.includes(v))) : rule.values ? rule.values.some(v=>Array.isArray(value)?value.includes(v as never):value===v) : typeof value==='string'?!!value.trim():Array.isArray(value)?value.length>0:false;
  return rule.not ? !present : present;
}
export function validateVerification(schema: Pick<VerificationSchema,'sections'>, data:VerificationData):Record<string,string> {
  const errors:Record<string,string>={};
  for(const section of schema.sections) for(const field of section.fields) {
    if(!visibleField(field,data)) continue;
    const value=data[field.key]; const blank=value===undefined || value===null || (typeof value==='string'? !value.trim():value.length===0);
    if(field.required && blank) errors[field.key]='This field is required.';
    if(blank) continue;
    if(field.type==='number') {
      const n=Number(value); if(!Number.isFinite(n)||(field.min!==undefined&&n<field.min)||(field.max!==undefined&&n>field.max)||(field.step===1&&!Number.isInteger(n))) errors[field.key]='Enter a valid number within the allowed range.';
    }
    if(field.type==='email' && typeof value==='string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key]='Enter a valid email address.';
    if(field.type==='url' && typeof value==='string') {try {const url=new URL(value);if(!['http:','https:'].includes(url.protocol)) throw Error();} catch {errors[field.key]='Enter a complete http:// or https:// URL.';}}
  }
  return errors;
}
export function copyVerificationFields(data:VerificationData,mapping:Record<string,string>):VerificationData {const result={...data};for(const [target,source] of Object.entries(mapping)) result[target]=data[source]??'';return result;}
export function safeEvidenceUrl(raw:string):string|undefined {if(/^\/uploads\//.test(raw))return raw;try {const u=new URL(raw);if(u.protocol==='https:'||u.protocol==='http:')return raw;}catch{}return undefined;}
export function getVerificationCountry():string {
  if(typeof window==='undefined')return 'ae';
  for(const key of ['field_user','admin_user']) {try {const u=JSON.parse(localStorage.getItem(key)||'null');if(['ae','vn','sa'].includes(u?.country))return u.country;}catch{}}
  return window.location.hostname.startsWith('vn.')?'vn':window.location.hostname.startsWith('sa.')?'sa':'ae';
}

/** Only a confirmed missing record may invalidate saved draft references. */
export async function restoreStoredVerificationDraft(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  country: string,
  load: (id: number) => Promise<{ draft: VerificationRecord | null }>,
  clearAccess: (id: number) => void,
): Promise<VerificationRecord | null> {
  const countryKey = `field_draft_id_${country}`;
  const stored = storage.getItem(countryKey) || storage.getItem('field_draft_id');
  if (!stored || !Number.isSafeInteger(Number(stored)) || Number(stored) <= 0) return null;
  const id = Number(stored);
  try {
    const response = await load(id);
    return response.draft;
  } catch (error) {
    if (!error || typeof error !== 'object' || !('status' in error) || error.status !== 404) throw error;
    for (const key of [countryKey, 'field_draft_id']) {
      if (storage.getItem(key) === stored) storage.removeItem(key);
    }
    clearAccess(id);
    return null;
  }
}

export interface VerificationAuth { key: 'field_token' | 'admin_token'; token: string; }
export function captureVerificationAuth(storage: Pick<Storage, 'getItem'>): VerificationAuth | null {
  for (const key of ['field_token', 'admin_token'] as const) {
    const token = storage.getItem(key);
    if (token) return { key, token };
  }
  return null;
}
export function verificationUnauthorized(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error && error.status === 401;
}
export function verificationSignInUrl(editingId: number | null): string {
  const returnPath = editingId ? `/field/survey?edit=${editingId}` : '/field/survey';
  return `/field/login?return=${encodeURIComponent(returnPath)}`;
}
export function recoverVerificationAuthentication(
  error: unknown,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  selected: VerificationAuth | null,
  editingId: number | null,
): string | null {
  if (!verificationUnauthorized(error)) return null;
  // Preserve draft IDs, saved answers, capability credentials, and another login session.
  if (selected && storage.getItem(selected.key) === selected.token) storage.removeItem(selected.key);
  return verificationSignInUrl(editingId);
}
