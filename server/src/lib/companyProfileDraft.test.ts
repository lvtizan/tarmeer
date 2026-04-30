import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCompanyProfilePayload,
  validateCompanyProfilePayload,
} from './companyProfileDraft';

test('company profile draft validation allows partial autosave payloads', async () => {
  const payload = normalizeCompanyProfilePayload({
    company_name: 'Studio One',
    description: 'Draft bio only',
    company_type: 'design_studio',
    services: ['Interior Design'],
  });

  assert.equal(await validateCompanyProfilePayload(payload), null);
  assert.equal(payload.address, '');
  assert.equal(payload.contact_person, '');
});

test('company profile draft validation requires company name', async () => {
  const payload = normalizeCompanyProfilePayload({
    company_name: '   ',
    company_type: 'design_studio',
    services: ['Interior Design'],
  });

  assert.equal(
    await validateCompanyProfilePayload(payload),
    'Company name is required to save your profile.',
  );
});

test('company profile draft validation rejects invalid services and specialties', async () => {
  const payload = normalizeCompanyProfilePayload({
    company_name: 'Studio One',
    company_type: 'design_studio',
    services: ['Interior Design', 'Fake Service'],
    specialties: ['Retail', 'Fake Specialty'],
  });

  assert.equal(
    await validateCompanyProfilePayload(payload),
    'Invalid services: Fake Service',
  );
});
