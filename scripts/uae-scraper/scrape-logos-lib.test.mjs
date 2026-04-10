import test from 'node:test';
import assert from 'node:assert/strict';

import { extractLogoUrl, extractPortfolioImages, extractCategoryLinks, extractPageMetadata } from './scrape-logos-lib.mjs';

test('extractLogoUrl prioritizes actual logo assets over social og:image links', () => {
  const html = `
    <meta property="og:image" content="https://www.facebook.com/profile.php?id=123">
    <a class="navbar-brand" href="/">
      <img bv-data-src="https://luxuryandmore.net/wp-content/uploads/2022/03/logo_edited_edited.avif" alt="Luxury & More">
    </a>
  `;

  const result = extractLogoUrl(html, 'https://luxuryandmore.net');

  assert.equal(result, 'https://luxuryandmore.net/wp-content/uploads/2022/03/logo_edited_edited.avif');
});

test('extractLogoUrl prefers full logo assets over cropped favicon-like variants', () => {
  const html = `
    <script type="application/ld+json">
      {"logo":"https://mgminteriorsuae.com/wp-content/uploads/2025/07/Flattened-Logo.png"}
    </script>
    <link rel="icon" href="https://mgminteriorsuae.com/wp-content/uploads/2023/05/cropped-MGM-LOGO-01-192x192.png">
    <img src="https://mgminteriorsuae.com/wp-content/uploads/2023/05/MGM-LOGO-01.png" class="top-logo">
  `;

  const result = extractLogoUrl(html, 'https://mgminteriorsuae.com');

  assert.equal(result, 'https://mgminteriorsuae.com/wp-content/uploads/2025/07/Flattened-Logo.png');
});

test('extractPortfolioImages parses Next.js imageSrcSet payloads', () => {
  const html = `
    <link rel="preload" as="image"
      imageSrcSet="/_next/image?url=https%3A%2F%2Fluxedesign-s3-beta.s3.ap-southeast-1.amazonaws.com%2Ffile%2F1764222604241-1.webp&w=384&q=75 384w,
      /_next/image?url=https%3A%2F%2Fluxedesign-s3-beta.s3.ap-southeast-1.amazonaws.com%2Ffile%2F1764222571643-1.webp&w=640&q=75 640w">
    <script>self.__next_f.push([1,"\\"image\\":{\\"url\\":\\"https://luxedesign-s3-beta.s3.ap-southeast-1.amazonaws.com/file/1760594627134-inte2.webp\\"}"])</script>
  `;

  const result = extractPortfolioImages(html, 'https://www.luxedesign.ae');

  assert.ok(result.includes('https://www.luxedesign.ae/_next/image?url=https%3A%2F%2Fluxedesign-s3-beta.s3.ap-southeast-1.amazonaws.com%2Ffile%2F1764222604241-1.webp&w=384&q=75'));
  assert.ok(result.includes('https://luxedesign-s3-beta.s3.ap-southeast-1.amazonaws.com/file/1760594627134-inte2.webp'));
});

test('extractPortfolioImages keeps real project uploads and skips logos/icons', () => {
  const html = `
    <img class="img-responsive" src="uploads/topics/17574181212261.jpg" alt="Project">
    <img class="img-responsive" src="uploads/settings/16982356822641.png" alt="Logo">
    <img src="uploads/settings/fullstar.png" alt="Star">
  `;

  const result = extractPortfolioImages(html, 'https://www.winteriorsdecor.com');

  assert.deepEqual(result, ['https://www.winteriorsdecor.com/uploads/topics/17574181212261.jpg']);
});

test('extractCategoryLinks finds portfolio category navigation links', () => {
  const html = `
    <nav>
      <a href="/projects/residential">Residential</a>
      <a href="/projects/commercial">Commercial</a>
      <a href="/portfolio/hospitality">Hospitality</a>
      <a href="/about">About Us</a>
    </nav>
  `;
  const result = extractCategoryLinks(html, 'https://example.com');
  assert.deepEqual(result, [
    { url: 'https://example.com/projects/residential', category: 'Residential' },
    { url: 'https://example.com/projects/commercial', category: 'Commercial' },
    { url: 'https://example.com/portfolio/hospitality', category: 'Hospitality' },
  ]);
});

