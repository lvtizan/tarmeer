export interface VerificationInputPolicy {kind:string;minLength?:number;maxLength?:number;min?:number;max?:number;precision?:number;integer?:boolean;country?:string;requireLetter?:boolean;allowHandle?:boolean;allowNewlines?:boolean;}
export interface VerificationField {
  inputPolicy?:VerificationInputPolicy;
  key: string; label: string; labelEn?: string; type: string; options?: (string | {label:string; value:string})[];
  datePolicy?: {minYear:number;maxYearsFromToday:number;timeZone:string};
  yearPolicy?: {min:number;maxCurrentYear:boolean;timeZone:string};
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
export function validateVerification(schema: Pick<VerificationSchema,'sections'>, data:VerificationData, referenceDate:Date=new Date(), complete=true):Record<string,string> {
  const errors:Record<string,string>={};
  for(const section of schema.sections) for(const field of section.fields) {
    if(!visibleField(field,data)) continue;
    const value=data[field.key]; const blank=value===undefined || value===null || (typeof value==='string'? !value.trim():value.length===0);
    if(complete && field.required && blank) errors[field.key]='This field is required.';
    if(blank) continue;
    if(field.type==='radio' && !(field.options||[]).some(option=>(typeof option==='string'?option:option.value)===value)) errors[field.key]='Select a valid option.';
    if(field.type==='checkbox' && (!Array.isArray(value)||new Set<unknown>(value).size!==value.length||(field.exclusiveValue&&value.includes(field.exclusiveValue as never)&&value.length>1)||value.some(entry=>!(field.options||[]).some(option=>(typeof option==='string'?option:option.value)===entry)))) errors[field.key]='Select valid options.';
    if(field.type==='repeat') {
      if(!Array.isArray(value)||value.length>(field.maxItems||30)||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))errors[field.key]='Enter valid rows within the allowed limit.';
      else for(const row of value){const invalid=validateVerification({sections:[{key:'',title:'',fields:field.fields||[]}]},row as VerificationData,referenceDate,false);const child=(field.fields||[]).find(item=>invalid[item.key]);if(child){errors[field.key]=`${child.labelEn||child.label}: ${invalid[child.key]}`;break;}}
    }
    if(field.type==='number') {
      const bounds=verificationFieldBounds(field,referenceDate);
      const n=Number(value); if(!Number.isFinite(n)||(bounds.min!==undefined&&n<Number(bounds.min))||(bounds.max!==undefined&&n>Number(bounds.max))||(verificationInputStep(field)===1&&!Number.isInteger(n))||(field.yearPolicy&&!/^\d{4}$/.test(String(value)))) errors[field.key]=field.yearPolicy?'Enter a four-digit year within the allowed range.':'Enter a valid number within the allowed range.';
    }
    if(field.type==='date' && typeof value==='string') {
      const bounds=verificationFieldBounds(field,referenceDate);
      if(!strictVerificationDate(value)) errors[field.key]='Enter a valid date with a four-digit year.';
      else if((bounds.min!==undefined&&value<String(bounds.min))||(bounds.max!==undefined&&value>String(bounds.max))) errors[field.key]=`Enter a date between ${bounds.min||'the minimum date'} and ${bounds.max||'the maximum date'}.`;
    }
    if(field.type==='email' && typeof value==='string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) errors[field.key]='Enter a valid email address.';
    if(field.type==='url' && typeof value==='string') {try {const url=new URL(value);if(!['http:','https:'].includes(url.protocol)) throw Error();} catch {errors[field.key]='Enter a complete http:// or https:// URL.';}}
    const policyError=validateVerificationInput(field,value);if(policyError)errors[field.key]=policyError;
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

export interface VerificationIssue { key: string; label: string; message: string; step: number; }
export function verificationFieldIssue(schema: Pick<VerificationSchema, 'sections'>, key: string, message: string): VerificationIssue | null {
  for (let step = 0; step < schema.sections.length; step++) {
    const field = schema.sections[step].fields.find(candidate => candidate.key === key);
    if (field) return { key, label: field.labelEn || field.label, message, step };
  }
  return null;
}
/** Match server validation to metadata; ambiguous labels and transport errors stay general. */
export function resolveVerificationIssue(schema: Pick<VerificationSchema, 'sections'>, data: VerificationData, error: unknown, knownKey?: string): VerificationIssue | null {
  if (!error || typeof error !== 'object' || !('status' in error) || ![400, 413, 415, 422].includes(Number(error.status))) return null;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  if ('fieldKey' in error && typeof error.fieldKey === 'string') {
    const explicit = verificationFieldIssue(schema, error.fieldKey, message);
    if (explicit) return explicit;
  }
  if (knownKey) return verificationFieldIssue(schema, knownKey, message);
  const candidates: { key: string; field: VerificationField; row?: Record<string, unknown>; matchedLength: number }[] = [];
  for (const section of schema.sections) for (const field of section.fields) {
    const match = (candidate: VerificationField, row?: Record<string, unknown>) => {
      const labels = [candidate.labelEn, candidate.label].filter((label): label is string => !!label);
      const matched = labels.filter(label => message.startsWith(`${label}:`) || message === `${label} is required.`);
      if (matched.length) candidates.push({ key: field.key, field: candidate, row, matchedLength: Math.max(...matched.map(label => label.length)) });
    };
    match(field);
    if (field.type === 'repeat' && Array.isArray(data[field.key])) for (const row of data[field.key]) {
      if (row && typeof row === 'object') for (const child of field.fields || []) match(child, row);
    }
  }
  const longest = Math.max(0, ...candidates.map(candidate => candidate.matchedLength));
  const matches = candidates.filter(candidate => candidate.matchedLength === longest);
  const invalid = validateVerification(schema, data);
  const invalidMatches = matches.filter(candidate => candidate.row
    ? validateVerification({ sections: [{ key: '', title: '', fields: [candidate.field] }] }, candidate.row as VerificationData)[candidate.field.key]
    : invalid[candidate.key]);
  const selected = matches.length === 1 ? matches[0] : invalidMatches.length === 1 ? invalidMatches[0] : null;
  if (!selected) return null;
  const issue = verificationFieldIssue(schema, selected.key, message);
  if (issue && selected.row) issue.label = `${issue.label} / ${selected.field.labelEn || selected.field.label}`;
  return issue;
}
export function focusVerificationField(root: Pick<Document, 'querySelectorAll'>, key: string): boolean {
  // Match data attributes directly so database-controlled keys cannot alter a selector.
  const field = Array.from(root.querySelectorAll<HTMLElement>('.verification-current [data-field-key]')).find(node => node.dataset.fieldKey === key);
  if (!field) return false;
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const control = field.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),[tabindex="-1"]');
  (control || field).focus({ preventScroll: true });
  return true;
}


export function verificationIssueFocusKey(schema: Pick<VerificationSchema, 'sections'>, data: VerificationData, issue: VerificationIssue): string {
  const fields = schema.sections.flatMap(section => section.fields);
  let field = fields.find(candidate => candidate.key === issue.key);
  const visited = new Set<string>();
  while (field && !visibleField(field, data) && field.visibleWhen && !visited.has(field.key)) {
    visited.add(field.key);
    field = fields.find(candidate => candidate.key === field!.visibleWhen!.field);
  }
  return field?.key || issue.key;
}


export function strictVerificationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function verificationFieldBounds(field: VerificationField, referenceDate: Date = new Date()): {min?:string|number;max?:string|number} {
  const policy = field.datePolicy || field.yearPolicy;
  if (!policy) return { min: field.inputPolicy?.min??field.min, max: field.inputPolicy?.max??field.max };
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: policy.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(referenceDate);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value);
  const year = part('year');
  if (field.yearPolicy) return { min: field.yearPolicy.min, max: field.yearPolicy.maxCurrentYear ? year : field.max };
  const datePolicy = field.datePolicy!;
  const month = part('month');
  const maxYear = year + datePolicy.maxYearsFromToday;
  // Keep a valid calendar date when a leap day rolls into a non-leap year.
  const finalDay = new Date(Date.UTC(maxYear, month, 0)).getUTCDate();
  const day = Math.min(part('day'), finalDay);
  return { min: `${datePolicy.minYear}-01-01`, max: `${maxYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}


export function verificationInputStep(field: VerificationField): number | undefined {
  const policy=field.inputPolicy;
  return policy?.integer ? 1 : policy?.precision !== undefined ? 10 ** -policy.precision : field.step;
}
export function validVerificationWebLink(value: string, kind: string): boolean {
  if (/\s|[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url=new URL(value);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return false;
    if (kind==='website') return url.hostname.includes('.')&&!url.hostname.endsWith('.localhost');
    if(url.port&&!['80','443'].includes(url.port))return false;
    const host=url.hostname.toLowerCase();
    if (host==='maps.app.goo.gl') return /^\/[^/]+/.test(url.pathname);
    if (host==='goo.gl') return /^\/maps\/[^/]+/.test(url.pathname);
    if (['google.com','google.ae','google.co.uk','google.de','google.fr'].includes(host) || ['www.google.com','www.google.ae','www.google.co.uk','www.google.de','www.google.fr'].includes(host)) return /^\/maps(?:\/|$)/.test(url.pathname);
    return ['maps.google.com','maps.google.ae','maps.google.co.uk'].includes(host);
  } catch {return false;}
}
export function validVerificationPhone(value: string, country?: string): boolean {
  const normalized=value.replace(/[٠-٩۰-۹]/g,char=>String(char.charCodeAt(0)-(char>='۰'?0x06F0:0x0660)));
  if (/[\u0000-\u001f\u007f]/.test(normalized) || !/^[\d\s+().-]+$/.test(normalized)) return false;
  let compact=normalized.replace(/[\s().-]/g,'');
  if(country!=='ae')return false;
  if(compact.startsWith('+971'))compact=compact.slice(4);
  else if(compact.startsWith('00971'))compact=compact.slice(5);
  else if(compact.startsWith('0'))compact=compact.slice(1);
  else return false;
  if(!/^(?:5[024568]\d{7}|[234679]\d{7})$/.test(compact))return false;
  return !/^0+$/.test(compact.slice(compact.startsWith('5')?2:1));
}
export function validateVerificationInput(field: VerificationField, value: VerificationValue): string | undefined {
  const policy=field.inputPolicy;if(!policy)return;
  const text=typeof value==='string'?value.trim():'';
  if(['count','amount','area'].includes(policy.kind)) {
    const raw=String(value);
    if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) || (policy.integer&&!Number.isInteger(Number(raw))) || (policy.precision!==undefined && (raw.split('.')[1]?.length||0)>policy.precision) || (policy.min!==undefined&&Number(raw)<policy.min) || (policy.max!==undefined&&Number(raw)>policy.max)) return 'Enter a plain number within the allowed range and precision.';
    return;
  }
  if(['choice','choices','attachment','repeat','date','year'].includes(policy.kind))return;
  if(typeof value!=='string')return 'Enter valid text.';
  const length=Array.from(text).length;
  if(policy.minLength!==undefined&&length<policy.minLength)return `Enter at least ${policy.minLength} characters.`;
  if(policy.maxLength!==undefined&&length>policy.maxLength)return `Use no more than ${policy.maxLength} characters.`;
  const controls=policy.allowNewlines?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/;
  if(controls.test(value))return 'Remove unsupported control characters.';
  if(policy.requireLetter&&!/\p{L}/u.test(text))return 'Include meaningful text, not only numbers or punctuation.';
  if(policy.kind==='identifier'&&(!/^[\p{L}\p{N} ./#_-]+$/u.test(text)||!/[\p{L}\p{N}]/u.test(text)))return 'Enter an identifier using letters or numbers and standard separators.';
  if(policy.kind==='phone'&&!validVerificationPhone(text,policy.country))return 'Enter a valid UAE mobile or landline number, including its country or local prefix.';
  if(['website','map'].includes(policy.kind)&&!(policy.kind==='website'&&policy.allowHandle&&/^@[\p{L}\p{N}_.-]{1,64}$/u.test(text))&&!validVerificationWebLink(text,policy.kind))return policy.kind==='map'?'Enter a valid Google Maps link.':'Enter a complete http:// or https:// website link.';
}

export interface VerificationPendingIdentity {id:number;country:string;version:string;}
export interface VerificationPending {
  identity:VerificationPendingIdentity;data:VerificationData;removedEvidenceUrls?:string[];changedKeys:string[];evidence?:VerificationEvidence[];evidenceChanged:boolean;revision:number;writeId:string;
}
export function verificationPendingKey(identity:VerificationPendingIdentity):string {return `tarmeer_verification_pending_${encodeURIComponent(identity.country)}_${identity.id}_${encodeURIComponent(identity.version)}`;}
export function restoreVerificationPending(storage:Pick<Storage,'getItem'>,identity:VerificationPendingIdentity,serverData:VerificationData,serverEvidence:VerificationEvidence[],allowedKeys?:ReadonlySet<string>|ReadonlyMap<string,VerificationField>):{data:VerificationData;evidence:VerificationEvidence[];pending:VerificationPending|null} {
  const raw=storage.getItem(verificationPendingKey(identity));if(!raw)return {data:serverData,evidence:serverEvidence,pending:null};
  const pending=JSON.parse(raw) as VerificationPending;
  if(!pending||pending.identity?.id!==identity.id||pending.identity.country!==identity.country||pending.identity.version!==identity.version||!Array.isArray(pending.changedKeys)||pending.changedKeys.some(key=>typeof key!=='string')||!Number.isSafeInteger(pending.revision)||typeof pending.writeId!=='string'||typeof pending.evidenceChanged!=='boolean')throw Error('The local draft recovery data is invalid.');
  if(allowedKeys&&pending.changedKeys.some(key=>!allowedKeys.has(key)))throw Error('The local recovery fields no longer match this questionnaire.');
  const stored=parseVerificationData(pending.data);const data={...serverData};
  function checkNested(field:VerificationField|undefined,value:VerificationValue){if(field?.type!=='repeat'||!Array.isArray(value))return;const children=new Map((field.fields||[]).map(child=>[child.key,child]));for(const row of value){if(row&&typeof row==='object'){for(const key of Object.keys(row)){if(!children.has(key))throw Error('The local recovery row fields no longer match this questionnaire.');checkNested(children.get(key),row[key] as VerificationValue);}}}}
  if(allowedKeys&&'get' in allowedKeys)for(const key of pending.changedKeys)checkNested(allowedKeys.get(key),stored[key]);
  for(const key of pending.changedKeys){if(!Object.hasOwn(stored,key))throw Error('The local draft recovery data is incomplete.');data[key]=stored[key];}
  if(pending.evidenceChanged&&(!Array.isArray(pending.evidence)||pending.evidence.some(file=>!file||typeof file.url!=='string'||typeof file.name!=='string')))throw Error('The local evidence recovery data is invalid.');
  if(pending.removedEvidenceUrls!==undefined&&(!Array.isArray(pending.removedEvidenceUrls)||pending.removedEvidenceUrls.some(url=>typeof url!=='string')))throw Error('The local evidence removal data is invalid.');
  return {data,evidence:pending.evidenceChanged?(pending.removedEvidenceUrls?verificationEvidenceRemovalPatch(serverEvidence,pending.removedEvidenceUrls):pending.evidence!):serverEvidence,pending};
}
export function writeVerificationPending(storage:Pick<Storage,'setItem'>,pending:VerificationPending):void {
  const changedData=Object.fromEntries(pending.changedKeys.map(key=>[key,pending.data[key]]));
  storage.setItem(verificationPendingKey(pending.identity),JSON.stringify({...pending,data:changedData}));
}
export function clearVerificationPending(storage:Pick<Storage,'getItem'|'removeItem'>,identity:VerificationPendingIdentity,writeId?:string):boolean {
  const key=verificationPendingKey(identity);if(writeId!==undefined){const raw=storage.getItem(key);if(!raw)return false;if(JSON.parse(raw).writeId!==writeId)return false;}
  storage.removeItem(key);return true;
}

/** Deduplicate one revision and keep mutations ordered; immediate operations coalesce per turn. */
export function createVerificationSaveQueue() {
  let serial:Promise<unknown>=Promise.resolve();const operations=new Map<number,Promise<unknown>>();let scheduled=false;
  return {
    existing(revision:number){return operations.get(revision);},
    run(revision:number,operation:()=>Promise<unknown>){
      const previous=operations.get(revision);if(previous)return previous;
      const next=serial.catch(()=>{}).then(operation);serial=next;operations.set(revision,next);
      void next.then(()=>operations.delete(revision),()=>operations.delete(revision));return next;
    },
    wait(){return serial;},
    flush(callback:()=>void){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;callback();});},
  };
}

export function finishVerificationDraft(storage:Pick<Storage,'getItem'|'removeItem'>,identity:VerificationPendingIdentity,writeId:string|undefined,isDraft:boolean):void {
  if(writeId!==undefined)clearVerificationPending(storage,identity,writeId);
  if(isDraft)for(const key of ['field_draft_id',`field_draft_id_${identity.country}`])if(storage.getItem(key)===String(identity.id))storage.removeItem(key);
}

export function verificationDraftPatch(schema:Pick<VerificationSchema,'sections'>,data:VerificationData,changedKeys:Iterable<string>,removedUrls:Iterable<string>=[]):{verification_data:VerificationData;company_name?:string;removed_attachment_urls?:string[]} {
  const keys=new Set(changedKeys);const patch:{verification_data:VerificationData;company_name?:string;removed_attachment_urls?:string[]}={verification_data:Object.fromEntries([...keys].map(key=>[key,data[key]]))};
  const companyField=schema.sections.flatMap(section=>section.fields).find(field=>field.role==='company_name');
  if(companyField&&keys.has(companyField.key)&&typeof data[companyField.key]==='string')patch.company_name=data[companyField.key] as string;
  const removed=[...new Set(removedUrls)];if(removed.length)patch.removed_attachment_urls=removed;
  return patch;
}
export function verificationEvidenceRemovalPatch(serverEvidence:VerificationEvidence[],removedUrls:Iterable<string>):VerificationEvidence[] {
  const removed=new Set(removedUrls);return serverEvidence.filter(file=>!removed.has(file.url));
}
