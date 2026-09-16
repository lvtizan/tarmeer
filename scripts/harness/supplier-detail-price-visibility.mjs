#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'src/components/materials/SupplierDetailClient.tsx'), 'utf8');

assert.doesNotMatch(source, /import ProductPriceLine/, '供应商详情页不应引入价格展示组件');
assert.doesNotMatch(source, /<ProductPriceLine\s+product=\{p\}/, '供应商详情页产品卡片不应展示价格');
assert.match(source, /href=\{`\/materials\/products\/\$\{p\.id\}`\}/, '隐藏价格后仍需保留产品详情入口');

console.log('supplier-detail-price-visibility: 3/3 PASS');