test('extractCategoryLinks returns empty array when no categories found', () => {
  const html = `<nav><a href="/about">About</a><a href="/contact">Contact</a></nav>`;
  const result = extractCategoryLinks(html, 'https://example.com');
  assert.deepEqual(result, []);
});

test('extractPageMetadata prefers og:title over h1 and <title>', () => {
  const html = `
    <head>
      <title>Some Company | Home</title>
      <meta property="og:title" content="Luxury Villa in Palm Jumeirah" />
    </head>
    <body><h1>Our Projects</h1></body>
  `;
  const meta = extractPageMetadata(html);
  assert.equal(meta.title, 'Luxury Villa in Palm Jumeirah');
});

test('extractPageMetadata falls back to h1 when no meta title', () => {
  const html = `<body><h1>  Modern Office Design  </h1><p>Lorem ipsum.</p></body>`;
  const meta = extractPageMetadata(html);
  assert.equal(meta.title, 'Modern Office Design');
});

test('extractPageMetadata falls back to <title> when no h1', () => {
  const html = `<head><title>Project XYZ — Studio</title></head><body></body>`;
  const meta = extractPageMetadata(html);
  assert.equal(meta.title, 'Project XYZ — Studio');
});

test('extractPageMetadata pulls description from meta tag', () => {
  const html = `
    <meta name="description" content="A modern 5-bedroom villa project in Dubai Hills completed in 2023, featuring custom millwork and natural stone finishes." />
    <body><p>Short intro.</p></body>
  `;
  const meta = extractPageMetadata(html);
  assert.match(meta.description, /5-bedroom villa project in Dubai Hills/);
});

test('extractPageMetadata falls back to first substantial <p> for description', () => {
  const html = `
    <body>
      <p>Nav</p>
      <p>This is a comprehensive interior design project for a family home in Abu Dhabi featuring contemporary finishes, open-plan living spaces, and custom joinery throughout every room.</p>
      <p>Subscribe to our newsletter</p>
    </body>
  `;
  const meta = extractPageMetadata(html);
  assert.match(meta.description, /comprehensive interior design project/);
  // Should NOT pick the "Nav" <p> (too short) or the "Subscribe" boilerplate
  assert.doesNotMatch(meta.description, /Nav|newsletter/);
});

test('extractPageMetadata extracts the latest plausible year from page text', () => {
  const html = `
    <body>
      <p>We founded the firm in 2012 and completed this villa in 2023.</p>
    </body>
  `;
  const meta = extractPageMetadata(html);
  assert.equal(meta.year, 2023);
});

test('extractPageMetadata returns null year when no valid year present', () => {
  const html = `<body><p>No years here, just words.</p></body>`;
  const meta = extractPageMetadata(html);
  assert.equal(meta.year, null);
});

test('extractPageMetadata picks the most specific UAE location', () => {
  const html = `
    <body>
      <p>Headquartered in the UAE, this project is located in Palm Jumeirah, Dubai.</p>
    </body>
  `;
  const meta = extractPageMetadata(html);
  // "Palm Jumeirah" should win over "Dubai" and "UAE"
  assert.equal(meta.location, 'Palm Jumeirah');
});

test('extractPageMetadata returns empty location when no UAE keyword present', () => {
  const html = `<body><p>A design studio in Karachi.</p></body>`;
  const meta = extractPageMetadata(html);
  assert.equal(meta.location, '');
});

test('extractPageMetadata returns all four fields for a realistic page', () => {
  const html = `
    <head>
      <title>Coffee Shop Fitout</title>
      <meta property="og:title" content="Costa Coffee Abu Dhabi Fitout 2024" />
      <meta name="description" content="Full interior fitout for Costa Coffee at Al Wahda Mall, Abu Dhabi, delivered in 2024. Includes millwork, seating, lighting and finishes." />
    </head>
    <body>
      <h1>Costa Coffee</h1>
      <p>Short intro.</p>
    </body>
  `;
  const meta = extractPageMetadata(html, 'https://example.com/projects/costa');
  assert.equal(meta.title, 'Costa Coffee Abu Dhabi Fitout 2024');
  assert.match(meta.description, /Al Wahda Mall/);
  assert.equal(meta.year, 2024);
  assert.equal(meta.location, 'Abu Dhabi');
  assert.equal(meta.sourceUrl, 'https://example.com/projects/costa');
});
