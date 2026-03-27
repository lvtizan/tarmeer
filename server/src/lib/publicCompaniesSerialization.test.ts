import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePublicCompany } from './publicCompaniesSerialization';

test('sanitizePublicCompany normalizes json fields and portfolio images', () => {
  const company = sanitizePublicCompany({
    id: 7,
    slug: 'algedra',
    name_en: 'Algedra Interior Design',
    description: 'Luxury interior design studio.',
    city: 'Dubai',
    address: 'Business Bay, Dubai, UAE',
    year_established: '2014',
    website: 'https://algedra.ae',
    instagram: 'https://www.instagram.com/algedradesign',
    phone: '+971 52 811 1106',
    email: 'hello@algedra.ae',
    services: '["Interior Design","Architecture"]',
    specialties: '["Residential","Luxury"]',
    logo_url: '/images/uae-companies/logos/algedra.png',
    portfolio_images: '["/images/uae-companies/portfolio/algedra/1.png","/images/uae-companies/portfolio/algedra/2.png"]',
    google_reviews_count: 320,
  });

  assert.equal(company.id, 7);
  assert.equal(company.slug, 'algedra');
  assert.equal(company.name_en, 'Algedra Interior Design');
  assert.deepEqual(company.services, ['Interior Design', 'Architecture']);
  assert.deepEqual(company.specialties, ['Residential', 'Luxury']);
  assert.equal(company.logo_url, '/images/uae-companies/logos/algedra.png');
  assert.deepEqual(company.portfolio_images, ['/images/uae-companies/portfolio/algedra/1.png', '/images/uae-companies/portfolio/algedra/2.png']);
  assert.equal(company.project_count, 2);
});
