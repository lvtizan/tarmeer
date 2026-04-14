# Tarmeer 4.0 技术手册

> UAE 室内设计行业平台 — 连接业主与设计公司
> https://www.tarmeer.com

---

## 项目总览

| 指标 | 数据 |
|------|------|
| 前端页面 | 66 个 (.tsx) |
| 前端组件 | 42 个 (.tsx) |
| 后端 Controller | 24 个 |
| 后端路由文件 | 13 个 |
| 后端 Lib 工具 | 64 个 |
| API 端点总数 | 164 个 |
| 总代码行数 | 47,674 行 (TypeScript) |
| 数据库表 | 16+ 张 |
| 前端依赖 | 20 个 |
| 后端依赖 | 26 个 |
| 工具脚本 | 35 个 (含 scraper) |
| 收录公司 | 87 家 (含 7,142 张作品图) |

---

## 技术栈一览

```
                    ┌────────────────────────────────────┐
                    │          Nginx (SSL 终止)           │
                    │   www.tarmeer.com / admin.tarmeer   │
                    └──────────┬─────────────┬───────────┘
                               │             │
                    ┌──────────▼──┐   ┌──────▼──────────┐
                    │  前端 SPA    │   │   后端 API       │
                    │  React 19   │   │   Express 4      │
                    │  Vite 6     │   │   Port 3002      │
                    │  TW CSS 4   │   │   PM2 管理       │
                    └──────────┬──┘   └──────┬──────────┘
                               │             │
                    ┌──────────▼─────────────▼───────────┐
                    │      Aliyun RDS MySQL (Dubai)       │
                    │         utf8mb4 · 16+ 表            │
                    └────────────────────────────────────┘
```

---

## 模块详解

---

### 一、前端框架层

**技术：React 19 + TypeScript 5.7 + Vite 6 + Tailwind CSS 4**

| 技术 | 亮点 |
|------|------|
| **React 19** | 最新版 React，createRoot API，并发特性 |
| **Vite 6** | 极速 HMR（<50ms），vendor/animations 手动分包，build 15 秒完成 |
| **Tailwind CSS 4** | 零运行时，通过 @tailwindcss/vite 插件直接编译，自定义 CSS 变量主题 |
| **TypeScript 5.7** | 严格类型，全栈统一语言，前后端共享类型 |
| **React Router 6** | 66 个页面全部 `React.lazy()` 懒加载，按路由分包 |
| **Framer Motion 12** | 页面转场、瀑布流 stagger 动画、tab 切换 AnimatePresence |

**路由架构：**
- `/` — 公开页面（Layout 壳 = Navbar + Footer）
- `/admin/*` — Admin 后台（AdminLayout + 权限网关）
- `/company/*` — 公司后台（CompanyLayout + ProtectedRoute）
- `/dashboard/*` — 业主后台（UserDashboardLayout）
- 所有旧路径 `/designer/*` `/designers` `/login` 自动 301 重定向

---

### 二、认证与权限系统

**技术：Passport.js + JWT + Google One Tap + Facebook OAuth**

| 技术 | 亮点 |
|------|------|
| **Passport.js** | 多策略 OAuth 登录框架，Google/Facebook 一键登录 |
| **JWT** | 无状态认证，支持 secret rotation，启动时自动校验配置 |
| **Google One Tap** | 页面加载即弹出登录，零点击注册，转化率碾压传统表单 |
| **角色切换** | 单用户多角色（homeowner/company），一键切换不用重新登录 |
| **Admin 隔离** | 独立 admin_users 表 + 独立 JWT + 细粒度 permissions JSON |

**架构设计：**
- `users` 表是所有非 admin 用户的单一真相源
- `role` = 能力（永久），`active_role` = 当前视图模式
- OAuth Session 仅存活 10 分钟（只撑过 redirect 往返）
- Admin 支持超级管理员 + 子管理员 + `permissions` JSON 列精确控权

---

### 三、公司数据双源合并系统

**技术：MySQL 双表查询 + 前端并行请求 + 智能去重合并**

| 技术 | 亮点 |
|------|------|
| **双数据源** | 爬虫抓取的目录公司（uae_companies）+ 注册公司（company_profiles）|
| **合并规则** | 目录公司（有图）永远排在前面，注册公司追加，按公司名去重 |
| **权重评分** | `weight_score` 字段，`weight_config` 表可动态配置评分规则 |
| **前端并行** | `Promise.all` 同时请求两个 API，合并后渲染，用户无感知 |

