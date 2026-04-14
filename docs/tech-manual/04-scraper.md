# 04 — 爬虫与数据采集系统

## 技术栈

| 技术 | 用途 |
|------|------|
| Puppeteer 24 | 无头浏览器，抓取 JS 渲染页面 |
| Cheerio 1.2 | HTML 解析，提取结构化数据 |
| @xenova/transformers | CLIP 模型，零样本图片分类 |
| Sharp 0.34 | 图片处理（压缩/裁剪） |
| sips (macOS) | 快速获取图片元数据 |

---

## 爬虫脚本矩阵

```
scripts/uae-scraper/
├── scrape-logos.mjs                 # 抓取公司 logo + 基础信息
├── scrape-portfolio-categories.mjs  # 分类页面抓取（增量）
├── scrape-portfolio-enhanced.mjs    # 增强版：lazy-load 检测
├── scrape-companies.mjs             # 公司基础信息抓取
├── filter-non-architecture.mjs      # CLIP 非建筑图过滤
├── rescrape-low-quality.mjs         # 重抓低质量公司
├── dedup-images.mjs                 # 图片去重
├── compress-images.py               # Python 图片压缩
├── detect-people.py                 # 人物检测过滤
└── sync-to-db.mjs                   # JSON → MySQL 同步
```

---

## 抓取流程

### 第一阶段：基础信息

```
scrape-companies.mjs
  ├── 从公司列表页提取: name_en, name_ar, website, phone, whatsapp
  ├── 从公司网站提取: services, specialties, year_established
  ├── 从 Google Maps 提取: rating, reviews_count, address
  └── 输出: companies-data.json (3,390+ 行)
```

### 第二阶段：Logo + Portfolio 图片

```
scrape-logos.mjs
  ├── 逐个访问公司网站
  ├── 提取 logo URL (通常 <img> in header/nav)
  ├── 下载到 public/images/uae-companies/logos/{slug}/
  ├── 提取 portfolio 页面链接
  ├── 下载 portfolio 图片到 public/images/uae-companies/portfolio/{slug}/
  └── 更新 companies-data.json

scrape-portfolio-categories.mjs (增量)
  ├── 读取 crawl-manifest.json (已抓取状态)
  ├── 只处理未抓取的分类页
  ├── Puppeteer 打开分类页
  ├── 提取所有 <img> URLs
  ├── 下载图片到对应 {slug}/{category}/ 目录
  └── 更新 crawl-manifest.json

scrape-portfolio-enhanced.mjs
  ├── 30+ 公司 URL 列表
  ├── Puppeteer 打开页面
  ├── 渐进滚动（检测 lazy-load）
  │   ├── 滚动一屏
  │   ├── 等待 1-2 秒
  │   ├── 检查新图片出现
  │   └── 重复直到无新图片
  └── 提取所有图片 URL
```

### 第三阶段：质量过滤

```
filter-non-architecture.mjs (CLIP 零样本分类)
  ├── 加载 @xenova/transformers CLIP 模型 (~170MB, 首次下载)
  ├── 遍历所有抓取的图片
  ├── 对每张图片运行零样本分类:
  │   候选标签: ["interior design", "architecture", "not architecture", "logo", "portrait"]
  │   ├── "interior design" 置信度 >= 50% → 保留
  │   └── < 50% → 移到 filtered-out/ 目录
  └── 报告: 保留 X 张, 过滤 Y 张

rescrape-low-quality.mjs (启发式过滤)
  ├── Layer 6: 色彩贫乏检测 (< 3 种主要颜色)
  ├── Layer 6: 低饱和度检测
  ├── 对低质量公司重新抓取 portfolio
  └── 重新执行图片过滤流水线
```

### 第四阶段：入库

```
sync-to-db.mjs
  ├── 读取 companies-data-final.json
  ├── 遍历每家公司
  ├── INSERT INTO uae_companies ... ON DUPLICATE KEY UPDATE
  │   字段: name_en, name_ar, slug, logo_url, website, whatsapp,
  │         city, services, specialties, portfolio_images,
  │         year_established, google_rating, google_reviews_count
  └── 报告: 新增 X, 更新 Y
```

---

## 数据存储结构

```
public/images/uae-companies/
├── logos/
│   ├── archlon-group/
│   │   └── logo.png
│   ├── zen-interiors/
│   │   └── logo.jpg
│   └── ... (87 家)
│
└── portfolio/
    ├── archlon-group/
    │   ├── residential/
    │   │   ├── 1.jpg
    │   │   ├── 1-thumb.webp     ← 变体
    │   │   ├── 1-medium.webp    ← 变体
    │   │   ├── 2.jpg
    │   │   └── ...
    │   ├── commercial/
    │   └── general/
    ├── zen-interiors/
    └── ... (87 家, 共 7,142 张原图)
```

---

## CLIP 零样本分类详解

### 原理

CLIP (Contrastive Language-Image Pre-training) 是 OpenAI 训练的视觉-语言模型，能理解图片和文字的语义关系。

**零样本分类**：不需要任何标注数据，只需要给出候选标签的文字描述，CLIP 就能判断图片最匹配哪个标签。

### 实现

```javascript
import { pipeline } from '@xenova/transformers';

// 加载模型（~170MB，首次自动下载）
const classifier = await pipeline(
  'zero-shot-image-classification',
  'Xenova/clip-vit-base-patch32'
);

// 分类
const result = await classifier(imagePath, [
  'interior design photo',
  'architecture building photo',
  'company logo or icon',
  'portrait photo of person',
  'food or restaurant photo',
  'unrelated photo',
]);

// result = [
//   { label: 'interior design photo', score: 0.72 },
//   { label: 'company logo or icon', score: 0.15 },
//   ...
// ]
```

### 过滤效果

过滤掉的典型图片：
- 公司 logo/水印图
- 团队合照/人像
- 社交媒体图标
- 食品/餐饮照片（装修公司官网经常有）
- 装饰性背景图

保留的图片：
- 室内设计实景照
- 建筑外观照
- 平面图/效果图
- 材料展示照

---

## 数据规模

| 指标 | 数据 |
|------|------|
| 抓取公司 | 87 家 |
| 原始图片 | ~12,000+ 张 |
| CLIP 过滤后 | 7,142 张 |
| 过滤率 | ~40% |
| 图库总量 | 956 MB |
| 分类数 | ~10 个标准分类 |
| 原始分类数 | 180 个（归一化到 10 个） |
