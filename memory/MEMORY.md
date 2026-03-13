# Tarmeer 4.0 项目记忆

## 项目概述

- **名称**: Tarmeer 4.0
- **定位**: 阿联酋（UAE）设计师服务与建材/展厅展示网站，主推本地、面对面设计服务
- **目标用户**: 中东（尤其阿联酋）业主、设计师、合作伙伴
- **风格参考**: Havenly.com — 浅色、留白、结构化、高端大气；全站主色为暗金色，焦点/悬停从主色衍生

## 技术栈

- **框架**: React 19 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS v4
- **路由**: React Router v6（可启用 `v7_relativeSplatPath` future flag）
- **动效**: Framer Motion（可选）
- **图标**: Lucide React
- **数据**: 当前为前端 Mock（DesignerContext）；规划中为 MySQL + 阿里云 OSS 存图 URL

## 设计系统

### 主色与衍生

| 用途 | 值 | CSS 变量 |
|------|-----|---------|
| 主色（按钮、CTA） | `#b8864a` | `--color-tarmeer-primary` / `--color-tarmeer-primary-btn` |
| 主色悬停 | `#a67c47` | `--color-tarmeer-primary-btn-hover` |
| 强调（链接、标签） | `#c6a065` | `--color-tarmeer-gold` |
| 背景 | `#faf9f7` | `--color-tarmeer-bg` |
| 正文 | `#2c2c2c` | `--color-tarmeer-text` |
| 次要文案 | `#6b6b6b` | `--color-tarmeer-muted` |

### 焦点与交互

- **焦点**: 禁止使用浏览器默认蓝色；所有 `input`/`textarea`/`select`/`button` 使用主色焦点环，例如 `ring-2 ring-[#b8864a]/40` 或 `.focus-primary`
- **主按钮**: `.btn-primary` — 背景主色、文字**白色**、圆角、hover 变深
- **链接/卡片 hover**: 主色或主色浅底（如 `bg-[#b8864a]/10`）

### 字体

- 无衬线: Inter（或系统 UI）
- 衬线（标题）: Cormorant Garamond

### 图片与占位

- 全站图片要求「高端大气」
- 所有关键图片需 `onError` 回退（占位图或隐藏），避免裂图

## 全局常量

集中放在 `src/lib/constants.ts`：

| 常量 | 值 |
|------|-----|
| `GOOGLE_MAPS_URL` | 谷歌地图 Al Tameer 位置链接 |
| `ADDRESS` | `1 - 2a 147 street - Al Sajaa - Sharjah - United Arab Emirates` |
| `WHATSAPP_NUMBER` | `971588388922` |
| `WHATSAPP_LINK` | `https://wa.me/971588388922` |
| `INSTAGRAM_URL` | `https://www.instagram.com/tarmeermall` |

全站「联系我们」类 CTA 统一跳转 `WHATSAPP_LINK`。

## 路由结构