**这个设计的牛B之处：**
平台冷启动时就有 87 家真实公司 + 7,142 张作品图——不是占位数据，是从真实公司网站抓取的。注册公司和目录公司无缝合并，用户看到的是一个统一的列表。目录公司绑定到注册用户后（`owner_user_id`）自动合并为一条。

---

### 四、爬虫与数据采集系统

**技术：Puppeteer + Cheerio + CLIP 模型 + Sharp**

| 技术 | 亮点 |
|------|------|
| **Puppeteer** | 无头浏览器抓取，自动滚动加载 lazy-load 图片 |
| **Cheerio** | 轻量 HTML 解析，提取 logo/portfolio/元数据 |
| **CLIP 零样本分类** | 用 @xenova/transformers 加载 170MB CLIP 模型，零标注判断"这张图是不是建筑/室内设计"——50% 置信度以下直接过滤 |
| **六层图片质量过滤** | URL 级 → 尺寸级 → Canvas 指纹去重 → 暗图检测 → 宽高比过滤 → 色彩贫乏启发式过滤 |

**爬虫脚本矩阵（10 个脚本）：**

| 脚本 | 功能 |
|------|------|
| `scrape-logos.mjs` | 抓取公司 logo + portfolio 图片 |
| `scrape-portfolio-categories.mjs` | Puppeteer 抓取分类页，增量式（crawl-manifest.json 跟踪状态） |
| `scrape-portfolio-enhanced.mjs` | 30+ 公司 URL，渐进滚动检测 lazy-load |
| `filter-non-architecture.mjs` | CLIP 模型过滤非建筑图片 |
| `rescrape-low-quality.mjs` | 重新抓取低质量公司数据 |
| `dedup-images.mjs` | 图片去重 |
| `compress-images.py` | Python 图片压缩 |
| `sync-to-db.mjs` | 同步 JSON 数据到 MySQL |
| `detect-people.py` | 人物检测过滤 |
| `scrape-companies.mjs` | 公司基础信息抓取 |

**这个设计的牛B之处：**
不是简单的爬虫 + 入库。六层过滤流水线把垃圾图片（logo、社交图标、暗图、重复图、非建筑图、色彩贫乏图）全自动清洗掉，最终 7,142 张图全是高质量建筑/室内设计作品。CLIP 模型的引入让图片分类不需要任何人工标注。

---

### 五、图片优化与渐进加载系统

**技术：Sharp + WebP 变体 + LQIP (Low Quality Image Placeholder)**

| 技术 | 亮点 |
|------|------|
| **Sharp** | Node.js 高性能图片处理，基于 libvips，速度是 ImageMagick 的 10 倍 |
| **三级变体** | 每张原图生成 blur(40px) + thumb(400px) + medium(800px) 三个 WebP 变体 |
| **LQIP** | 页面先加载 ~1KB 的 blur 占位图，渐进过渡到缩略图再到原图 |
| **SmartImage** | 自动尝试 jpg/png/webp/avif 四种格式，全局记录失败 URL 避免重复请求 |

**变体规格：**

| 变体 | 最长边 | 质量 | 用途 | 典型大小 |
|------|--------|------|------|----------|
| `-blur` | 40px | 20% | 模糊占位 | ~1 KB |
| `-thumb` | 400px | 75% | 列表缩略图 | ~15 KB |
| `-medium` | 800px | 80% | 详情页 | ~50 KB |
| 原图 | 原始 | 原始 | Lightbox 放大 | ~200 KB |

**数据规模：**
- 7,142 张原图 → 生成 13,766 张变体（6,880 thumb + 6,880 medium + 6 blur）
- 图库总量 956 MB，覆盖 87 家公司

**这个设计的牛B之处：**
用户打开公司 portfolio 页面时，先看到一片模糊渐变色块（blur 变体，~1KB），然后秒级加载缩略图，点击才加载原图。首屏感知速度提升 3-5 倍。SmartImage 组件的多格式 fallback 让老旧 CDN 和浏览器兼容性问题完全透明化。

---

