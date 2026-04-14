# 01 — 前端架构

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.0 | UI 框架，createRoot API |
| TypeScript | 5.7 | 全栈统一类型系统 |
| Vite | 6.0 | 构建工具，<50ms HMR |
| Tailwind CSS | 4.0 | 原子化 CSS，零运行时 |
| React Router | 6.30 | 路由管理，嵌套路由 |
| Framer Motion | 12.0 | 页面转场 + 画廊动画 |
| Lucide React | 0.468 | 图标库（SVG stroke） |
| React Helmet Async | 3.0 | 动态 SEO meta 标签 |

---

## 目录结构

```
src/
├── App.tsx                     # 总路由定义（66 个页面）
├── main.tsx                    # 入口：createRoot + BrowserRouter
├── index.css                   # 全局样式：CSS 变量 + btn-primary + input-standard
│
├── pages/                      # 66 个页面文件
│   ├── HomePage.tsx            # 首页
│   ├── CompaniesPage.tsx       # 公司列表
│   ├── CompanyDetailPage.tsx   # 公司详情 + portfolio
│   ├── ProjectDetailPage.tsx   # 项目详情 + 图片浏览器
│   ├── AuthPage.tsx            # 登录/注册（tab 切换）
│   ├── FaqPage.tsx             # FAQ（EN/AR 双语）
│   ├── ForCompaniesPage.tsx    # 公司落地页
│   ├── admin/                  # 21 个 Admin 页面
│   ├── company/                # 公司后台：Dashboard + Projects
│   ├── dashboard/              # 业主后台
│   └── designer/               # Legacy 设计师页面
│
├── components/                 # 42 个组件文件
│   ├── Layout.tsx              # 公开页面壳（Navbar + Footer）
│   ├── Navbar.tsx              # 顶部导航（角色感知）
│   ├── MasonryGallery.tsx      # 瀑布流画廊引擎
│   ├── Lightbox.tsx            # 全屏图片查看器
│   ├── InquiryForm.tsx         # 询盘表单（GCC 手机号）
│   ├── GoogleOneTap.tsx        # Google One Tap 集成
│   ├── ui/                     # 基础 UI 组件
│   │   ├── Avatar.tsx          # 头像 + 首字母 fallback
│   │   ├── SmartImage.tsx      # 多格式 fallback 图片
│   │   ├── Spinner.tsx         # 加载动画（3 种尺寸）
│   │   └── LoadingButton.tsx   # 带 loading 的按钮
│   ├── form/                   # 表单组件
│   ├── home/                   # 首页各 section
│   ├── admin/                  # Admin 布局组件
│   └── company/                # 公司后台布局
│
├── contexts/                   # 状态管理
│   ├── AdminContext.tsx         # Admin 认证 + 权限
│   └── DesignerContext.tsx      # 公司/设计师 profile + 项目
│
├── lib/                        # 工具库
│   ├── api.ts                  # ApiClient 类（fetch 封装 + token）
│   ├── adminApi.ts             # Admin API 客户端（20+ 方法）
│   ├── publicApi.ts            # 公开 API（公司列表、双源合并）
│   ├── imageUrl.ts             # 图片 URL 解析 + 变体 URL
│   ├── imageCleanup.ts         # 图片去重 + 质量过滤
│   ├── categoryNormalize.ts    # 180 个原始分类 → 10 个显示名
│   └── projectImageUpload.ts   # 项目图片上传工具
│
├── hooks/                      # 自定义 Hooks
│   ├── useVisitorTracking.ts   # 访客指纹追踪
│   └── useAnalyticsTracking.ts # 页面浏览分析
│
└── data/                       # 静态数据
    ├── materials.ts            # 建材/展厅数据
    └── brands.ts               # 品牌目录
```

---

## 路由架构

### 四层路由嵌套

