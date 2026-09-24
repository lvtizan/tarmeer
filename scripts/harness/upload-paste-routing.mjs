import assert from 'node:assert/strict';
import {
  createPasteZoneRegistry,
  getPasteFiles,
  isWithinFileLimit,
} from '../../src/lib/uploadPasteRouting.js';

const image = { name: 'stone.png', size: 1024, type: 'image/png' };
const pdf = { name: 'catalog.pdf', size: 1024, type: 'application/pdf' };
const imageItem = { type: 'image/png', getAsFile: () => image };
const pdfItem = { type: 'application/pdf', getAsFile: () => pdf };
const registry = createPasteZoneRegistry();
const zoneA = Symbol('A');
const zoneB = Symbol('B');

registry.mount(zoneA);
assert.equal(registry.isCurrent(zoneA), true, '单个上传区无需聚焦即为粘贴目标');
assert.deepEqual(getPasteFiles([pdfItem, imageItem], { acceptClipboardFiles: false, isCurrent: registry.isCurrent(zoneA) }), [image], '默认图片区只接受第一张图片');
assert.deepEqual(getPasteFiles([pdfItem], { acceptClipboardFiles: false, isCurrent: registry.isCurrent(zoneA) }), [], '默认图片区不接收 PDF');

registry.mount(zoneB);
assert.equal(registry.isCurrent(zoneA), false, '新挂载弹窗必须接管粘贴');
assert.equal(registry.isCurrent(zoneB), true, '最新挂载上传区唯一消费粘贴');
assert.deepEqual(getPasteFiles([imageItem], { acceptClipboardFiles: false, isCurrent: registry.isCurrent(zoneA) }), [], '非栈顶上传区不得重复上传');
registry.unmount(zoneB);
assert.equal(registry.isCurrent(zoneA), true, '弹窗卸载后恢复页面上传区');

assert.deepEqual(getPasteFiles([pdfItem], { acceptClipboardFiles: true, isCurrent: true }), [pdf], '目录页 opt-in 后接收 PDF');
const maxBytes = 60 * 1024 * 1024;
assert.equal(isWithinFileLimit({ size: maxBytes }, maxBytes), true, '60MB 文件允许上传');
assert.equal(isWithinFileLimit({ size: maxBytes + 1 }, maxBytes), false, '60MB+1 文件在请求前拒绝');

console.log('upload-paste-routing: 10/10 PASS');