### 六、瀑布流画廊引擎

**技术：自研 Masonry 布局 + Canvas 指纹去重 + Framer Motion 动画**

| 技术 | 亮点 |
|------|------|
| **响应式瀑布流** | 1/2/3 列自适应，不依赖任何 masonry 库 |
| **Canvas 指纹去重** | 每张图缩到 16x16 灰度，计算相似度，>0.92 判定为重复 |
| **五层运行时过滤** | 加载时过滤小图(<200x150)、极端宽高比(>3.5/<0.25)、暗图(亮度<45)、重复图 |
| **分类标签页** | 动态生成分类 tab + 计数 badge |
| **分页加载** | 每次 12 张，滚动加载更多 |
| **Framer Motion** | fade-in + stagger 动画，切换分类时 AnimatePresence 过渡 |

**这个设计的牛B之处：**
不是简单地把图片摆上去。五层运行时过滤 + Canvas 指纹去重保证同一家公司的 portfolio 里不会出现重复图、暗图、小图、奇怪比例的图。用户看到的每一张都是高质量的。而且这些过滤是在浏览器端实时执行的，不需要预处理。

---

### 七、CRM 集成系统

**技术：异步 HTTP Push + 双重校验 + 状态追踪 + 手动重试**

| 技术 | 亮点 |
|------|------|
| **Fire-and-forget** | CRM 推送不阻塞用户提交，用 `setImmediate` 异步执行 |
| **双重校验** | HTTP 2xx + 响应体 `code === 0` 都通过才算成功 |
| **状态机** | `crm_sync_status`: pending → synced / failed |
| **错误快照** | 失败时保存 httpStatus + code + message 到 `crm_last_error` |
| **手动重试** | Admin 后台一键 Resend，立即反馈成功/失败 |
| **动作追踪** | CRM 返回 `action`: created/updated/linked/duplicate |

**DB 字段：**
- `crm_sync_status` — pending / synced / failed
- `crm_lead_id` — CRM 返回的 lead UUID
- `crm_action` — created / updated / linked / duplicate
- `crm_last_error` — JSON 序列化的错误详情
- `crm_sync_attempts` — 推送尝试次数

**这个设计的牛B之处：**
CRM 同步做到了"不丢、不堵、可追、可重试"。inquiry 提交永远不会因为 CRM 挂了而失败。Admin 后台能看到每条 inquiry 的 CRM 同步状态、action 类型、失败原因，并且一键重试。`linked` 状态（CRM 合并到已有 lead）还会显示黄色警告，提醒运营团队检查。

---

### 八、SEO/GEO 引擎

**技术：React Helmet + JSON-LD + 动态 Sitemap + Prerender + AI 爬虫支持**

| 技术 | 亮点 |
|------|------|
| **React Helmet Async** | 每页独立的 title/desc/og/canonical，SSR 兼容 |
| **JSON-LD** | 12 种 schema 类型覆盖所有页面（WebSite、LocalBusiness、ImageGallery、FAQPage、Service...）|
| **SEO Linter** | 自动化检查工具，CI 级别强制所有公开页面 6 项必填标签 |
| **动态 Sitemap** | sitemap index → 子 sitemap，含所有项目页、FAQ、服务页 + lastmod |
| **Prerender** | Puppeteer 预渲染服务，AI 爬虫请求时返回完整 HTML |
| **AI 爬虫** | robots.txt 明确允许 GPTBot/ChatGPT-User/PerplexityBot/ClaudeBot/Applebot |
| **Watchdog** | Python 守护进程：健康检查、缓存清理、Chromium 更新、UA 同步、邮件告警 |

**JSON-LD 覆盖矩阵（12 种）：**

| 页面 | Schema 类型 |
|------|------------|
| 首页 | WebSite + Organization |
| 公司列表 | ItemList |
| 公司详情 | LocalBusiness |
| 项目详情 | ImageGallery + BreadcrumbList |
| Portfolio | CollectionPage + ItemList |
| 展厅 | ItemList |
| 联系 | ContactPage + Organization |
| 品牌 | Brand |
| FAQ | FAQPage |
| 3 个服务页 | Service |

