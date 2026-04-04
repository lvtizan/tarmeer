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

test('sanitizePublicCompany handles categorized portfolio_images object', () => {
  const company = sanitizePublicCompany({
    id: 1,
    slug: 'test-co',
    name_en: 'Test Co',
    description: 'A test company.',
    city: 'Dubai',
    address: 'Dubai, UAE',
    year_established: '2020',
    website: 'https://test.com',
    instagram: '',
    phone: '',
    email: '',
    services: '["Interior Design"]',
    specialties: '["Residential"]',
    logo_url: '/images/logo.png',
    portfolio_images: JSON.stringify({
      "Residential": [
        { "url": "/images/portfolio/test-co/residential/1.jpg", "title": "Villa A" },
        { "url": "/images/portfolio/test-co/residential/2.jpg", "title": "Villa B" }
      ],
      "Commercial": [
        { "url": "/images/portfolio/test-co/commercial/1.jpg", "title": "Office" }
      ]
    }),
    google_reviews_count: 50,
  });

  assert.deepEqual(company.portfolio_categories, {
    Residential: [
      { url: '/images/portfolio/test-co/residential/1.jpg', title: 'Villa A' },
      { url: '/images/portfolio/test-co/residential/2.jpg', title: 'Villa B' },
    ],
    Commercial: [
      { url: '/images/portfolio/test-co/commercial/1.jpg', title: 'Office' },
    ],
  });
  assert.equal(company.project_count, 3);
  assert.deepEqual(company.portfolio_images, [
    '/images/portfolio/test-co/residential/1.jpg',
    '/images/portfolio/test-co/residential/2.jpg',
    '/images/portfolio/test-co/commercial/1.jpg',
  ]);
});

test('sanitizePublicCompany still handles legacy flat portfolio_images array', () => {
  const company = sanitizePublicCompany({
    id: 2,
    slug: 'legacy-co',
    name_en: 'Legacy Co',
    description: '',
    city: 'Dubai',
    address: '',
    year_established: '2010',
    website: '',
    instagram: '',
    phone: '',
    email: '',
    services: '[]',
    specialties: '[]',
    logo_url: '/images/logo.png',
    portfolio_images: '["/images/1.jpg", "/images/2.jpg"]',
    google_reviews_count: 10,
  });

  assert.deepEqual(company.portfolio_images, ['/images/1.jpg', '/images/2.jpg']);
  assert.deepEqual(company.portfolio_categories, {
    Projects: [
      { url: '/images/1.jpg', title: '' },
      { url: '/images/2.jpg', title: '' },
    ],
  });
  assert.equal(company.project_count, 2);
});

test('sanitizePublicCompany normalizes relative logo and portfolio paths for stable rendering', () => {
  const company = sanitizePublicCompany({
    id: 3,
    slug: 'relative-co',
    name_en: 'Relative Co',
    description: '',
    city: 'Dubai',
    address: '',
    year_established: '2018',
    website: '',
    instagram: '',
    phone: '',
    email: '',
    services: '[]',
    specialties: '[]',
    logo_url: 'images/uae-companies/logos/relative.png',
    portfolio_images: JSON.stringify({
      Projects: [
        { url: 'images/uae-companies/portfolio/relative/1.jpg', title: 'One' },
        { url: './uploads/projects/relative/2.jpg', title: 'Two' },
      ],
    }),
    google_reviews_count: 0,
  });

  assert.equal(company.logo_url, '/images/uae-companies/logos/relative.png');
  assert.deepEqual(company.portfolio_images, [
    '/images/uae-companies/portfolio/relative/1.jpg',
    '/uploads/projects/relative/2.jpg',
  ]);
  assert.equal(company.project_count, 2);
});