### 公开站（带主导航 + Footer）

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/designers` | 设计师列表 |
| `/designers/apply` | 设计师招募（Join as Designer） |
| `/designers/:slug` | 设计师个人页（公开） |
| `/designers/:slug/projects/:projectId` | 项目详情（以全屏 Modal 展示，非独立页） |
| `/auth` | 登录/注册合一页 |
| `/login`, `/register` | 重定向到 `/auth` |
| `/materials` | 展厅页（Showrooms） |
| `/showrooms` | 重定向到 `/materials` |
| `/materials/brands/:slug` | 品牌详情页 |
| `/materials/:category` | 建材分类页（若有）；`/materials/brands` 重定向到 `/materials` |

### 设计师后台（独立 Layout，无站点头部/Footer）

- 路由前缀：`/designer`
- 布局：`DesignerLayout`（顶栏 + 侧栏），子路由在 `<Outlet />` 中渲染
- 子路由：
  - `/designer` → 重定向到 `/designer/dashboard`
  - `/designer/dashboard` — 仪表盘
  - `/designer/profile` — 个人资料编辑
  - `/designer/projects` — 作品集列表（增删改入口）
  - `/designer/upload` — 新建项目
  - `/designer/upload/:id` — 编辑项目

## 主导航（Navbar）

- **Logo**: `/images/tarmeer_logo.svg` + 文案「**TARMEER**」（全大写）；Logo 需 `onError` 隐藏裂图
- **链接**: Home、Find Designers、Showrooms、Join as Designer、Log In、Contact Us（WhatsApp）
- **行为**: 在首页且已滚动时，点击 Home 平滑滚动回顶部，不重复推历史
- **移动端**: 汉堡菜单展开上述链接；Contact Us 在主栏保留

## Footer

- **多列**: Company | About | Address | Contact & Follow
- **Company**: Home、Designers、Pricing、Showrooms、Become a Partner、Contact Us
- **Address**: 🏢 + 完整地址文案 +「Google Map」按钮（`GOOGLE_MAPS_URL`）
- **Contact & Follow**: WhatsApp: +971 58 838 8922、Instagram 链接
- **底部**: © 年份 Tarmeer、Privacy、Terms

## 关键功能需求

### 首页（/）

- **自上而下模块**（无顶部 badge/色条）：
  1. **Banner**
     - 大图背景 + 遮罩；标题 `UAE Design Services`，副标题强调本地、面对面设计；CTA「Get Started」跳到 `/#designers`
     - 不展示「UAE • Dubai • Sharjah • Design Services」等 badge 或色块
  2. **Pricing**
     - 区块 id 为 `#pricing`，便于导航锚点
     - 两个价格卡片：New Home Full Case Design、Soft Decoration Design（价格、特性、CTA）；风格参考 Havenly「Our Design Packages」— 白卡片、暖背景、可选折扣氛围
     - CTA 按钮文字为白色
  3. **Designers**
     - 区块 id 为 `#designers`
     - 以卡片展示设计师：项目封面图（16:9）、圆形头像、全名（不截断）、位置（带地标 emoji）、风格等；每行 4 张卡片，最多展示约 8 条，底部「View all designers」链到 `/designers`
     - 点击卡片任意处进入该设计师个人页
  4. **无单独「公司信息」区块** — 与 Footer 信息重复，首页不重复展示地址/WhatsApp/Google Map

- **锚点**: 顶部 Nav 的 Pricing 链到 `/#pricing`，Designers 链到 `/#designers`；首页内点击 Home 滚动回顶部

### 设计师列表页（/designers）

- 展示所有设计师（如 50 条内不折叠），布局与首页设计师区块一致：项目图在上、圆形头像、全名、位置（地标 emoji）、4 列网格
- 卡片 hover：轻微动效（如位移/阴影）
- 「View all designers」可链回本页或保持为「全部」状态

### 设计师个人页（/designers/:slug）

- **布局**: 全屏两列 — 左列固定/粘性：设计师信息；右列：作品集网格（大图为主）
- **左侧**: 圆形头像、全名（不截断）、简介、擅长（Expertise）、位置等
- **右侧**: 项目卡片网格；每个项目有封面图；hover 时图片放大 + 两行项目摘要覆盖
- **项目标签**: 若项目带 tags，页上提供标签筛选（如 Luxury, Kitchen, Full renovation）
- **点击项目**: 打开**全屏 Modal**（非新页面），内为项目详情 + 联系表单

### 项目详情（Modal）

- **触发**: 在设计师个人页点击某个项目，路由变为 `/designers/:slug/projects/:projectId`，以全屏/大弹层展示
- **内容**: 单列或 6:4 比例（作品区 : 表单区）；大图轮播 + 缩略图条；项目信息（年份、费用、地址、面积、描述）；「Share project」带分享图标
- **联系**: 「Contact us」打开 WhatsApp；「Submit your requirements」展开内嵌表单：姓名、WhatsApp、需求描述（无附件），提交后拼接文案跳转 WhatsApp。不提供文件上传
- **关闭**: 关闭 Modal 后回到设计师个人页（路由回 `/designers/:slug`）

