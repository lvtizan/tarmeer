#!/usr/bin/env node
// 管理员供应商页的图片入口必须和供应商个人中心复用同一上传组件：
// 拖放/粘贴/文件夹递归/大图压缩均由 ImageUploadZone 统一保证。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('src/app/admin/suppliers/[id]/page.tsx');
const zone = read('src/components/ui/ImageUploadZone.tsx');
const routes = read('server/dist/routes/admin.js');
const controller = read('server/dist/controllers/supplierAdminController.js');

assert.match(page, /import ImageUploadZone from '@\/components\/ui\/ImageUploadZone'/, '后台供应商页必须直接复用公共上传组件');
assert.match(page, /suppliers\/\$\{id\}\/product-image/, '新增产品必须走受管控的后台图片上传入口');
assert.match(page, /suppliers\/\$\{supplierId\}\/project-image/, '项目图片也必须走同一上传组件');
assert.match(page, /newProductImages\.length === 0/, '新增产品前必须校验至少有一张已上传图片');
assert.match(page, /for \(const image_url of newProductImages\)/, '批量选择或文件夹拖入的图片必须逐张落为产品');
assert.doesNotMatch(page, /Image URL \(e\.g\./, '后台不得再要求管理员手填图片 URL');

assert.match(zone, /prepareImageForUpload/, '公共组件必须先自动压缩超体积图片');
assert.match(zone, /getDroppedFiles/, '公共组件必须递归读取拖入文件夹');
assert.match(zone, /document\.addEventListener\('paste'/, '公共组件必须支持粘贴截图');
assert.match(zone, /createPasteZoneRegistry/, '多个上传区并存时必须维护挂载顺序，避免粘贴广播');
assert.match(zone, /pasteZoneRegistry\.isCurrent\(zoneIdRef\.current\)/, '无焦点粘贴必须只交给最新挂载的上传区，不能广播给全部表单');
assert.match(zone, /pasteZoneRegistry\.unmount\(zoneIdRef\.current\)/, '弹窗上传区卸载后必须回退到前一个上传区');
assert.match(zone, /const failures: string\[\]/, '批量上传必须逐项收集失败，不能首错即停');
assert.match(zone, /showPreviews/, '已有图库预览的后台项目页可以仅复用上传交互');

assert.match(routes, /suppliers\/:id\/product-image'.*requireSupplierCountryScope.*uploadImageFile.*adminUploadProductImage/, '产品图上传必须有供应商查看权限、国家范围校验及 20MB multipart 限额');
assert.match(routes, /suppliers\/:id\/project-image'.*requireSupplierCountryScope.*uploadImageFile/, '项目图上传必须采用同一安全限额');
assert.match(routes, /LIMIT_FILE_SIZE.*413/, '超出图片上传上限必须明确返回 413');
assert.match(controller, /function adminUploadProductImage/, '后台必须实现产品图片上传控制器');
assert.match(controller, /Only images are allowed\./, '后台上传入口必须拒绝非图片');
assert.match(controller, /processStrictUploadedImage/, '后台上传入口必须完整转码，不能只信任 MIME');
assert.match(controller, /Product image must be uploaded for this supplier\./, '新增产品不得绕过受控上传入口提交外链或其他供应商图片');
assert.match(controller, /Project images must be uploaded for this supplier\./, '项目图片不得绕过受控上传入口跨供应商引用');
assert.match(controller, /MAX_ADMIN_PROJECT_IMAGES = 200/, '项目图片必须限制数量，避免无界文件系统检查');
assert.match(controller, /supplier_product_image_upload/, '后台产品图片上传必须写入审计日志');
assert.match(controller, /projects\/\$\{ts\}_\$\{\(0, crypto_1\.randomUUID\)\(\)\}/, '项目图片文件名必须带 UUID，防止同毫秒上传互相覆盖');

console.log('admin-supplier-image-upload-reuse: 25/25 PASS');
