# 05 — 图片系统

## 系统全景

```
                        ┌──────────────────────────────┐
                        │        图片生命周期            │
                        └──────────────────────────────┘

 ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  采集    │ → │  清洗    │ → │ 变体生成  │ → │  存储    │ → │  展示    │
 │ 爬虫抓取 │   │ 六层过滤 │   │ 3级WebP  │   │ 文件系统 │   │ LQIP渐进 │
 │ 用户上传 │   │ CLIP分类 │   │ Sharp处理│   │ DB存路径 │   │ SmartImg │
 └─────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## 一、图片变体生成

### 技术：Sharp + WebP

**文件**: `server/src/lib/imageVariants.ts`

```typescript
const VARIANTS = [
  { suffix: '-blur',   maxLongEdge: 40,  quality: 20 },  // ~1 KB
  { suffix: '-thumb',  maxLongEdge: 400, quality: 75 },  // ~15 KB
  { suffix: '-medium', maxLongEdge: 800, quality: 80 },  // ~50 KB
];
```

### 生成逻辑

```
输入: /images/portfolio/company/photo.jpg (原图, ~200KB)

generateVariants(imagePath)
  ├── 读取 metadata (width, height)
  ├── 遍历 3 个变体配置
  │   ├── 检查 outPath 是否已存在（跳过已有）
  │   ├── 计算等比缩放: scale = maxLongEdge / max(w, h)
  │   ├── sharp(input).resize(w, h, { fit: 'inside', withoutEnlargement: true })
  │   ├── .webp({ quality })
  │   └── .toFile(outPath)
  └── 返回生成的文件路径列表

输出:
  /images/portfolio/company/photo-blur.webp    (40px,  1KB)
  /images/portfolio/company/photo-thumb.webp   (400px, 15KB)
  /images/portfolio/company/photo-medium.webp  (800px, 50KB)
```

### 批量生成脚本

**文件**: `scripts/generate-thumbnails.mjs`

```bash
# 预览（dry-run）
node scripts/generate-thumbnails.mjs

# 执行生成
node scripts/generate-thumbnails.mjs --apply

# 指定目录
node scripts/generate-thumbnails.mjs --apply --dir public/images/uae-companies/portfolio
```

默认扫描目录:
- `public/images/uae-companies/portfolio/` — 爬虫抓取的公司作品
- `server/public/uploads/projects/` — 用户上传的项目

### 数据规模

| 指标 | 数据 |
|------|------|
| 原图数量 | 7,142 张 |
| thumb 变体 | 6,880 张 |
| medium 变体 | 6,880 张 |
| blur 变体 | 6 张 |
| 覆盖公司 | 87 家 |
| 图库总量 | 956 MB |

### URL 格式

```
原图:   /images/uae-companies/portfolio/company-slug/category/photo.jpg
Blur:   /images/uae-companies/portfolio/company-slug/category/photo-blur.webp
Thumb:  /images/uae-companies/portfolio/company-slug/category/photo-thumb.webp
Medium: /images/uae-companies/portfolio/company-slug/category/photo-medium.webp
```

**辅助函数**: `variantUrl(originalUrl, 'thumb')` — 自动生成变体 URL。

---

## 二、LQIP 渐进加载

### 原理

```
用户打开页面
  ├── Step 1: 显示 blur 变体 (1KB, <50ms)
  │   └── 40px 小图 CSS filter: blur(20px) 放大到容器尺寸
  ├── Step 2: 加载 thumb 变体 (15KB, ~200ms)
  │   └── 400px 缩略图，清晰度足够列表展示
  └── Step 3: 用户点击放大时才加载原图 (200KB)
```

### 前端实现

**文件**: `src/lib/imageUrl.ts`

```typescript
// 解析变体 URL
export function resolveVariantUrl(url: string, variant: 'blur' | 'thumb' | 'medium'): string {
  const dot = url.lastIndexOf('.');
  return `${url.slice(0, dot)}-${variant}.webp`;
}
```

**文件**: `src/components/MasonryGallery.tsx`

```tsx
// 图片先显示 blur 占位，再加载缩略图
<img
  src={resolveVariantUrl(image.url, 'thumb')}
  style={{
    backgroundImage: `url(${resolveVariantUrl(image.url, 'blur')})`,
    backgroundSize: 'cover',
  }}
