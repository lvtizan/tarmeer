// 把 public/images/insights/_src/ 里的源图(png/jpg/webp)批量转成站点用的 4 档 WebP。
// 用法：先把源图放进 _src/（文件名=目标名，如 cost-cover.png），再运行：
//   node scripts/build-insights-images.mjs
// 产出 public/images/insights/<name>-blur|-thumb|-medium.webp + <name>.webp（chmod 644）。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'public/images/insights/_src');
if (!fs.existsSync(SRC)) { console.error('缺少源图目录:', SRC); process.exit(1); }

const files = fs.readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) { console.error('_src 里没有源图。把 png/jpg 放进去(文件名=目标名, 如 cost-cover.png)后再跑。'); process.exit(1); }

const pairs = files.map((f) => {
  const base = f.replace(/\.(png|jpe?g|webp)$/i, '');
  return `${path.join(SRC, f)}::public/images/insights/${base}`;
});
console.log('转换:', pairs.map((p) => p.split('::')[1].split('/').pop()).join(', '));
execSync(`node scripts/gen-image-variants.mjs ${pairs.map((p) => `"${p}"`).join(' ')}`, { cwd: ROOT, stdio: 'inherit' });
console.log('✅ 完成。四档 WebP 已生成到 public/images/insights/');
