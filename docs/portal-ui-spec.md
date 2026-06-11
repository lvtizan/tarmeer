# Portal UI 规范

装企（company）/ 业主（homeowner）/ 供应商（supplier）三端个人中心的统一 UI 与交互规范。
**新建任何 portal 页面前必读本文件**，所有视觉元素必须复用 `src/components/portal/` 下的共享组件，禁止重新内联实现。

---

## 1. 设计 tokens（`src/components/portal/tokens.ts`）

所有颜色 / 圆角 / 阴影 / 渐变引用 tokens，禁止散落硬编码色值。

| Token | 值 | 用途 |
|-------|-----|------|
| `PORTAL_GOLD` | `#b8864a` | 主品牌金：按钮、强调、激活态 |
| `PORTAL_GOLD_HOVER` | `#a4763f` | 金色按钮 hover |
| `PORTAL_GOLD_SOFT` | `#d4a96a` | 深色背景上的浅金文字/图标 |
| `PORTAL_INK` | `#2c2c2c` | 主文字色 |
| `PORTAL_BG` | `#faf9f7` | 页面浅色背景 |
| `PORTAL_BANNER_GRADIENT` | `linear-gradient(135deg,#1a1208,#2d1f0e,#3d2c14)` | HighlightBanner 深色背景 |
| `PORTAL_GOLD_BUTTON_GRADIENT` | `linear-gradient(135deg,#c6a065,#b8864a)` | 横幅金色 CTA |

圆角：标准卡片 `rounded-2xl`，大面板（表单容器）`rounded-[24px]`。
section 小标题：`text-xs font-semibold text-stone-400 uppercase tracking-wider`。

---

## 2. 共享组件（`src/components/portal/`）

### WelcomeHeader
页面顶部欢迎标题。`title` + 可选 `subtitle` + 右侧 `action` slot（按钮/保存状态）。

```tsx
<WelcomeHeader title="Welcome to your Dashboard" subtitle="..." action={<PreviewBtn/>} />
```

### HighlightBanner
深色渐变强调横幅。左图标徽章 + 标题/副文 + 可选金色 CTA。

```tsx
<HighlightBanner icon={Zap} title="..." subtitle={<>...</>} ctaLabel="+ Add Project" onCta={fn} />
```

### OnboardingStepper
引导步骤器：数字节点 + 连线 + 当前激活步骤的操作行。装企/业主共用，步骤数自适应。

```tsx
const steps: PortalStep[] = [
  { label: 'Complete Profile', desc: '...', done: true,  actionLabel: 'Edit', onAction: fn },
  { label: 'Upload Project',   desc: '...', done: false, actionLabel: 'Upload Now', onAction: fn },
  { label: 'Under Review',     desc: '...', done: false }, // 无 action → 激活时不显示操作行
];
<OnboardingStepper title="Getting Started" steps={steps} />
```
- `done` 节点显示金色对勾；第一个未完成节点为激活态（金边框）；其余灰色。
- 仅「第一个未完成且有 `actionLabel`+`onAction`」的步骤显示底部操作行。

### StatCard
统计卡：图标 + 数值 + 标签 + 提示，可点击跳转。`<StatCard icon={..} label="Projects" value={3} hint="+10 pts each" onClick={fn} />`

### QuickAction
快捷入口卡：图标徽章 + 标题 + 描述。`<QuickAction icon={..} label="Edit Profile" desc="..." onClick={fn} />`

### SettingsCard（`SettingsSection` + `SettingsRow`）
设置页区块 + 行。

```tsx
<SettingsSection title="Account">
  <SettingsRow icon={<ShieldCheck/>} title="Profile" desc="..." actionLabel="Edit →" onAction={fn} divider />
  <SettingsRow icon={<LogOut/>} title="Sign Out" desc="..." actionLabel="Sign Out" onAction={fn} disabled={loading} />
</SettingsSection>
```

### PortalNav（`PortalDesktopNav` + `PortalMobileNav`）
侧边栏导航（圆角项 + 激活高亮）与移动底部导航。参数化 `items: PortalNavItem[]`。
- 桌面 `footer` slot：注入门户特有内容（CRM、切换账号）。
- 移动 `extra` slot：注入门户特有项（CRM）。
- `end: true` 用于首页（dashboard）精确匹配高亮。

```tsx
const NAV: PortalNavItem[] = [
  { href: '/company/dashboard', label: 'Dashboard', icon: Building2, end: true },
  { href: '/company/projects',  label: 'Projects',  icon: FolderOpen },
];
<PortalDesktopNav items={NAV} footer={<CrmSwitchSlot/>} />
<PortalMobileNav items={NAV} extra={<CrmMobileBtn/>} />
```

---

## 3. 页面骨架约定

- **dashboard**：`WelcomeHeader` → `HighlightBanner` → `OnboardingStepper` →（业务卡片 / Stats / QuickActions）。容器 `max-w-[900px] mx-auto space-y-6`。
- **settings**：标题块 → 一个或多个 `SettingsSection`。容器 `max-w-[640px] mx-auto space-y-4`。
- **布局外壳**：装企自带顶栏（`h-screen` 内 header + 固定侧栏），业主依赖全局 `Navbar`（侧栏 `fixed top-14/16`）。两者**导航渲染统一**用 `PortalNav`，但外层壳因顶栏机制不同各自保留——新增门户时沿用对应模式即可。

---

## 4. 当前复用情况

| 页面 | 复用组件 |
|------|---------|
| `app/company/dashboard` | WelcomeHeader / HighlightBanner / OnboardingStepper / StatCard / QuickAction |
| `app/dashboard`（业主） | WelcomeHeader / HighlightBanner / OnboardingStepper |
| `app/company/settings`、`app/dashboard/settings` | SettingsSection / SettingsRow |
| `app/company/layout`、`app/dashboard/layout` | PortalDesktopNav / PortalMobileNav |
