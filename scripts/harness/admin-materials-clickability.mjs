#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as procurement from '../../src/lib/materialsProcurement.ts';
import * as navigation from '../../src/lib/materialsNavigation.ts';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const checks = [];
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) });

const adminForgot = read('src/app/admin/forgot-password/page.tsx');
const hubFeatured = read('src/components/materials/HubFeatured.tsx');
const hubSearchResults = read('src/components/materials/HubSearchResults.tsx');
const hubProductCard = read('src/components/materials/HubProductCard.tsx');

check(
  'admin forgot password uses the admin reset endpoint',
  adminForgot.includes('adminApi.forgotPassword') &&
    adminForgot.includes('setError(\'Failed to send reset email.\')') &&
    !adminForgot.includes('err instanceof Error ? err.message') &&
    !adminForgot.includes("fetch('/api/auth/forgot-password'") &&
    !adminForgot.includes('fetch("/api/auth/forgot-password"'),
);

const moduleExports = {};
const code = ts.transpileModule(hubProductCard, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports: moduleExports, require(name) {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'next/link') return { default: ({ children, ...props }) => createElement('a', props, children) };
  if (name === 'lucide-react') return { ArrowRight: () => null, Play: () => null };
  if (name.endsWith('/materialsNavigation')) return navigation;
  if (name.endsWith('/materialsProcurement')) return procurement;
  if (name === './ProductPriceLine') return { default: () => createElement('p', null, 'Request a quote') };
  if (name === './MaterialImage') return { default: ({src, alt}) => createElement('img', {src,alt}) };
  throw new Error(`Unexpected import ${name}`);
}});
const fixture = { id: 23, title: 'Dining Chair', image_url: '/chair.webp', supplier_slug: 'supplier-7', supplier_name: 'Supplier', model: 'C-12' };
const render = (product = fixture, returnTo = '/materials?category=furniture&q=chair') => renderToStaticMarkup(createElement(moduleExports.default, {product,returnTo}));
const html = render();
const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
check('image and title directly open the selected product with browsing context', links.filter(link => link[1].startsWith('/materials/products/23?returnTo=')).length === 2);
check('supplier action is independent of the two product links', links.length === 3 && links.some(link => link[1] === '/materials/suppliers/supplier-7?from=products' && link[2].includes('View supplier')));
check('rendered product and supplier links never nest', !/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html));
check('invalid supplier slugs omit only the supplier link', ['https://evil.test', '../unsafe', 'bad/slash', ''].every(supplier_slug => { const result=render({...fixture,supplier_slug}); return !result.includes('/materials/suppliers/') && result.includes('/materials/products/23'); }));
check('safe return links retain legitimate filters and reject external/unsafe routes', procurement.safeMaterialsReturn('/materials?q=chair&category=furniture') === '/materials?q=chair&category=furniture' && ['https://evil.test/materials','//evil.test/materials','javascript:alert(1)','/admin'].every(value => procurement.safeMaterialsReturn(value) === '/materials?tab=products'));
check('missing titles are explicit review status rather than generic Material', render({...fixture,title:'Material'}).includes('Product 23 · Details under review'));
check('card exposes model and explicit sourcing identity', html.includes('Model: C-12') && html.includes('Via Tarmeer'));

check(
  'popular product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubFeatured) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubFeatured),
);

check(
  'search product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubSearchResults) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubSearchResults),
);


const searchExports = {};
vm.runInNewContext(ts.transpileModule(hubSearchResults, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText, {exports:searchExports, require(name) {
  if(name==='react/jsx-runtime')return jsx;
  if(name==='next/link')return {default:({children,...props})=>createElement('a',props,children)};
  if(name==='./HubProductCard')return {default:moduleExports.default};
  throw new Error(name);
}});
const supplierResult=renderToStaticMarkup(createElement(searchExports.default,{type:'suppliers',results:[{id:7,slug:'supplier-7',company_name:'Stone Supplier',origin:'china',cover_image_url:null,first_product_image:null,logo_url:null}],total:1,query:'stone',loading:false}));
check('supplier search renders a stable Tarmeer reference separately from category',supplierResult.includes('Tarmeer sourcing partner #7')&&supplierResult.includes('Stone Supplier')&&supplierResult.includes('/materials/suppliers/supplier-7'));
const megaSource=read('src/components/materials/MegaMenuDirectory.tsx');
check('desktop/mobile featured supplier and directory cards use the same public reference', (megaSource.match(/Tarmeer sourcing partner #\{s.id\}/g)||[]).length===2&&read('src/components/materials/MaterialsClient.tsx').includes('Tarmeer sourcing partner #{s.id}'));

let passed = 0;
for (const item of checks) {
  if (item.condition) {
    passed++;
    console.log(`✓ ${item.label}`);
  } else {
    console.error(`✗ ${item.label}`);
  }
}

console.log(`\nadmin-materials-clickability: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
