# 中国新材料跨境采购 · 网站改版 Spec（阶段1 本地闭环）

> 依据：《Tarmeer·中国新材料跨境采购业务项目策划案 v1.0》第三章 + 管理层拍板（2026-07-15）。
> 拍板结论：阶段1全套 / 直接改现有 AE 站（本地先行，不动线上）/ 新页面先英文 / 规格认证数据结构落库。
> 参照站风格：策展式大图 + 品类标签 + 理念文案 + 保障信任区 + 咨询转化（sunyaoshuojiaju.com），用 Tarmeer 金色/stone 设计语言实现，不照抄视觉。

## 1. 目标与验收标准

**目标**：站点定位从「Find Designers / 线索名录」转为「中国新材料展示 + 跨境采购服务」，全站围绕「中国新材料 + 本地建材城保交付保售后」。

**验收标准**（全部满足才算完成）：
1. `/materials` 呈现「按应用场景策展」的新材料目录（场景瓦片 + 跨供应商产品流），供应商列表保留。
2. 新增产品详情页 `/materials/products/[id]`：图集、规格表、认证、应用场景、供应商卡、样品申请表单。
3. 新增 `/services/china-sourcing`（采购全流程 7 步）与 `/guarantee`（本地担保/售后承诺）。
4. 新增 `/for-designers`（设计师采购伙伴计划 + 合作申请表单）。
5. 样品申请 / 到店预约 / 采购咨询 / 设计师合作 四类线索可提交落库（`sourcing_requests`），admin 可查看管理。
6. AE 首页改为新材料主张；VN 首页 **完全不变**。
7. `supplier_products` 支持 `specs / certifications / application_scenes`，admin 可编辑，partner-sync 可同步。
8. tsc 编译绿、`next build` exit=0、smoke-test 全绿、country-walkthrough 全绿。
9. 三轮代码审查通过。

**约束**：
- 本地 only：不部署、不碰生产 DB（`server/.env` DB_HOST=localhost）。
- 国家隔离铁律全程适用（新接口必须 country 过滤；新写入口必须确定 country 归属：phone +84/084 → vn，否则 req.country）。
- 新页面全部 AE 专属：VN 站访问走 `notFound()`（对齐 `/materials` 现有做法）。
- 表单配色铁律：输入框 `bg-white`，主按钮 `bg-[#b8864a] hover:bg-[#a07640]`；封面图 `aspect-video`。
- 不删任何现有页面/路由；companies/experts/portfolio 原样保留（降级仅指首页权重）。

## 2. 数据结构（契约）

### 2.1 `supplier_products` 补列（autoMigrate 补列模式）
| 列 | 类型 | 说明 |
|---|---|---|
| `specs` | JSON NULL | `[{"label":"Thickness","value":"12mm"},...]` |
| `certifications` | JSON NULL | `["CE","ISO 9001","SGS"]` |
| `application_scenes` | JSON NULL | 场景 slug 数组，见 2.3 |

### 2.2 新表 `sourcing_requests`
```sql
CREATE TABLE IF NOT EXISTS sourcing_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_type ENUM('sample','visit','sourcing','designer_partner') NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(160) NULL,
  company_name VARCHAR(160) NULL,
  city VARCHAR(80) NULL,
  message TEXT NULL,
  preferred_date VARCHAR(40) NULL,
  product_id INT NULL,
  supplier_profile_id INT NULL,
  source_page VARCHAR(500) NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'ae',
  status ENUM('new','contacted','completed','rejected') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sourcing_country_status (country, status),
  INDEX idx_sourcing_type (request_type)
)
```
country 归属：phone 前缀 `+84`/`084` → 'vn'，否则 `req.country`（x-country/query）兜底 'ae'。

### 2.3 应用场景 slug 字典（前后端共用，前端源：`src/lib/materialsApi.ts` 的 `APPLICATION_SCENES`）
`feature-wall` Feature Walls / `flooring` Flooring / `countertop` Countertops & Surfaces / `kitchen-bath` Kitchen & Bath / `lighting` Lighting / `furniture` Furniture / `outdoor-garden` Outdoor & Garden / `decor` Décor & Accents

场景 SQL 过滤兼容存量数据：`JSON_CONTAINS(application_scenes,?) OR category IN (映射表[scene])`，映射表（后端常量 `SCENE_CATEGORY_FALLBACK`）：
- feature-wall: stone, paint, wallpaper
- flooring: flooring, stone
- countertop: stone, kitchen
- kitchen-bath: kitchen, bathroom, sanitary, hardware
- lighting: lighting
- furniture: furniture
- outdoor-garden: plants, outdoor
- decor: plants, other, decor

## 3. API 契约

### 3.1 公开产品 feed（新增，`routes/suppliers.js`）
`GET /api/suppliers/products/public?page&limit&category&scene&country`
- 只返回 `sp.status='approved' AND sp.is_published=1 AND sp.country=?` 的供应商的产品
- 返回：`{ products: [{ id,title,description,category,image_url,image_urls,specs,certifications,application_scenes,price,price_unit,price_from, supplier_id,supplier_slug,supplier_name,supplier_origin,supplier_logo }], pagination:{page,limit,total,totalPages} }`
- JSON 列在后端 parse 成数组/对象再返回；LIMIT/OFFSET 用整数拼接（pool.query，不用 execute 传参——已知坑）

