# 07 — SEO/GEO 引擎

## 两层优化

| 层 | 目标 | 技术 |
|----|------|------|
| **SEO** | Google / Bing 传统搜索引擎 | Helmet + JSON-LD + Sitemap + Canonical |
| **GEO** | ChatGPT Search / Perplexity / Claude 等 AI 搜索 | Prerender + AI 爬虫白名单 + 结构化数据 |

---

## 一、页面级 SEO

### 必填标签（Linter 强制）

每个公开页面的 `<Helmet>` 必须包含：

| 标签 | 说明 |
|------|------|
| `<title>` | 包含 "Tarmeer"，有意义的描述 |
| `<meta name="description">` | 50-320 字符 |
| `<meta property="og:title">` | Open Graph 标题 |
| `<meta property="og:description">` | Open Graph 描述 |
| `<meta property="og:image">` | 社交分享图 |
| `<link rel="canonical">` | `https://www.tarmeer.com/...` |

### SEO Linter

**文件**: `scripts/harness/lint-seo.mjs`

```bash
node scripts/harness/lint-seo.mjs
# 扫描所有 PUBLIC_PAGES 数组中的页面文件
# 检查 6 项必填标签
# 失败 → 非零退出码（可用于 CI）
```

### Title 模式

```
详情页: {Project} - {Tag1 Tag2} Design in {Location} by {Company} | Tarmeer
列表页: {Page Title} - Tarmeer UAE
```

---

## 二、JSON-LD 结构化数据

### 覆盖矩阵（12 种 Schema）

| 页面 | Schema 类型 | 用途 |
|------|------------|------|
| 首页 | `WebSite` + `Organization` | 站点搜索 + 知识面板 |
| 公司列表 | `ItemList` | 结构化公司列表 |
| 公司详情 | `LocalBusiness` | 公司信息卡 |
| 项目详情 | `ImageGallery` + `BreadcrumbList` | 图片画廊 + 面包屑导航 |
| Portfolio | `CollectionPage` + `ItemList` | 作品集 |
| 展厅 | `ItemList` | 展厅列表 |
| 联系页 | `ContactPage` + `Organization` | 联系信息 |
| 品牌页 | `Brand` | 品牌信息 |
| FAQ | `FAQPage` | Q&A（AI 提取 + Google 富摘要）|
| 3 个服务页 | `Service` | 服务描述 |

### ImageGallery 示例

```json
{
  "@context": "https://schema.org",
  "@type": "ImageGallery",
  "name": "Villa Project - Modern Living Room Design in Dubai",
  "description": "...",
  "url": "https://www.tarmeer.com/companies/archlon/villa-project",
  "author": {
    "@type": "Organization",
    "name": "Archlon Group",
    "url": "https://www.tarmeer.com/companies/archlon",
    "logo": "https://www.tarmeer.com/images/logos/archlon/logo.png"
  },
  "locationCreated": {
    "@type": "Place",
    "name": "Dubai, UAE",
    "address": { "@type": "PostalAddress", "addressLocality": "Dubai", "addressCountry": "AE" }
  },
  "genre": "modern",
  "keywords": "modern, living room, villa, dubai",
  "dateCreated": "2024",
  "numberOfItems": 15,
  "image": [
    { "@type": "ImageObject", "contentUrl": "...", "name": "...", "caption": "..." }
  ]
}
```

### FAQPage 示例

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I choose an interior design company in the UAE?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Look for companies with verified portfolios..."
      }
    }
  ]
}
```

**AI 搜索引擎**（ChatGPT Search、Perplexity）特别擅长提取 FAQPage schema 中的 Q&A 内容作为回答来源。

---

## 三、动态 Sitemap

**文件**: `public/sitemap.xml` (由后端动态生成)

### Sitemap Index 结构

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.tarmeer.com/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.tarmeer.com/sitemap-companies.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.tarmeer.com/sitemap-projects.xml</loc>
  </sitemap>
</sitemapindex>
```

### 包含的 URL

| 子 sitemap | 内容 |
|------------|------|
| static | 首页、公司列表、Portfolio、FAQ、联系、3 个服务页、建材 |
| companies | 87 家公司详情页 |
| projects | 所有已发布项目详情页 |

每个 URL 包含 `<lastmod>` 时间戳。

---

## 四、Prerender 服务

### 问题

Tarmeer 是 React SPA，搜索引擎和 AI 爬虫看到的是空 HTML 壳：

```html
<div id="root"></div>
<script src="/assets/index.js"></script>
```

### 解决方案

Puppeteer 预渲染服务，检测到爬虫 UA 时返回完整渲染的 HTML。

**文件**: `server/prerender/index.js`

```
请求流程:
  Nginx 收到请求
    ├── UA 匹配爬虫列表?
    │   ├── 是 → proxy_pass 到 prerender 服务 (port 3003)
    │   │         ├── Puppeteer 打开页面
    │   │         ├── 等待渲染完成
    │   │         ├── 缓存 HTML
    │   │         └── 返回完整 HTML
    │   └── 否 → 返回 SPA（正常流程）
```

### PM2 配置

```javascript
// server/prerender/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tarmeer-prerender',
    script: 'index.js',
    instances: 1,
    max_memory_restart: '500M',
  }]
};
```

### Watchdog 守护进程

**文件**: `server/prerender/ops/geo_watchdog.py`

| 功能 | 周期 |
|------|------|
| 健康检查 | 每 5 分钟 |
| 缓存清理 | 每天 |
| Chromium 更新 | 每周 |
| UA 列表同步 | 每周 |
| 邮件告警 | 异常时 |

---

## 五、AI 爬虫支持

### robots.txt

**文件**: `public/robots.txt`

```
# AI 搜索引擎 — 明确允许
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Applebot
Allow: /

# 传统搜索引擎
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Sitemap
Sitemap: https://www.tarmeer.com/sitemap.xml
```

### 为什么要专门支持 AI 爬虫？

1. **ChatGPT Search** — 用户问 "best interior design companies in Dubai" 时，ChatGPT 会爬取并引用 Tarmeer 的内容
2. **Perplexity** — 直接从网页提取答案，JSON-LD 结构化数据让提取更准确
3. **Google SGE** — Google 的 AI 概述功能也依赖结构化数据

Prerender 确保这些 AI 爬虫拿到完整渲染的 HTML（而非空壳 SPA），JSON-LD 让它们能准确提取公司信息、作品图片、FAQ 回答。

---

## 六、SEO 信号清单（详情页）

每个项目详情页输出以下 SEO 信号：

| 信号 | 内容 |
|------|------|
| `<title>` | 项目名 + 标签 + 地点 + 公司名 |
| `<meta description>` | 项目描述（50-320字符） |
| `<meta keywords>` | 标签 + 风格 + 地域 + 公司名 |
| `<meta og:image>` | 当前查看的图片 + 1200x630 提示 |
| `<meta robots>` | `index, follow, max-image-preview:large` |
| `<link canonical>` | 去除 query params 的干净 URL |
| `article:tag` | 每个标签一个 meta（topic clusters） |
| JSON-LD ImageGallery | 最多 20 个 ImageObject + 公司/地点信息 |
| JSON-LD BreadcrumbList | Home > Portfolio > Company > Project |
