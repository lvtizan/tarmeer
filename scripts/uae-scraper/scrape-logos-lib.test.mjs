import test from 'node:test';
import assert from 'node:assert/strict';

import { extractLogoUrl, extractPortfolioImages } from './scrape-logos-lib.mjs';

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
