#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildProductPriceLabel } from '../../src/lib/productPriceDisplay.ts';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const readOptional = (file) => existsSync(path.join(root, file)) ? read(file) : '';
const supplier = read('src/app/supplier/products/page.tsx');
const adminDetail = read('src/app/admin/suppliers/[id]/page.tsx');
const adminModal = read('src/components/admin/SupplierEditModal.tsx');
const publicPrice = readOptional('src/components/materials/ProductPriceLine.tsx');
const publicPriceDisplay = readOptional('src/lib/productPriceDisplay.ts');
const supplierDetail = read('src/components/materials/SupplierDetailClient.tsx');
const supplierLibrary = read('src/components/materials/SupplierProductLibrary.tsx');
const serviceInquiry = read('src/components/sourcing/SourcingRequestForm.tsx');
const publicSurfaces = [
  ['material product card', read('src/components/materials/MaterialProductCard.tsx')],
  ['material search results', read('src/components/materials/MaterialSearchResults.tsx')],
  ['hub product card', read('src/components/materials/HubProductCard.tsx')],
  ['macro product grid', read('src/components/materials/MacroProductGrid.tsx')],
  ['mega menu directory', read('src/components/materials/MegaMenuDirectory.tsx')],
  ['product detail title', read('src/components/materials/ProductDetailClient.tsx')],
];

const checks = [];
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) });
const has = (source, pattern) => pattern.test(source);
const inputTagsFor = (source, marker) => {
  const tags = [];
  let markerAt = source.indexOf(marker);
  while (markerAt !== -1) {
    const start = source.lastIndexOf('<input', markerAt);
    const end = source.indexOf('/>', markerAt);
    if (start !== -1 && end !== -1 && !source.slice(start, markerAt).includes('/>')) tags.push(source.slice(start, end + 2));
    markerAt = source.indexOf(marker, markerAt + marker.length);
  }
  return tags;
};
const hasDecimalWhiteInputs = (source, markers) => markers.every((marker) => {
  const tags = inputTagsFor(source, marker);
  return tags.length > 0 && tags.every((tag) => tag.includes('type="text"') && tag.includes('inputMode="decimal"') && tag.includes('bg-white'));
});
const controlHasErrorAria = (source, id, errorId) => {
  const at = source.indexOf(`id="${id}"`);
  if (at === -1) return false;
  const start = source.lastIndexOf('<', at);
  let end = at;
  while ((end = source.indexOf('>', end + 1)) !== -1 && source[end - 1] === '=') { /* skip JSX arrow => */ }
  if (start === -1 || end === -1) return false;
  const control = source.slice(start, end + 1);
  return control.includes('aria-invalid=') && control.includes('aria-describedby=') && control.includes(errorId);
};
const functionCalls = (source, name) => {
  const calls = [];
  let start = source.indexOf(`${name}(`);
  while (start !== -1) {
    let depth = 0;
    let quote = null;
    for (let index = start + name.length; index < source.length; index++) {
      const char = source[index];
      const previous = source[index - 1];
      if (quote) {
        if (char === quote && previous !== '\\') quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '(') depth++;
      if (char === ')' && --depth === 0) { calls.push(source.slice(start, index + 1)); break; }
    }
    start = source.indexOf(`${name}(`, start + name.length + 1);
  }
  return calls;
};
const callArguments = (call) => {
  const body = call.slice(call.indexOf('(') + 1, -1);
  const args = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    const previous = body[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if ('([{'.includes(char)) depth++;
    if (')]}'.includes(char)) depth--;
    if (char === ',' && depth === 0) { args.push(body.slice(start, index).trim()); start = index + 1; }
  }
  args.push(body.slice(start).trim());
  return args;
};
const compact = (value) => value.replace(/\s+/g, '');
const hasSingleFormatterWithArgs = (source, expected) => {
  const calls = functionCalls(source, 'formatProductPrice').map(callArguments);
  return calls.length === 1 && expected.every(([index, value]) => compact(calls[0][index] || '') === compact(value));
};

for (const [label, source] of [['supplier portal', supplier], ['admin detail', adminDetail], ['admin modal', adminModal]]) {
  check(`${label}: price_max state/type`, has(source, /price_max\??\s*:/) && has(source, /(?:priceMax|newPriceMax)/));
  check(`${label}: save path uses shared price validation/payload builder`,
    has(source, /buildProductPriceSubmission/) && has(source, /\.\.\.priceSubmission\.payload/));
  const markers = label === 'supplier portal' ? ['newPriceMax'] : label === 'admin detail' ? ['priceMax', 'newProduct.price_max'] : ['priceMax'];
  check(`${label}: maximum inputs are decimal text with white background`, hasDecimalWhiteInputs(source, markers));
}