`GET /api/suppliers/products/public/:id?country`
- 同上过滤；404 时 `{error}`；返回 `{ product, related }`（related=同 category 其他产品 ≤8 个，同国家）

### 3.2 采购线索（新增，`routes/sourcingRequests.js` 挂 `/api/sourcing-requests`）
`POST /api/sourcing-requests`（限流 20/h/IP）
- body：`{ request_type, name, phone, email?, company_name?, city?, message?, preferred_date?, product_id?, supplier_profile_id?, source_page? }`
- 校验：request_type ∈ 四枚举；name/phone 必填；sample 必须带 product_id
- 落库 country 按 2.2；成功 201 `{ id }`

### 3.3 admin（`routes/admin.js` 追加，authenticateAdmin+requireAdmin，对齐 inquiries 模式）
- `GET /api/admin/sourcing-requests?country&type&status&page&limit` → 列表+分页+各状态计数（country 必须应用）
- `PUT /api/admin/sourcing-requests/:id/status` body `{status}`
- admin 供应商产品编辑接口透传 specs/certifications/application_scenes（找到现有 admin 产品增改端点补字段）

### 3.4 partner-sync
- payload 产品对象接受可选 `specs / certifications / application_scenes`，publish 时写入 `supplier_products` 对应列（partnerPublishService）。

## 4. 前端路由与文件归属（agent 并行分工，禁止越界改共享文件）

| 归属 | 文件/路由 |
|---|---|
| **主协调（人/主循环）** | 本 spec、`src/lib/materialsApi.ts`、`src/components/sourcing/SourcingRequestForm.tsx`、Navbar/Footer/sitemap 集成、smoke-test |
| **Agent BE** | `server/dist/**`（autoMigrate、新 controller/routes、admin.js、partnerPublishService）+ 本地 demo 种子脚本 `scripts/seed-material-specs.js`（幂等，只写本地） |
| **Agent 材料目录** | `src/app/materials/page.tsx`（增量改）、`src/components/materials/**`（新增 MaterialsCatalogClient 等）、`src/app/materials/products/[id]/page.tsx` + Client |
| **Agent 服务页** | `src/app/services/china-sourcing/**`、`src/app/guarantee/**` |
| **Agent 设计师** | `src/app/for-designers/**` |
| **Agent 首页** | `src/app/page.tsx`（AE 分支）、`src/components/home/**` 新增 AE 组件；**VN 渲染路径零改动** |
| **Agent admin** | `src/app/admin/sourcing-requests/**`、admin 供应商产品编辑表单补字段、AdminSidebar 菜单项 |
| **Agent 图片** | `public/images/sourcing/`（AI 生成 hero 图 + gen-image-variants 四档） |

图片路径契约（页面直接引用，图片 agent 负责产出）：
- `/images/sourcing/hero-home.webp`（+ -blur/-thumb/-medium）— AE 首页 hero
- `/images/sourcing/hero-sourcing.webp` — china-sourcing 页 hero
- `/images/sourcing/hero-guarantee.webp` — guarantee 页 hero
- `/images/sourcing/hero-designers.webp` — for-designers 页 hero
- `/images/sourcing/showroom.webp` — 选材中心/预约区块

## 5. 首页重排（仅 AE）

顺序：① 新 Hero（新材料主张 + 双 CTA：Browse Materials / Book a Showroom Visit）→ ② 新材料策展区（场景瓦片+精选产品，读 products/public）→ ③ How China Sourcing Works（4 步摘要 + 链接 china-sourcing）→ ④ 本地担保条（3 承诺 + 链接 /guarantee）→ ⑤ 标杆案例位（首个成交项目故事,链接 insights story）→ ⑥ Local Execution Partners（压缩版装企/设计师区，链接 /companies /experts）→ ⑦ Insights（保留）。
VN：保持现有 `<Banner/><HomeDesignSection/><HomeSpaceSection/><HomeSupplierSection/><HomeInsightsSection/>` 原样。

## 6. SEO
- 新页面进 sitemap AE 分支；产品详情页动态 URL 进 sitemap（有产品才收录）。
- 产品详情页 JSON-LD `Product`（含 brand=supplier、offers 不带价格——业务定价不外显），用 `jsonLdHtml` 转义。
- 服务/担保/设计师页 metadata + canonical；数据缺失分支一律 `notFound()`，禁止软 404。

## 7. 测试
- smoke-test.mjs 补新路由（materials/products 示例、china-sourcing、guarantee、for-designers、admin/sourcing-requests）。
- 新写入口 country 归属用例：POST sourcing-requests 用 +84 手机 → country=vn；+971 → ae（加进 country-walkthrough 或独立脚本）。
- `next build` exit=0；后端重启后 curl 冒烟。

## 8. 上线注意（本次不做，记录给部署时用）
- `public/images/sourcing/` 需 rsync 到 portal 目录（nginx images 规则）。
- `server/dist` 改动需 rsync + pm2 restart tarmeer-api；生产 DDL（sourcing_requests、supplier_products 三列）由 autoMigrate 启动时自动补。
- 首页/materials 大改后对比 BUILD_ID 确认上线。
