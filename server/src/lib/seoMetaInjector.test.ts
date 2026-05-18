import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageMeta, injectMeta } from './seoMetaInjector';
import pool from '../config/database';

const spaHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Tarmeer | Interior Design & Build — UAE</title>
  <meta name="description" content="Default description" />
  <meta property="og:type" content="website" />
</head>
<body><div id="root"></div></body>
</html>`;

test('injectMeta inserts canonical and Open Graph tags when the SPA shell omits them', () => {
  const html = injectMeta(spaHtml, {
    title: 'Algedra Interior Design | Tarmeer',
    description: 'Algedra is an interior design company in Dubai.',
    canonical: 'https://www.tarmeer.com/companies/algedra',
    ogImage: 'https://www.tarmeer.com/images/uae-companies/logos/algedra.png',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Algedra Interior Design',
    },
  });

  assert.match(html, /<title>Algedra Interior Design \| Tarmeer<\/title>/);
  assert.match(html, /<meta name="description" content="Algedra is an interior design company in Dubai\." \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.tarmeer\.com\/companies\/algedra" \/>/);
  assert.match(html, /<meta property="og:title" content="Algedra Interior Design \| Tarmeer" \/>/);
  assert.match(html, /<meta property="og:description" content="Algedra is an interior design company in Dubai\." \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.tarmeer\.com\/companies\/algedra" \/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/www\.tarmeer\.com\/images\/uae-companies\/logos\/algedra\.png" \/>/);
  assert.match(html, /"@type":"LocalBusiness"/);
});

test('getPageMeta returns GEO-ready static metadata for FAQ', async () => {
  const meta = await getPageMeta('/faq');

  assert.ok(meta);
  assert.match(meta.title, /FAQ/i);
  assert.equal(meta.canonical, 'https://www.tarmeer.com/faq');
  assert.equal(meta.ogImage.startsWith('https://www.tarmeer.com/'), true);
  assert.equal(meta.jsonLd?.['@type'], 'FAQPage');
});

test.after(async () => {
  await pool.end();
});
