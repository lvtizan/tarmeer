import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getUploadResponseError } from '../../src/lib/uploadResponseError.js';

const [catalogPage, uploadZone, catalogController, requestLimits] = await Promise.all([
  readFile('src/app/supplier/catalogs/page.tsx', 'utf8'),
  readFile('src/components/ui/ImageUploadZone.tsx', 'utf8'),
  readFile('server/dist/controllers/supplierCatalogController.js', 'utf8'),
  import('../../server/dist/lib/requestLimits.js'),
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
assert.match(uploadZone, /超过 \$\{Math\.floor\(maxFileBytesRef\.current \/ 1024 \/ 1024\)\} MB 限制，请压缩或拆分文件后重试/);
assert.match(uploadZone, /网络连接失败，文件未上传，请检查网络后重试/);
assert.match(catalogController, /Catalog upload data is invalid\. Please select the PDF and start again\./);
assert.match(catalogController, /Catalogs must be PDF files\. Please choose a PDF and start again\./);
assert.match(catalogController, /Catalog exceeds the 60 MB limit\. Please compress or split the PDF and try again\./);
assert.match(catalogController, /Catalog is not a valid PDF\. Please export it as a new PDF and try again\./);
assert.match(catalogController, /Catalog upload failed before the file was saved\. Please try again\./);
assert.equal(getUploadResponseError(413, JSON.stringify({ error: 'Uploaded images are too large.' })), '文件超过服务器允许的大小，请压缩或拆分文件后重试。');
assert.equal(getUploadResponseError(413, '<html>proxy rejection</html>'), '文件超过服务器允许的大小，请压缩或拆分文件后重试。');
assert.equal(getUploadResponseError(400, JSON.stringify({ error: 'Please choose a PDF.' })), 'Please choose a PDF.');
assert.match(getUploadResponseError(500, '<html>failure</html>'), /HTTP 500.*文件未上传/);
assert.equal(requestLimits.isPayloadTooLargeError({ code: 'LIMIT_FILE_SIZE' }), true);
assert.match(requestLimits.PAYLOAD_TOO_LARGE_MESSAGE, /files are too large/i);

console.log('supplier-catalog-upload-contract: 22/22 PASS');