### 设计师招募（/designers/apply）

- **内容**: 利益点（如海量线上客户、作品展示、供应链等）、流程步骤（申请 → 展示资料 → 接单）
- **CTA**: 「Apply Now」跳转到 `/auth`（不保留页内表单）；按钮无右侧箭头
- **「Ready to Transform Your Design Business?」** 区块的 CTA 同样链到 `/auth`，按钮无右箭头

### 登录/注册（/auth）

- **形式**: 单页 Tab 切换（Log In / Create Account），无重复站点头部
- **Banner**: 顶部配图（优先 `/images/register-banner.jpg`，失败时用与「设计师/注册」相关的备用图，不要与首页大图相同）
- **登录**: 邮箱、密码、Remember；提交后跳转 `/designer/dashboard`（使用 `navigate` 推历史，以便浏览器返回可回到登录页）
- **注册**: 姓名、邮箱、电话、城市、设计理念等；同意条款；提交后同样跳转 `/designer/dashboard`
- **主按钮**: 主色底、白色字；「Login to Studio」等按钮无多余图标

### 设计师后台（/designer/*）

- **Layout**: `DesignerLayout` — 顶栏（Tarmeer Dashboard、Dashboard/My Projects/Profile、搜索、通知、头像、**Home**、**Log out**）；侧栏（Dashboard、My Projects、Profile、**Back to Home**、**Log out**）。无 Messages、无 Lead Management
- **状态**: `DesignerProvider` 提供 profile、projects、addProject、updateProject、deleteProject、getProject、setProfile、setAvatar 等；当前为内存 Mock，可后续接 API

#### 仪表盘（/designer/dashboard）

- 欢迎语、统计卡片（Total Projects、Profile Views、Leads This Month）
- **Your Projects**: 以**图文卡片**展示，**三列**网格（响应式：1/2/3 列）；每卡：封面图、标题、地点·年份、「Edit」链到 `/designer/upload/:id`；整卡可点击
- 「Manage all」链到 `/designer/projects`；「Upload New Project」链到 `/designer/upload`

#### 作品集列表（/designer/projects）

- 所有项目以列表或卡片展示；每项有编辑、删除；「Add Project」链到 `/designer/upload`

#### 个人资料（/designer/profile）

- 编辑：姓名、职称、邮箱、电话、城市、地址、简介；头像上传（本地预览，如 FileReader）

#### 上传/编辑项目（/designer/upload 与 /designer/upload/:id）

- **置顶条**: 标题 + 「Save Draft」「Publish Project」放在**粘性条**中，滚动时固定在内容区顶部（主色背景或与背景同色），避免被遮挡
- **Step 1 - Project Details**: 标题、描述、风格、城市、面积、年份
- **Step 2 - Gallery Images**:
  - **仅本地选图**: 一个上传区「Click to upload or drag and drop」，点击或拖拽选择多张图片；不支持「输入 URL」或网页添加
  - 已选图片以网格展示，可设 Cover、删除；**无额外加号按钮**，仅通过该上传区添加
- **Step 3 - Products Used**: 可选产品列表（Mock 表格），可增删
- 保存草稿 / 发布：发布后跳转 `/designer/projects`；使用 `navigate()` 推历史，保证浏览器返回可用

### 展厅页（/materials，Showrooms）

- **Hero**: 大 Banner，「Physical Showrooms」标签、标题「Experience Excellence In Person.」、副标题、CTA「Explore Locations」平滑滚动到下方「Our Location — Sharjah」
- **The Showroom Experience**: 三条体验说明（如 Tactile Material Testing、Design Consultation、Personalized Sourcing）
- **Partner Brands**: 5 个品牌（华盛家居、春蕾绿植、怡发门窗、索菲亚家具、明轩新材），每品牌有 logo（`/images/xxx-logo.png`）、名称，点击进入 `/materials/brands/:slug`
- **Our Location — Sharjah**: 仅展示沙迦展厅；大图使用 `/images/建材城正面全景.png`（需 onError 回退）；「View on Map」链到 `GOOGLE_MAPS_URL`；适当内边距
- **Ready to start your project?**: 文案 + 「Contact Us」主按钮（深色底、白字），区块与上方间距不宜过大

