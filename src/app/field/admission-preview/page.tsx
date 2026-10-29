import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AdmissionPreview from '@/components/field/admission-preview';
import type { VerificationSchema } from '@/lib/verification';

export const metadata: Metadata = { title: 'Contractor admission · Preview', robots: { index: false, follow: false } };

export default async function AdmissionPreviewPage() {
  const country = (await headers()).get('x-country') || 'ae';
  if (country !== 'ae') notFound();
  let schema: VerificationSchema;
  try {
    const response = await fetch('https://www.tarmeer.com/api/field/survey-schema?version=tarmeer-verification-v7', {
      cache: 'no-store', headers: { 'x-country': 'ae' }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Schema request failed');
    const result = await response.json();
    schema = result.schema;
    if (!schema || schema.country !== 'ae' || schema.workflow !== 'contractor-two-stage' || !Array.isArray(schema.sections) || !schema.sections.some(section => section.phase === 'qualification')) throw new Error('Admission schema unavailable');
  } catch {
    return <main className="mx-auto max-w-lg px-6 py-24"><h1 className="mb-3 text-2xl font-semibold">Preview unavailable</h1><p className="mb-6 text-stone-600" role="alert">The admission checklist could not be loaded. Please try again.</p><a href="/field/admission-preview" className="inline-flex min-h-11 items-center rounded-lg bg-[#b8864a] px-5 text-white">Try again</a></main>;
  }
  return <AdmissionPreview schema={schema} />;
}