**这个设计的牛B之处：**
不只是传统 SEO。GEO（Generative Engine Optimization）是专门为 AI 搜索引擎（ChatGPT Search、Perplexity 等）优化的。Prerender 服务让 AI 爬虫拿到完整渲染的 HTML（而不是空壳 SPA），JSON-LD 结构化数据让 AI 能准确提取公司信息、项目图片、FAQ 内容。FAQPage schema 在 Google 搜索和 AI 搜索中都能触发富摘要展示。

---

### 九、Admin 后台系统

**技术：21 个管理页面 + 100+ API 端点 + RBAC 权限**

| 功能模块 | 能力 |
|----------|------|
| 用户管理 | CRUD + 角色变更 + 软删除 + 详情查看 |
| 公司管理 | 审核/驳回 + 目录公司绑定 + Excel 批量导入 |
| Inquiry 管理 | 状态流转 + Admin 备注 + Excel 导出 + 批量软删除/恢复 + 审计日志 |
| 项目管理 | 审核/驳回 + 详情编辑 + 恢复已删除 |
| 投诉管理 | DMCA/版权投诉处理 |
| 分析看板 | 访客统计 + IP 地理定位 + 页面浏览/点击事件 |
| 角色管理 | 子管理员 + permissions JSON 精确控权 |
| 通知邮件 | 动态配置接收人列表 |
| 审计日志 | 所有删除操作记录 admin_id + reason + 数据快照 |

**这个设计的牛B之处：**
Admin 不只是 CRUD。审计日志系统在每次批量删除 inquiry 时保存完整数据快照（snapshot），即使误删也能追溯原始数据。子管理员的 `permissions` 是 JSON 列，可以精确到单个能力（can_approve、can_delete...）。Excel 导入/导出让运营团队不需要直接操作数据库。

---

### 十、安全防护体系

**技术：多层防御 — 反爬 + 限流 + CORS + Helmet + 输入校验**

| 防护层 | 技术 | 细节 |
|--------|------|------|
| **反爬虫** | User-Agent 黑名单 | 13 种爬虫库（python-requests/scrapy/curl/axios...）返回 403 |
| **SEO 白名单** | Bot 通行 | googlebot/bingbot/applebot 等 13 种搜索引擎放行 |
| **API 限流** | express-rate-limit | 公共 API 60 req/min/IP，超出封禁 5 分钟 |
| **登录限流** | 独立策略 | Admin 登录 5 次/15min/IP |
| **CORS** | 生产白名单 | 6 个允许源，违规记录日志 |
| **Helmet** | HTTP 安全头 | XSS、MIME、CSP 等 HTTP 安全头自动设置 |
| **手机号校验** | 前端+后端双重 | GCC 国家码下拉 + 数字限位 + 连续重复数字检测 + 位数校验 |
| **图片安全** | Base64 禁入库 | `validateNoBase64Images()` 强制拦截，20MB 上传限制 |

---

### 十一、分析与追踪系统

**技术：自建 Analytics + IP 地理定位 + 多维事件追踪**

| 维度 | 追踪内容 |
|------|----------|
| **页面浏览** | entity_type + entity_id + viewer_ip + fingerprint + referrer + UA |
| **点击事件** | phone / whatsapp / email / contact_form 各维度独立计数 |
| **访客日志** | IP + 地理位置（自动解析）+ 页面路径 + referrer + UA |
| **自定义事件** | event_name + JSON payload，客户端批量上报（max 100/batch） |
| **每日汇总** | designer_stats 表按天聚合 profile_views / project_views / clicks |

**IP 地理定位：**
- 支持 Cloudflare / Vercel / 直连 三种 IP 获取方式
- 三级 fallback 提供商：ipapi.co → ipwho.is → ipinfo.io
- 结果缓存到 `visitor_ip_geo_cache` 表（30 天 TTL）

---

### 十二、邮件与通知系统

**技术：Nodemailer + Aliyun DirectMail + 应用内通知**

| 类型 | 触发 | 接收人 |
|------|------|--------|
| 邮箱验证 | 用户注册 | 用户 |
| 密码重置 | 忘记密码 | 用户/Admin |
| 新注册通知 | 设计师注册 | 配置的通知邮箱组 |
| 项目提交通知 | 设计师上传项目 | 配置的通知邮箱组 |
| 询盘通知 | 业主提交 inquiry | 配置的通知邮箱组 |
| 应用内通知 | 各种事件 | 用户/全局广播 |

