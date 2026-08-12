#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const readOptional = (file) => existsSync(path.join(root, file)) ? read(file) : '';
const supplier = read('src/app/supplier/products/page.tsx');
const adminDetail = read('src/app/admin/suppliers/[id]/page.tsx');
const adminModal = read('src/components/admin/SupplierEditModal.tsx');
const publicPrice = readOptional('src/components/materials/ProductPriceLine.tsx');
const publicPriceDisplay = readOptional('src/lib/productPriceDisplay.ts');
const supplierDetail = read('src/components/materials/SupplierDetailClient.tsx');
const publicSurfaces = [
  ['material product card', read('src/components/materials/MaterialProductCard.tsx')],
  ['material search results', read('src/components/materials/MaterialSearchResults.tsx')],
  ['hub featured', read('src/components/materials/HubFeatured.tsx')],
  ['hub search results', read('src/components/materials/HubSearchResults.tsx')],
  ['macro product grid', read('src/components/materials/MacroProductGrid.tsx')],
  ['mega menu directory', read('src/components/materials/MegaMenuDirectory.tsx')],
  ['product detail title', read('src/components/materials/ProductDetailClient.tsx')],
  ['supplier detail products', supplierDetail],
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
check('supplier: async profile preserves explicit or user-selected currency', has(supplier, /!currencyTouchedRef\.current\s*&&\s*\(editingIdRef\.current\s*==\s*null\s*\|\|\s*editingExplicitCurrencyRef\.current\s*==\s*null\)\)\s*setNewCurrency\(cur\)/) && has(supplier, /currencyTouchedRef\.current\s*=\s*true;\s*setNewCurrency\(value\)/));
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
  ['supplier portal', supplier, [['supplier-price-min', 'supplier-price-error'], ['supplier-price-max', 'supplier-price-error'], ['supplier-price-unit', 'supplier-price-error']]],
  ['admin detail', adminDetail, [['admin-product-price-min', 'admin-product-price-error'], ['admin-product-price-max', 'admin-product-price-error'], ['admin-product-price-unit', 'admin-product-price-error'], ['admin-new-product-price-min', 'admin-new-product-price-error'], ['admin-new-product-price-max', 'admin-new-product-price-error'], ['admin-new-product-price-unit', 'admin-new-product-price-error']]],
  ['admin modal', adminModal, [['quick-add-product-price-min', 'quick-add-product-price-error'], ['quick-add-product-price-max', 'quick-add-product-price-error'], ['quick-add-product-price-unit', 'quick-add-product-price-error'], ['quick-edit-product-price-min', 'quick-edit-product-price-error'], ['quick-edit-product-price-max', 'quick-edit-product-price-error'], ['quick-edit-product-price-unit', 'quick-edit-product-price-error']]],
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
  [1, 'product.price_unit'],
  [2, 'product.price_from'],
  [3, 'product.price_currency || fallbackCurrency'],
  [4, 'product.price_max'],
  [5, "'en'"],
]));
check('public price line derives fallback currency from current site locale',
  has(publicPrice, /countryFromLang\(useSiteLocale\(\)\.lang\)/) && has(publicPrice, /fallbackCurrency(?:=\{|:)\s*country\.currency/));
check('public price display renders nothing when formatter is empty',
  has(publicPriceDisplay, /if\s*\(!label\)\s*return\s+null/));
check('public price display has stable branded-gold typography when present',
  has(publicPriceDisplay, /min-h-/) && has(publicPriceDisplay, /text-\[#b8864a\]/));
for (const [label, source] of publicSurfaces) {
  check(`${label}: renders shared public price line`,
    has(source, /import ProductPriceLine from ['"]\.\/ProductPriceLine['"]/) && has(source, /<ProductPriceLine\s+product=\{/));
}
check('supplier detail Product type includes all price fields',
  ['price', 'price_max', 'price_unit', 'price_currency', 'price_from'].every((field) =>
    new RegExp(`${field}\\??\\s*:`).test(supplierDetail)));
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
  has(supplierDetail, /if\s*\(identityChanged\)[\s\S]{0,500}setLightbox\(null\)[\s\S]{0,500}setProductCatFilter\(null\)[\s\S]{0,500}setLogoError\(false\)/));

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