check('supplier: edit dirty state is passed into shared builder', has(supplier, /dirty:\s*priceDirty/));
check('supplier: async profile never assigns quote currency and edits preserve explicit values', !has(supplier, /setNewCurrency\((?:cur|currency)\)/) && has(supplier, /setNewCurrency\(explicitCurrency \|\| ''\)/) && has(supplier, /newCurrency !== \(originalPriceFields\.price_currency \|\| ''\)/));
check('supplier: unit selector exposes field-specific error', has(supplier, /id="supplier-price-unit"[\s\S]{0,500}aria-describedby=\{displayedPriceErrorField === 'unit'/));
check('admin detail: add/edit both use shared builder', (adminDetail.match(/buildProductPriceSubmission\(/g) || []).length >= 2);
check('admin modal: add/edit both use shared builder', (adminModal.match(/buildProductPriceSubmission\(/g) || []).length >= 2);
for (const [label, source, ids] of [
  ['supplier portal', supplier, ['supplier-price-min', 'supplier-price-max', 'supplier-price-unit', 'supplier-price-currency']],
  ['admin detail', adminDetail, ['admin-product-price-min', 'admin-product-price-max', 'admin-product-price-unit', 'admin-product-price-currency', 'admin-new-product-price-min', 'admin-new-product-price-max', 'admin-new-product-price-unit', 'admin-new-product-price-currency']],
  ['admin modal', adminModal, ['quick-add-product-price-min', 'quick-add-product-price-max', 'quick-add-product-price-unit', 'quick-add-product-price-currency', 'quick-edit-product-price-min', 'quick-edit-product-price-max', 'quick-edit-product-price-unit', 'quick-edit-product-price-currency']],
]) {
  for (const id of ids) {
    check(`${label}: ${id} label is bound`, source.includes(`htmlFor="${id}"`) && source.includes(`id="${id}"`));
  }
  check(`${label}: price errors are announced`, has(source, /role="alert"|aria-live="(?:polite|assertive)"/));
}
for (const [label, source, fields] of [
  ['supplier portal', supplier, [['supplier-price-min', 'supplier-price-error'], ['supplier-price-max', 'supplier-price-error'], ['supplier-price-unit', 'supplier-price-error'], ['supplier-price-currency', 'supplier-price-error']]],
  ['admin detail', adminDetail, [['admin-product-price-min', 'admin-product-price-error'], ['admin-product-price-max', 'admin-product-price-error'], ['admin-product-price-unit', 'admin-product-price-error'], ['admin-new-product-price-min', 'admin-new-product-price-error'], ['admin-new-product-price-max', 'admin-new-product-price-error'], ['admin-new-product-price-unit', 'admin-new-product-price-error'], ['admin-product-price-currency', 'admin-product-price-error'], ['admin-new-product-price-currency', 'admin-new-product-price-error']]],
  ['admin modal', adminModal, [['quick-add-product-price-min', 'quick-add-product-price-error'], ['quick-add-product-price-max', 'quick-add-product-price-error'], ['quick-add-product-price-unit', 'quick-add-product-price-error'], ['quick-edit-product-price-min', 'quick-edit-product-price-error'], ['quick-edit-product-price-max', 'quick-edit-product-price-error'], ['quick-edit-product-price-unit', 'quick-edit-product-price-error'], ['quick-add-product-price-currency', 'quick-add-product-price-error'], ['quick-edit-product-price-currency', 'quick-edit-product-price-error']]],
]) {
  for (const [id, errorId] of fields) check(`${label}: ${id} exposes its error relationship`, controlHasErrorAria(source, id, errorId));
}
check('supplier preview has one correctly wired formatter call', hasSingleFormatterWithArgs(supplier, [
  [0, 'p.price'], [1, 'p.price_unit ?? null'], [2, '!!p.price_from'],
  [3, 'p.price_currency || currency'], [4, 'p.price_max'],
]));
check('admin detail preview has one correctly wired formatter call', hasSingleFormatterWithArgs(adminDetail, [
  [0, 'p.price == null ? null : Number(p.price)'],
  [1, 'p.price_unit'],
  [2, '!!p.price_from'],
  [3, "p.price_currency || getCountry(supplier.country || 'ae').currency"],
  [4, 'p.price_max == null ? null : Number(p.price_max)'],
  [5, "lang === 'zh' ? 'zh' : 'en'"],
]));
check('admin modal preview has one correctly wired formatter call', hasSingleFormatterWithArgs(adminModal, [
  [0, 'product.price'],
  [1, 'product.price_unit'],
  [2, '!!product.price_from'],
  [3, "product.price_currency || getCountry(data.country || 'ae').currency"],
  [4, 'product.price_max'],
]));

check('public price display uses the shared formatter with all five product price fields', hasSingleFormatterWithArgs(publicPriceDisplay, [
  [0, 'product.price'],
  [1, 'unit'],
  [2, 'product.price_from'],
  [3, 'product.price_currency'],
  [4, 'product.price_max'],
  [5, "'en'"],
]));
check('public numeric price requires explicit currency and unit; locale never invents currency',
  buildProductPriceLabel({ price: 50, price_unit: 'PCS', price_currency: null }, 'AED') === 'Request a quote'
  && buildProductPriceLabel({ price: 50, price_unit: null, price_currency: 'USD' }, 'AED') === 'Request a quote');
check('missing prices show an actionable quote status', buildProductPriceLabel({price: null}, 'AED') === 'Request a quote');
check('public prices normalize units and retain source currency',
  buildProductPriceLabel({price: 50, price_unit: 'PCS', price_currency: 'USD'}, 'AED') === 'USD 50 / piece'
  && buildProductPriceLabel({price: 50, price_unit: 'SQM', price_currency: 'AED'}, 'USD') === 'AED 50 / m²'
  && buildProductPriceLabel({price: 150, price_unit: '元/㎡', price_currency: 'CNY'}, 'AED') === 'CNY 150 / m²');
check('public price display has stable branded-gold typography when present',
  has(publicPriceDisplay, /min-h-/) && has(publicPriceDisplay, /text-\[#b8864a\]/));
for (const [label, source] of publicSurfaces) {
  check(`${label}: renders shared public price line`,
    has(source, /import ProductPriceLine from ['"]\.\/ProductPriceLine['"]/) && has(source, /<ProductPriceLine\s+product=\{/));
}
check('supplier detail Product type includes all price fields',
  ['price', 'price_max', 'price_unit', 'price_currency', 'price_from'].every((field) =>
    new RegExp(`${field}\\??\\s*:`).test(supplierDetail)));
check('supplier detail products hide prices while retaining the product detail link',
  !has(supplierDetail, /import ProductPriceLine/)
  && !has(supplierLibrary, /import ProductPriceLine/)
  && !has(supplierLibrary, /<ProductPriceLine/)
  && has(supplierLibrary, /href=\{`\/materials\/products\/\$\{product\.id\}`\}/));
check('supplier project materials sanitize hidden price and import metadata',
  has(supplierDetail, /sanitizeDescription\(m\.description\)/));
check('supplier hydration forwards country in both request cache keys',
  (supplierDetail.match(/country=\$\{country\.code\}/g) || []).length >= 2);
check('supplier hydration forwards x-country in both request headers',
  (supplierDetail.match(/headers:\s*\{\s*'x-country':\s*country\.code\s*\}/g) || []).length >= 2);
check('supplier hydration refetches when country changes',
  has(supplierDetail, /\},\s*\[slug,\s*country\.code\]\)/));
check('supplier hydration clears stale route or country state before refetch',
  has(supplierDetail, /if\s*\(identityChanged\)[\s\S]{0,300}setSupplier\(null\)[\s\S]{0,300}setProducts\(\[\]\)/));
check('supplier hydration ignores obsolete country requests',
  has(supplierDetail, /createSupplierIdentityGuard/) && has(supplierDetail, /\.isCurrent\(requestToken\)/) && has(supplierDetail, /\.cancel\(requestToken\)/));
check('supplier rendering gates stale route or country identity before effects run',
  has(supplierDetail, /isSupplierContentStale\(loadedIdentity, requestIdentity\)/) && has(supplierDetail, /if\s*\(loading \|\| contentStale\)/));
check('supplier identity switch clears entity-specific visual state',
  has(supplierDetail, /if\s*\(identityChanged\)[\s\S]{0,500}setLightbox\(null\)[\s\S]{0,500}setLogoError\(false\)/));
check('supplier inquiry opens in a bottom-right dialog without scrolling the page',
  has(supplierDetail, /id="supplier-inquiry-panel"/)
  && has(supplierDetail, /role="dialog"/)
  && has(supplierDetail, /sm:bottom-6\s+sm:right-6/)
  && has(supplierDetail, /onClick=\{openInquiry\}/)
  && !has(supplierDetail, /scrollToInquiry|mobileFormRef|desktopFormRef/));
check('supplier inquiry entry remains reachable without scrolling or permanent dismissal',
  has(supplierDetail, /!inquiryOpen && \(/)
  && !has(supplierDetail, /showFloatingForm|floatingFormDismissed|aria-label="Dismiss"/));
check('supplier inquiry drawer supports escape, focus trapping and trigger focus restoration',
  has(supplierDetail, /event\.key === 'Escape'/)
  && has(supplierDetail, /event\.key !== 'Tab'/)
  && has(supplierDetail, /const getFocusable =/)
  && has(supplierDetail, /const focusable = getFocusable\(\)/)
  && has(supplierDetail, /!panel\?\.contains\(document\.activeElement\)/)
  && has(supplierDetail, /!Array\.from\(focusable\)\.includes\(document\.activeElement as HTMLElement\)/)
  && has(supplierDetail, /inquiryTriggerRef\.current\?\.focus\(\)/));
check('supplier inquiry drawer locks background scroll and has a backdrop close target',
  has(supplierDetail, /document\.body\.style\.overflow = 'hidden'/)
  && has(supplierDetail, /aria-label="Close inquiry form"/)
  && has(supplierDetail, /onClick=\{closeInquiry\}/));
check('supplier inquiry preserves draft while closed and resets it for a new supplier identity',
  has(supplierDetail, /aria-hidden=\{!inquiryOpen\}/)
  && has(supplierDetail, /inert=\{!inquiryOpen\}/)
  && has(supplierDetail, /pointer-events-none/)
  && has(supplierDetail, /key=\{requestIdentity\}/));
check('supplier inquiry respects reduced-motion preferences',
  has(supplierDetail, /useReducedMotion\(\)/)
  && (supplierDetail.match(/reduceMotion \? \{ duration: 0 \}/g) || []).length >= 2);
check('sourcing fields bind visible labels and announce errors',
  has(serviceInquiry, /htmlFor=\{`\$\{id\}-\$\{field\}`\}/)
  && ['name', 'phone', 'city', 'message'].every(field => new RegExp(`label\\(["']${field}["']`).test(serviceInquiry))
  && has(serviceInquiry, /role="alert"/));
check('supplier inquiry exposes expanded state, explicit required contact and optional quantity',
  has(supplierDetail, /aria-expanded=\{inquiryOpen\}/)
  && has(serviceInquiry, /phoneOk/) && has(serviceInquiry, /form\.name\.trim\(\)/)
  && has(serviceInquiry, /quantityOk/) && has(serviceInquiry, /unknownQuantity/));
check('supplier inquiry uses locale country and mobile safe-area spacing',
  has(serviceInquiry, /countryFromLang\(useSiteLocale\(\)\.lang\)/)
  && has(serviceInquiry, /country\.cities\.map/)
  && has(serviceInquiry, /["']x-country["']:\s*country\.code/)
  && (supplierDetail.match(/env\(safe-area-inset-bottom\)/g) || []).length >= 3
  && has(supplierDetail, /document\.body\.style\.paddingBottom = previousPaddingBottom/));
check('supplier inquiry uses the explicit supplier sourcing target instead of company fields',
  !has(supplierDetail, /companyId=\{supplier\.id\}/)
  && !has(supplierDetail, /companySlug=\{supplier\.slug\}/)
  && has(supplierDetail, /supplierId=\{supplier\.id\}/)
  && has(supplierDetail, /<SourcingRequestForm/)
  && has(serviceInquiry, /supplier_profile_id:\s*supplierId/)
  && has(serviceInquiry, /sourcing-requests\?country=/));
check('inquiry receipt is announced and receives focus after submission',
  has(serviceInquiry, /role="status"/) && has(serviceInquiry, /successRef\.current\?\.focus\(\)/));
check('shared inquiry inputs use the required white field background', !has(serviceInquiry, /bg-stone-50/) && has(serviceInquiry, /bg-white/));
check('sourcing workflow behavior: quantity, retry, country and deduplication', (() => {
  try { execFileSync(process.execPath, ['--test', 'src/components/sourcing/SourcingRequestForm.test.mjs'], { cwd: root, stdio: 'pipe' }); return true; }
  catch(error) { console.error(error.stdout?.toString()); return false; }
})());

for (const [label, source] of [['supplier', supplier], ['admin detail', adminDetail], ['admin modal', adminModal]]) {
  check(`${label}: save boundary reports a currency-specific error`, has(source, /priceSubmission.field === 'currency'/));
  check(`${label}: currency selector never offers an inferred country value`, !has(source, /By country|按国家/) && has(source, /Select currency|请选择币种/));
}
for (const [label, source] of [['admin detail', adminDetail], ['admin modal', adminModal]]) {
  check(`${label}: separate original and English fields persist reviewed English names`,
    has(source, /English product name/) && has(source, /原名称 \/ 中文名称/)
    && (source.match(/title_translated:/g) || []).length >= 2
    && has(source, /title_translated: titleEn.trim\(\) \|\| null/));
}

let passed = 0;
for (const item of checks) {
  if (item.condition) {
    passed++;
    console.log(`✓ ${item.label}`);
  } else {
    console.error(`✗ ${item.label}`);
  }
}
console.log(`\n${passed}/${checks.length} checks passed`);
if (passed !== checks.length) process.exit(1);
