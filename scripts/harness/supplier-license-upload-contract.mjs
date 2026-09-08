// 供应商营业执照上传契约：必须走 multipart，图片复用公共压缩，后端可接收 file。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const client = read('src/components/ui/FileUploadButton.tsx');
const route = read('server/dist/routes/suppliers.js');
const controller = read('server/dist/controllers/supplierProfileController.js');
const products = read('src/app/supplier/products/page.tsx');
const projects = read('src/app/supplier/projects/page.tsx');
const catalogs = read('src/app/supplier/catalogs/page.tsx');

assert.match(client, /prepareImageForUpload/, '营业执照图片必须复用公共自动压缩');
assert.match(client, /new FormData\(\)/, '营业执照必须使用 multipart，不能 Base64 膨胀');
assert.doesNotMatch(client, /readAsDataURL/, '营业执照前端不得再编码 Base64');
assert.match(route, /upload-license', supplierAuth_1\.authenticateSupplier, upload\.single\('file'\)/, '营业执照路由必须接收 multipart file');
assert.match(controller, /req\.file/, '营业执照控制器必须支持 multipart file');

assert.match(products, /autoTranslateTitle[\s\S]*?catch \(err: unknown\)[\s\S]*?setMsg\(/, '自动翻译失败必须给出可见提示');
for (const [name, source] of [['products', products], ['projects', projects], ['catalogs', catalogs]]) {
  assert.match(source, /const handleDelete[\s\S]*?const res = await fetch[\s\S]*?if \(!res\.ok\) throw new Error[\s\S]*?set[A-Za-z]+\(prev => prev\.filter/, `${name} 删除必须先确认服务端成功`);
}

console.log('supplier-license-upload-contract: 9/9 PASS');