**特性：**
- Nodemailer 连接池（5 连接 × 100 消息/池）
- 开发模式 `DEV_SKIP_EMAIL=true` 跳过 SMTP，控制台打印验证链接
- 通知邮箱列表动态配置，Admin 后台可增删
- 应用内通知支持 user-specific + broadcast（null userId）

---

### 十三、数据库自动迁移系统

**技术：启动时自动迁移 — 幂等、只增不删、失败不崩**

```
服务器启动 → autoMigrate()
  ├── CREATE TABLE IF NOT EXISTS（建表）
  ├── ALTER TABLE ADD COLUMN IF NOT EXISTS（加字段）
  ├── CREATE INDEX IF NOT EXISTS（加索引）
  ├── 清理数据（生成缺失 slug、种子默认配置）
  └── 失败只 log，不阻断启动
```

**设计原则：**
- **幂等**：跑多少次结果一样，不会重复建表/加字段
- **只增不删**：只 ADD COLUMN / ADD INDEX，永远不 DROP
- **非阻断**：单条 migration 失败只 console.error，不影响其他
- **无依赖**：不需要额外的 migration 工具（Knex/TypeORM/Prisma），纯 SQL

---

### 十四、部署架构

**技术：Aliyun ECS + Nginx + PM2 + rsync 增量部署**

```
┌─────────────────────────────────────────────────────────────┐
│                    Aliyun ECS (Dubai)                        │
│                    47.91.108.104                              │
├─────────────────────────────────────────────────────────────┤
│  Nginx (80/443 SSL 终止)                                    │
│    www.tarmeer.com      → /tarmeer/tarmeer_web_portal/      │
│    admin.tarmeer.com    → /tarmeer/tarmeer_web_crm/         │
│    */api/*              → proxy_pass :3002                   │
│    tarmeer.com          → 301 → www.tarmeer.com             │
├─────────────────────────────────────────────────────────────┤
│  Backend (PM2, Port 3002)                                   │
│    /tarmeer/tarmeer_api/dist/app.js                          │
├─────────────────────────────────────────────────────────────┤
│  CRM (PM2 Cluster x2, Port 3000)                            │
│    /tarmeer/tarmeer_web_crm/server/index.js                  │
├─────────────────────────────────────────────────────────────┤
│  DB: Aliyun RDS MySQL (Dubai Region)                        │
│    rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com      │
└─────────────────────────────────────────────────────────────┘
```

**部署方式：**
- 前端：`vite build` → `rsync -az --delete --checksum` 增量同步（~1MB/次，<10s）
- 后端：`tsc` → `tar` → `scp` → `pm2 restart`（~30s）
- 永远后端先部署，再前端（避免前端调用不存在的新 API）

---

## 技术亮点总结

| # | 亮点 | 为什么牛 |
|---|------|----------|
| 1 | **CLIP 零样本图片分类** | 不需要任何标注数据，170MB 模型直接判断图片是否是"室内设计"，过滤垃圾图片 |
| 2 | **六层图片质量流水线** | URL → 尺寸 → Canvas 指纹去重 → 暗图 → 宽高比 → 色彩贫乏，全自动清洗 |
| 3 | **双数据源无缝合并** | 爬虫数据 + 注册数据合并成统一列表，冷启动即有 87 家真实公司 |
| 4 | **LQIP 渐进加载** | 1KB blur → 15KB thumb → 原图，首屏感知速度提升 3-5x |
| 5 | **GEO 引擎** | 专为 AI 搜索引擎优化：prerender + 12 种 JSON-LD + AI 爬虫白名单 |
| 6 | **CRM 异步同步** | 不丢不堵可追可重试，失败保存完整错误快照，Admin 一键重发 |
| 7 | **Canvas 指纹去重** | 16x16 灰度指纹，相似度 >0.92 判重复，浏览器端实时执行 |
| 8 | **自动迁移系统** | 启动即迁移，幂等只增不删，不依赖 ORM，不阻断服务 |
| 9 | **Admin 审计日志** | 删除操作保存完整数据快照，支持追溯恢复 |
| 10 | **Google One Tap** | 页面加载即弹窗，一次点击完成注册+登录，转化率远超传统 OAuth 流程 |
