import type { VerificationData, VerificationField, VerificationSchema } from './verification';
import { validateVerification, visibleField } from './verification';

export function admissionPreviewSections(schema: VerificationSchema) {
  const sections = schema.sections.filter(section => section.phase === 'qualification');
  const allFields = sections.flatMap(section => section.fields).filter(field => !field.retired);
  const gates = allFields.filter(field => field.type === 'checkbox' && field.appearance === 'document-checklist');
  const gateKeys = new Set(gates.map(field => field.key));
  const isLinkedUpload = (field: VerificationField) => field.type === 'attachment' && !!field.visibleWhen && gateKeys.has(field.visibleWhen.field);
  return {
    checklists: sections.map(section => ({
      ...section,
      items: section.fields.filter(field => gateKeys.has(field.key)).map(field => ({
        field,
        uploads: allFields.filter(upload => isLinkedUpload(upload) && upload.visibleWhen!.field === field.key),
      })),
    })).filter(section => section.items.length),
    details: sections.map(section => ({ ...section, fields: section.fields.filter(field => !field.retired && !gateKeys.has(field.key) && !isLinkedUpload(field)) })).filter(section => section.fields.length),
  };
}

export function admissionOption(field: VerificationField): string {
  const option = field.options?.[0];
  return typeof option === 'string' ? option : option?.value || '';
}

export function admissionFileError(field: VerificationField, existing: Pick<File, 'name' | 'size' | 'type'>[], incoming: Pick<File, 'name' | 'size' | 'type'>[]): string | null {
  if (field.maxItems !== undefined && existing.length + incoming.length > field.maxItems) return `Choose up to ${field.maxItems} file${field.maxItems === 1 ? '' : 's'} for this item.`;
  const accepted = (field.accept || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
  for (const file of incoming) {
    if (file.size === 0) return `${file.name} is empty. Choose another file.`;
    if (field.maxBytes && file.size > field.maxBytes) return `${file.name} exceeds the ${Math.round(field.maxBytes / 1024 / 1024)} MB limit.`;
    if (accepted.length && !accepted.some(value => value.startsWith('.') ? file.name.toLowerCase().endsWith(value) : value.endsWith('/*') ? file.type.toLowerCase().startsWith(value.slice(0, -1)) : file.type.toLowerCase() === value)) return `${file.name} is not an accepted file type.`;
  }
  return null;
}

export function selectedAdmissionUploads(schema: VerificationSchema, data: VerificationData) {
  return admissionPreviewSections(schema).checklists.flatMap(section => section.items)
    .filter(({ field }) => Array.isArray(data[field.key]) && (data[field.key] as string[]).includes(admissionOption(field)))
    .flatMap(item => item.uploads);
}

export function admissionStepReady(schema: VerificationSchema, data: VerificationData, files: Record<string, readonly Pick<File, 'name' | 'size' | 'type'>[]>, step: number): boolean {
  const { checklists, details } = admissionPreviewSections(schema);
  const selected = checklists.flatMap(section => section.items).filter(({ field }) => Array.isArray(data[field.key]) && (data[field.key] as string[]).includes(admissionOption(field)));
  if (!selected.length || selected.some(item => !item.uploads.length)) return false;
  const requiredUploads = [...selected.flatMap(item => item.uploads), ...(step === 1 ? details.flatMap(section => section.fields).filter(field => field.type === 'attachment') : [])];
  if (requiredUploads.some(field => visibleField(field, data) && field.required && !files[field.key]?.length)) return false;
  return step !== 1 || Object.keys(validateVerification({ sections: details.map(section => ({ ...section, fields: section.fields.filter(field => field.type !== 'attachment') })) }, data)).length === 0;
}