### 品牌详情页（/materials/brands/:slug）

- Banner 图、品牌名、tagline、intro 文案；下方为品牌作品网格（5–6 个作品，图+标题+简述）；底部「Contact us」链到 WhatsApp

### 建材分类页（/materials/:category）

- 若存在分类（非 `brands`），则展示该分类说明、案例、CTA；`/materials/brands` 重定向到 `/materials`，避免与品牌路由冲突

## 数据模型

### 公开站设计师与项目（Mock 或 API）

```ts
interface Designer {
  slug: string;
  name: string;           // 全名，不截断
  firstName: string;
  location: string;
  style: string;
  bioShort: string;
  bioLong?: string;
  avatar: string;
  projectImages: string[];
  projectCount: number;
  expertise: string[];
}

interface DesignerProject {
  id: string;
  title: string;
  coverImage: string;
  images: string[];
  year?: number;
  location?: string;
  address: string;
  cost: string;
  description: string;
  tags?: string[];        // 用于个人页筛选
}
```

### 设计师后台（Context 状态）

```ts
interface DesignerProfile {
  fullName: string;
  email: string;
;
  phone: string;
  city: string;
  address: string;
  bio: string;
  avatarUrl: string;
  title: string;
}

interface DesignerProjectItem {
  id: string;
  title: string;
  description: string;
  style: string;
  location: string;
  area: string;
  year: string;
  imageUrls: string[];     // 支持 data URL 或 线上 URL
  productIds: string[];
}
```

### 品牌

```ts
interface Brand {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  intro: string;
  bannerImage: string;
  logo: string;           // 如 /images/huasheng-home-logo.png
  works: { id: string; image: string; title: string; description?: string }[];
}
```

## 关键行为与约束

- **主按钮文字**: 全站主色按钮上的文字一律为**白色**
- **Logo 与 Banner**: Logo、注册/登录 Banner、建材城大图等均需 `onError` 处理，防止裂图
- **浏览器返回**: 登录/注册成功后使用 `navigate('/designer/dashboard')`（不 replace），以便从仪表盘返回可回到登录页
- **首页**: 不展示与 Footer 重复的公司信息区块；不展示 Banner 上方 badge 或色块
- **设计师个人页**: 头像为圆形；姓名完整显示；项目摘要 hover 两行覆盖在图上
- **Upload 页**: Gallery 仅支持本地文件选择（+ 拖拽），无 URL 输入、无单独加号添加图

## 部署

- **图片目录**: `public/images/` — 如 `tarmeer_logo.svg`、`register-banner.jpg`、`建材城正面全景.png`、各品牌 logo
- **构建**: `npm run build` 输出到 `dist/`；若部署 GitHub Pages 可设 `base: '/tarmeer/'`
- **GitHub Pages**: https://lvtizan.github.io/tarmeer/
- **ECS 部署**: Nginx 需正确配置 SPA fallback（`try_files` 到 `index.html`）及静态资源 MIME 类型，避免 JS/CSS 被当成 `text/html`

## 配置与扩展点

- **站点模式**: `src/config/site-config.ts` 支持 WARTIME / PEACETIME；当前为 PEACETIME，Banner 标题/副标题可在此统一修改
- **设计系统**: Tailwind theme 与 `src/index.css` 中 `.btn-primary`、`.focus-primary` 等；新增组件应沿用主色与焦点规则

## 待办事项

- [ ] 接入 MySQL 后端
- [ ] 接入阿里云 OSS 存储图片
- [ ] 完善设计师后台功能
- [ ] 添加更多设计师和项目数据
- [ ] 优化移动端体验
