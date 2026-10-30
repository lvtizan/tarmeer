'use client';

import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, LockKeyhole, Paperclip, Upload, X } from 'lucide-react';
import { VerificationFields } from './verification-field';
import TarmeerLogo from '@/components/TarmeerLogo';
import admissionLetter from '@/content/contractor-admission-letter.json';
import { admissionFileError, admissionOption, admissionPreviewSections, admissionStepReady, selectedAdmissionUploads } from '@/lib/admission-preview';
import { validateVerification, verificationReviewText, visibleField, type VerificationData, type VerificationField, type VerificationSchema, type VerificationValue } from '@/lib/verification';

type LocalFiles = Record<string, File[]>;
const primary = 'inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#b8864a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#a07640] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b8864a]';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm hover:border-[#b8864a]';
const labelFor = (field: VerificationField) => field.labelEn || field.label;

function LocalUpload({ field, files, error, onFiles, onRemove }: { field: VerificationField; files: File[]; error?: string; onFiles: (files: File[]) => void; onRemove: (index: number) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return <div data-upload-field={field.key} className="min-w-0 pt-4">
    <p className="mb-3 text-sm font-medium text-stone-700">{labelFor(field)}</p>
    <button type="button" className={primary} onClick={() => input.current?.click()} aria-label={`Choose files for ${labelFor(field)}`} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} aria-invalid={!!error}><Upload size={16} aria-hidden="true" />Choose files</button>
    <input ref={input} id={id} type="file" hidden accept={field.accept} multiple={(field.maxItems || 1) > 1} aria-label={`Local files for ${labelFor(field)}`} onChange={event => { const selected = Array.from(event.target.files || []); if (selected.length) onFiles(selected); event.target.value = ''; }} />
    <p id={`${id}-hint`} className="mt-2 break-words text-xs leading-5 text-stone-500">{(field.accept || '').split(',').map(type => type.replace('application/', '').replace('image/', '').toUpperCase()).join(' / ')}{field.maxItems ? ` · Up to ${field.maxItems} file${field.maxItems === 1 ? '' : 's'}` : ''}{field.maxBytes ? ` · ${Math.round(field.maxBytes / 1024 / 1024)} MB each` : ''}</p>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1 text-sm"><Paperclip size={15} className="shrink-0 text-[#a07640]" aria-hidden="true" /><span className="min-w-0 flex-1 break-all">{file.name}</span><span className="hidden text-xs text-stone-500 sm:inline">Selected locally</span><button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`} className="flex size-11 shrink-0 items-center justify-center rounded hover:bg-stone-100"><X size={16} aria-hidden="true" /></button></li>)}</ul>}
  </div>;
}

export default function AdmissionPreview({ schema }: { schema: VerificationSchema }) {
  const [data, setData] = useState<VerificationData>({});
  const [files, setFiles] = useState<LocalFiles>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const { checklists, details } = admissionPreviewSections(schema);
  const items = checklists.flatMap(section => section.items);
  const selected = items.filter(({ field }) => Array.isArray(data[field.key]) && (data[field.key] as string[]).includes(admissionOption(field)));
  const canAdvance = admissionStepReady(schema, data, files, step);

  function go(next: number) {
    setStep(next);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  }
  function change(key: string, value: VerificationValue) {
    setData(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  }
  function toggle(field: VerificationField, checked: boolean, uploads: VerificationField[]) {
    change(field.key, checked ? [admissionOption(field)] : []);
    if (!checked) {
      setFiles(previous => { const next = { ...previous }; for (const upload of uploads) delete next[upload.key]; return next; });
      setErrors(previous => { const next = { ...previous }; for (const upload of uploads) delete next[upload.key]; return next; });
    }
  }
  function choose(field: VerificationField, incoming: File[]) {
    const error = admissionFileError(field, files[field.key] || [], incoming);
    setErrors(previous => { const next = { ...previous }; if (error) next[field.key] = error; else delete next[field.key]; return next; });
    if (!error) setFiles(previous => ({ ...previous, [field.key]: [...(previous[field.key] || []), ...incoming] }));
  }
  function remove(field: VerificationField, index: number) {
    setFiles(previous => ({ ...previous, [field.key]: (previous[field.key] || []).filter((_, item) => item !== index) }));
    setErrors(previous => { const next = { ...previous }; delete next[field.key]; return next; });
  }
  function validateDetail(key: string) {
    const invalid = validateVerification({ sections: details.map(section => ({ ...section, fields: section.fields.filter(field => field.type !== 'attachment') })) }, data);
    setErrors(previous => { const next = { ...previous }; if (invalid[key]) next[key] = invalid[key]; else delete next[key]; return next; });
  }
  function advance() {
    if (!canAdvance) return;
    const nextErrors: Record<string, string> = {};
    const uploadFields = [...selectedAdmissionUploads(schema, data), ...(step === 1 ? details.flatMap(section => section.fields).filter(field => field.type === 'attachment') : [])];
    for (const field of uploadFields) if (visibleField(field, data) && field.required && !files[field.key]?.length) nextErrors[field.key] = 'Choose the corresponding file before continuing.';
    if (step === 1) Object.assign(nextErrors, validateVerification({ sections: details.map(section => ({ ...section, fields: section.fields.filter(field => field.type !== 'attachment') })) }, data));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (selectedAdmissionUploads(schema, data).some(field => nextErrors[field.key])) go(0);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    go(step + 1);
  }

  return <div className="min-h-screen bg-[#faf9f7] text-stone-800">
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8"><TarmeerLogo /><span className="rounded-full border border-[#b8864a]/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#906a3b]">Design preview</span></div></header>
    <div role="note" aria-label="Preview information" className="border-b border-[#b8864a]/15 bg-[#f3eee6]"><p className="mx-auto max-w-4xl px-5 py-3 text-[13px] leading-6 text-stone-600 sm:px-8">Preview only. Files stay in this browser tab; nothing is submitted. Refreshing clears your selections.</p></div>
    <main className="mx-auto max-w-4xl px-5 pb-48 pt-6 sm:px-8 sm:pt-8">
        <div className="min-w-0">
          <h1 ref={heading} tabIndex={-1} style={step === 0 ? { fontFamily: '"Times New Roman", Times, serif' } : undefined} className={`scroll-mt-28 outline-none ${step === 0 ? 'mx-auto w-full pt-3 text-center text-[28px] font-bold leading-[1.08] tracking-[-0.025em] text-stone-900 sm:pt-5 sm:text-[38px] lg:text-[42px]' : 'font-serif text-4xl leading-tight tracking-tight sm:text-5xl'}`}>{step === 0 ? admissionLetter.title.split(' — ').map((line, index) => <span key={line} className="block">{index > 0 ? ' ' : ''}{line}</span>) : step === 1 ? 'Your company.' : 'Ready for review.'}</h1>
          {step === 0 ? <div className="mb-4 mt-4 sm:mt-5"><p className="mx-auto max-w-[42rem] text-center text-[13px] leading-6 text-stone-500">{admissionLetter.subject}</p><div className="mt-7 sm:mt-8 rounded-xl bg-[#f1ede6]/80 px-5 py-4 sm:px-6 sm:py-5"><p className="mb-1 text-sm font-semibold leading-6 text-stone-800">{admissionLetter.salutation}</p><p className="text-sm leading-[1.75] text-stone-600">{admissionLetter.introduction}</p></div><h2 className="mt-6 text-[13px] font-semibold tracking-[0.14em] text-[#8b6537]">{admissionLetter.checklistHeading}</h2></div> : <p className="mb-8 mt-4 max-w-xl text-sm leading-6 text-stone-500">{step === 1 ? 'Add your company information after selecting your supporting documents.' : 'Check your selected qualifications, files and company details. This preview does not submit an application.'}</p>}
          {step === 0 && <div className="space-y-5">{checklists.map(section => <section key={section.key} aria-labelledby={`preview-${section.key}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="px-5 py-3 sm:px-6"><h2 id={`preview-${section.key}`} className="text-sm font-semibold">{section.titleEn || section.title}</h2></div><div>{section.items.map(({ field, uploads }) => { const checked = selected.some(item => item.field.key === field.key); return <div key={field.key} data-checklist-item={field.key} className={checked ? 'bg-[#fbf8f2]' : 'bg-white'}><label className="flex min-h-12 cursor-pointer items-center gap-4 px-5 py-3 sm:px-6"><input type="checkbox" checked={checked} disabled={!admissionOption(field)} onChange={event => toggle(field, event.target.checked, uploads)} className="size-5 shrink-0 accent-[#b8864a]" /><span className="flex-1 text-sm leading-6">{labelFor(field)}</span>{checked && <Check size={16} className="shrink-0 text-[#a07640]" aria-hidden="true" />}</label>{checked && <div className="space-y-5 px-5 pb-6 sm:pl-[68px] sm:pr-6">{uploads.length ? uploads.map(upload => <LocalUpload key={upload.key} field={upload} files={files[upload.key] || []} error={errors[upload.key]} onFiles={incoming => choose(upload, incoming)} onRemove={index => remove(upload, index)} />) : <p role="alert" className="text-sm text-red-700">No upload is configured for this item.</p>}</div>}</div>; })}</div></section>)}</div>}
          {step === 1 && <div className="space-y-7">{details.map(section => <section key={section.key} className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="mb-6 text-lg font-semibold">{section.titleEn || section.title}</h2><VerificationFields fields={section.fields.filter(field => field.type !== 'attachment')} flat data={data} onChange={change} onValidate={validateDetail} errors={errors} evidence={[]} onUpload={() => {}} onRemoveEvidence={() => {}} />{section.fields.filter(field => field.type === 'attachment' && visibleField(field, data)).map(field => <LocalUpload key={field.key} field={field} files={files[field.key] || []} error={errors[field.key]} onFiles={incoming => choose(field, incoming)} onRemove={index => remove(field, index)} />)}</section>)}</div>}
          {step === 2 && <div className="space-y-7"><section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Selected qualifications</h2>{selected.length === 0 ? <p className="text-sm text-stone-500">No qualifications selected.</p> : <ul className="divide-y divide-stone-100">{selected.map(({ field, uploads }) => <li key={field.key} className="py-4 first:pt-0"><p className="flex items-center gap-2 text-sm font-medium"><Check size={16} className="shrink-0 text-[#a07640]" aria-hidden="true" />{labelFor(field)}</p>{uploads.map(upload => <div key={upload.key} className="ml-6 mt-2"><p className="text-xs text-stone-500">{labelFor(upload)}</p>{(files[upload.key] || []).map((file, index) => <p key={index} className="mt-1 flex min-w-0 items-start gap-2 text-sm"><FileText size={14} className="mt-1 shrink-0 text-stone-400" aria-hidden="true" /><span className="break-all">{file.name}</span></p>)}</div>)}</li>)}</ul>}</section>{details.map(section => <section key={section.key} className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">{section.titleEn || section.title}</h2><dl className="grid gap-5 sm:grid-cols-2">{section.fields.filter(field => visibleField(field, data) && verificationReviewText(data[field.key], field)).map(field => <div key={field.key} className="min-w-0"><dt className="text-xs text-stone-500">{labelFor(field)}</dt><dd className="mt-1 break-words text-sm">{verificationReviewText(data[field.key], field)}</dd></div>)}</dl></section>)}<div role="status" className="flex gap-3 rounded-xl border border-[#b8864a]/25 bg-[#f7f1e7] p-5 text-sm leading-6"><LockKeyhole size={18} className="mt-1 shrink-0 text-[#a07640]" aria-hidden="true" /><p>Preview complete. No application has been submitted. The full profile will become available after admission approval in the final version.</p></div></div>}
          {step === 0 && <section className="mt-6 text-[15px] leading-[1.65] text-stone-600"><h2 className="mb-3 text-lg font-bold tracking-[0.035em] text-[#8b6537]">{admissionLetter.submissionHeading}</h2><p>{admissionLetter.submissionRequirements}</p></section>}
          {step < 2 && !canAdvance && <p role="status" className="mt-5 text-sm text-stone-500">{step === 0 ? 'Select a qualification and choose its required files to continue.' : 'Complete the required company details to continue.'}</p>}
        </div>
    </main>
    {(step > 0 || canAdvance) && <nav aria-label="Application actions" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg sm:bottom-6 sm:right-6">{step > 0 && <button type="button" className={`${secondary} mr-auto`} onClick={() => go(step - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</button>}{step < 2 ? canAdvance && <button type="button" className={primary} onClick={advance}>{step === 0 ? 'Continue to company details' : 'Review application'}<ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" className={secondary} onClick={() => go(0)}>Edit qualifications</button>}</nav>}
  </div>;
}
