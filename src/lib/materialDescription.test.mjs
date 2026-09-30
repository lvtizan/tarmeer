import assert from 'node:assert/strict';
import { test } from 'node:test';

const { sanitizeDescription } = await import('./materialDescription.ts');

test('public material descriptions remove wholesale prices, MOQ and import metadata', () => {
  assert.equal(
    sanitizeDescription('大理石系列。[catalog-import:quanshi-2026-09-16] | Price: CN¥197.02-264.95 | MOQ: Min. Order: 2 pieces'),
    '大理石系列。',
  );
});

test('public material descriptions preserve ordinary copy', () => {
  assert.equal(sanitizeDescription('Natural stone for interior walls.'), 'Natural stone for interior walls.');
  assert.equal(sanitizeDescription(null), null);
});

test('imported paragraphs, lists and entities become readable text', () => {
 assert.equal(sanitizeDescription('<p>Walnut &amp; leather</p><ul><li>Size: 3000 &times; 970</li><li>Thickness &lt; 20 mm</li></ul>'), 'Walnut & leather\n\n• Size: 3000 × 970\n\n• Thickness < 20 mm');
});
test('image-only description has no raw URLs or empty markup', () => {
 assert.equal(sanitizeDescription('<p><img src="https://example.com/a.jpg" /><img src = "b.jpg" /></p>'), null);
});
test('escaped markup and executable blocks are not exposed', () => {
 assert.equal(sanitizeDescription('&lt;p&gt;Panel&#32;A&lt;/p&gt;<script>alert(1)</script><style>.x{}</style><!--secret-->'), 'Panel A');
});
test('plain measurements and Unicode text survive', () => {
 assert.equal(sanitizeDescription('Thickness < 20 mm; strength > 5. Gỗ óc chó. 保温板。'), 'Thickness < 20 mm; strength > 5. Gỗ óc chó. 保温板。');
});
test('table cells stay separate and invalid numeric entities do not throw', () => {
 assert.equal(sanitizeDescription('<table><tr><td>Width</td><td>1200 mm</td></tr></table>&#x110000;'), 'Width\n1200 mm');
});