/>
```

---

## 三、SmartImage 多格式 Fallback

### 问题

不同来源的图片可能是 jpg/png/webp/avif，URL 扩展名可能错误或缺失。

### 解决方案

**文件**: `src/components/ui/SmartImage.tsx`

```
SmartImage 加载流程:
  ├── 尝试原始 URL
  ├── 失败 → 尝试 .jpg 版本
  ├── 失败 → 尝试 .png 版本
  ├── 失败 → 尝试 .webp 版本
  ├── 失败 → 尝试 .avif 版本
  └── 全部失败 → 显示 fallback placeholder

全局维护一个 failedUrls Set，避免重复请求已知失败的 URL。
```

---

## 四、六层图片质量流水线

### 爬虫阶段（服务端）

| 层 | 过滤器 | 规则 | 文件 |
|----|--------|------|------|
| 1 | URL 级过滤 | 跳过 logo、icon、SVG、社交媒体图标 | scraper 脚本 |
| 2 | 文件级过滤 | sips 检查：< 200x150px 或 < 5KB 删除 | scraper 脚本 |
| 3 | CLIP 分类 | `@xenova/transformers` 零样本判断是否"室内设计" | `filter-non-architecture.mjs` |
| 4 | 色彩启发式 | 色彩贫乏（< 3 色）/ 低饱和度 检测 | `rescrape-low-quality.mjs` |

### 运行时阶段（浏览器端）

| 层 | 过滤器 | 规则 | 文件 |
|----|--------|------|------|
| 5 | Canvas 指纹去重 | 缩到 16x16 灰度，相似度 > 0.92 = 重复 | `MasonryGallery.tsx` |
| 6 | 质量检测 | 暗图(亮度<45)、极端宽高比(>3.5/<0.25)、小图(<200x150) | `MasonryGallery.tsx` |

### CLIP 过滤详情

```javascript
// filter-non-architecture.mjs
import { pipeline } from '@xenova/transformers';

const classifier = await pipeline('zero-shot-image-classification');

const result = await classifier(imagePath, [
  'interior design',
  'architecture',
  'building exterior',
  'not architecture',  // 反面标签
  'logo',
  'portrait',
]);

// 置信度 < 50% for "interior design" → 过滤掉
```

### Canvas 指纹去重详情

```javascript
// MasonryGallery.tsx - 浏览器端
function getFingerprint(img) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;

  // 转灰度
  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
  }
  return gray; // 256 个灰度值
}

function similarity(a, b) {
  // 计算余弦相似度
  // > 0.92 → 判定为重复图片
}
```

---

## 五、图片存储规则

### 存储路径

| 类型 | 路径模式 | 示例 |
|------|----------|------|
| 头像 | `/uploads/avatars/{userId}-{uuid}.{ext}` | `/uploads/avatars/5-a1b2c3.jpg` |
| 项目图片 | `/uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}` | `/uploads/projects/3/12/2026/04/d4e5f6.jpg` |
| 爬虫图片 | `/images/uae-companies/{type}/{slug}/{category}/{filename}` | `/images/uae-companies/portfolio/archlon/residential/1.jpg` |

### 铁律：禁止 Base64 入库

```typescript
// server/src/lib/projectPersistence.ts
function validateNoBase64Images(images: string[]) {
  for (const img of images) {
    if (img.startsWith('data:')) {
      throw new Error('Base64 images must not be stored in database');
    }
  }
}
```

DB 只存相对路径，图片文件存文件系统。如发现 DB 中有 base64 数据：

```bash
node scripts/migrate-base64-avatars.mjs --apply
```

---

## 六、瀑布流画廊引擎

### 文件: `src/components/MasonryGallery.tsx`

### 功能矩阵

| 功能 | 实现 |
|------|------|
| 响应式列数 | 1 列(手机) / 2 列(平板) / 3 列(桌面) |
| 分类 tab | 动态生成 + 计数 badge + AnimatePresence 切换 |
| 分页加载 | 每次 12 张，"Load More" 按钮 |
| 指纹去重 | 16x16 Canvas 灰度，相似度 > 0.92 隐藏 |
| 暗图检测 | 平均亮度 < 45 隐藏 |
| 宽高比过滤 | > 3.5 或 < 0.25 隐藏 |
| 小图过滤 | < 200x150 隐藏 |
| Stagger 动画 | `delay: min(i * 0.04, 0.5)` |
| 点击行为 | claimed → Lightbox / scraped → 外部链接 |
| LQIP | blur 占位 → thumb → 原图 |