```
<BrowserRouter>
  <Suspense fallback={<PageLoader />}>
    <Routes>
      ├── /admin/*     → <AdminProvider> → <AdminLayout>  → 21 个 Admin 页面
      ├── /company/*   → <ProtectedRoute> → <CompanyLayout> → Dashboard / Projects / Settings
      ├── /dashboard/* → <ProtectedRoute> → <UserDashboardLayout> → 业主面板
      ├── /onboarding  → <ProtectedRoute> → OnboardingPage
      └── /*           → <Layout>         → 所有公开页面
    </Routes>
  </Suspense>
</BrowserRouter>
```

### 懒加载策略

所有 66 个页面使用 `React.lazy()` 按需加载：

```tsx
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'));
```

Vite 自动为每个 lazy import 生成独立 chunk，首页只加载 ~260KB 主 bundle。

### 关键路由映射

| 路径 | 页面 | 认证 |
|------|------|------|
| `/` | HomePage | 无 |
| `/companies` | CompaniesPage | 无 |
| `/companies/:id` | CompanyDetailPage | 无 |
| `/portfolio` | PortfolioPage | 无 |
| `/faq` | FaqPage | 无 |
| `/auth` | AuthPage | 无 |
| `/company/dashboard` | CompanyDashboardPage | JWT |
| `/company/projects` | CompanyProjectsPage | JWT |
| `/admin/login` | AdminLoginPage | 无 |
| `/admin/dashboard` | AdminDashboardPage | Admin JWT |

### Legacy 重定向

```
/designer/*    → /company
/designers     → /companies
/login         → /auth
/register      → /auth
/showrooms     → /materials
```

---

## 构建与分包

### Vite 配置亮点

```js
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        animations: ['framer-motion'],
      }
    }
  }
}
```

### 产物分析

| Chunk | 大小 | Gzip |
|-------|------|------|
| `index.js` (主 bundle) | 261 KB | 82 KB |
| `vendor.js` (React/Router) | ~120 KB | ~40 KB |
| `animations.js` (Framer Motion) | 137 KB | 45 KB |
| 单页 chunk（平均） | 15-30 KB | 5-10 KB |

### 开发代理

Vite 开发服务器代理 `/api` 和 `/uploads` 到 `localhost:3002`（Express 后端），前端代码统一使用相对路径。

---

## 设计系统

### CSS 变量（定义在 index.css）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--color-tarmeer-primary` | `#b8864a` | 主色调：按钮、focus ring、active 状态 |
| `--color-tarmeer-text` | `#2c2c2c` | 正文文字（对比度 12.6:1，AAA 级） |
| `--color-tarmeer-muted` | `#6b6b6b` | 辅助文字（对比度 5.7:1，AA 级） |
| `--color-tarmeer-bg` | `#faf9f7` | 页面背景 |
| `--font-sans` | Inter | 正文字体 |
| `--font-serif` | Cormorant Garamond | 标题字体 |

### 全局 CSS 类

| 类名 | 用途 |
|------|------|
| `btn-primary` | 金色主按钮 |
| `input-standard` | 标准输入框（50px 高、20px 圆角） |
| `textarea-standard` | 标准文本域 |
| `select-standard` | 标准下拉 |

### 动画模式

- **页面进入**：`opacity: 0, y: 12` → `opacity: 1, y: 0`，duration 0.35s
- **列表 stagger**：每项 delay = `min(i * 0.04, 0.5)`
- **Tab 切换**：`AnimatePresence mode="wait"` + exit 动画
- **图片 hover**：CSS `transition-transform group-hover:scale-105`

---

## 状态管理

### 无全局状态库

不使用 Redux / Zustand / Jotai。状态分三层：

1. **组件内 useState** — 表单状态、UI 状态
2. **Context** — AdminContext（Admin 认证）、DesignerContext（公司 profile）
3. **localStorage** — token、user profile、active_role

### localStorage 键值

| 键 | 类型 | 内容 |
|-----|------|------|
| `token` | string | JWT token |
| `admin_token` | string | Admin JWT |
| `user` | JSON | 用户 profile |
| `designer` | JSON | 设计师 profile 缓存 |
| `active_role` | string | 当前角色：company / homeowner |

所有 localStorage 操作通过 `src/lib/storage.ts` 的安全封装（兼容 Safari 隐私模式）。
