import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [catalogPage, uploadZone] = await Promise.all([
  readFile('src/app/supplier/catalogs/page.tsx', 'utf8'),
  readFile('src/components/ui/ImageUploadZone.tsx', 'utf8'),
]);

assert.match(catalogPage, /accept="application\/pdf"/);
assert.match(catalogPage, /maxFileBytes=\{60 \* 1024 \* 1024\}/);
assert.match(catalogPage, /activatePasteOnMount/);
assert.match(catalogPage, /acceptClipboardFiles/);
assert.match(uploadZone, /maxFileBytes\?: number/);
assert.match(uploadZone, /activatePasteOnMount\?: boolean/);
assert.match(uploadZone, /acceptClipboardFiles = false/);
assert.match(uploadZone, /getPasteFiles/);
assert.match(uploadZone, /isWithinFileLimit\(file, maxFileBytesRef\.current\)/);
assert.match(uploadZone, /文件超过 \$\{Math\.floor\(maxFileBytesRef\.current \/ 1024 \/ 1024\)\} MB 限制/);

console.log('supplier-catalog-upload-contract: 10/10 PASS');
