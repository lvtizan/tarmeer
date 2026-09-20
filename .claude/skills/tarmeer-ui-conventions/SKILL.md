---
name: tarmeer-ui-conventions
description: Tarmeer UI 约束与组件复用——先找现成组件再写新的。适用于：任何前端 UI 改动、新页面/新卡片/新表单/新图片展示。用户明确痛点：反复不用现成组件重复造轮子。含图片比例、表单配色、定位方案等铁律。
---

# UI 约束与组件复用

## 何时不用本技能

- 纯后端/数据改动 → 不需要
- 图片上线流程（变体/rsync）→ `tarmeer-image-pipeline`
- VN Footer、专家联系表单这类"锁死"的功能 → `tarmeer-protected-features`（那边是禁区清单，这边是通用规范）

## 第一原则：写任何新 UI 前，先查现成组件

**用户明确指出的痛点：反复不用现成组件、重复实现。** 新写组件前必须先浏览以下目录，找到能用的就复用/扩展，确实没有再新建：

| 目录 | 有什么 |
|------|--------|
| `src/components/ui/` | Avatar、Modal/ConfirmModal、Toast、Spinner、LoadingButton、SmartImage、**ProgressiveImage**、PhoneCountryInput、MultiSelectDropdown、AdminSelect、ImageUploadZone、FileUploadButton、CopyButton 等基础件 |
| `src/components/shared/` | FilterSidebar、FilterOption、ActiveFilterChip、SearchableFilterList、**UnifiedInquiryForm**、PhoneRevealButton、ProjectsShowcaseSection |
| `src/components/form/` | FormInput、SelectField |
| `src/components/field/` | WatermarkCamera、MapPinModal、ChipSelect、SearchableSelect |
| `src/components/portal/` | WelcomeHeader、HighlightBanner、OnboardingStepper、StatCard |
| 领域目录 | `admin/`、`experts/`、`companies/`、`materials/`、`auth/` |

专家页联系表单**统一从 `src/components/experts/ExpertContactSidebar.tsx` 导入**，禁止页面内重新实现（铁律，见 `tarmeer-protected-features`）。

## 图片比例铁律

所有项目封面图（project cover）必须 `aspect-video`（16:9），**禁止固定像素高度**（`h-32`、`h-52` 等）。适用：ExpertDetailClient、ExpertProjectDetailClient、CompanyProjectsSection、CompanyDetailClient、任何新增项目网格。图片组件优先 `ProgressiveImage`；显式宽高/aspect 防 CLS。

## 表单配色铁律

- 输入框背景 `bg-white`，禁止 `bg-stone-50` 灰底
- 主按钮品牌金 `bg-[#b8864a]`，hover `hover:bg-[#a07640]`；**禁止 `bg-[#1c1917]` 深色主按钮**（深色 + disabled opacity = 看起来是灰色，违反设计语言）
- disabled 允许 `disabled:opacity-40`，底色必须仍是有意义的颜色（金色等），不能是中性色

## 定位方案前车之鉴

`position: sticky` 在 `flex-1` 的 main 容器内会失效。作品集 filter bar 曾一日五连修（见 `tarmeer-failure-archaeology` FA-4），最终方案是 scroll-listener + fixed。遇到吸顶需求：先确认容器的 flex/overflow 上下文，不要默认 sticky 能用。

## 多语言/双站文案

- 站点文案走 `src/i18n/site-translations.ts`，不要在组件里散落硬编码双语字符串
- VN 站（`lang === 'vi'`）与 AE 站的差异化行为（如电话显示 VN-only）遵循 `tarmeer-protected-features` 中的规则

## 改共享组件的回归义务

`ui/`、`shared/`、`form/` 下的组件被多页面引用。改动前 Grep 全部引用点，改后每个受影响页面自查——见 `tarmeer-change-control` 回归守则。

## 上下文型 CTA 的交互规则

- 询价、联系、收藏等“不应中断当前浏览”的动作，优先使用就近弹层、右下抽屉或移动端 bottom sheet。
- 禁止用 `scrollIntoView` 把用户强制带到页面底部的重复表单；入口必须首屏或全程可达，且关闭后能再次打开。
- 抽屉要保留未提交草稿，并具备焦点锁、Esc/遮罩关闭、焦点恢复、背景滚动锁与 `prefers-reduced-motion` 支持。
- 实际浏览器验收至少断言：打开前后滚动位置不变、桌面右下定位、移动端底部定位、关闭后入口恢复、键盘可完整操作。

## 姊妹文档

分类/枚举/下拉选项来源 → `tarmeer-dynamic-data`（禁止硬编码后台可配数据）。

## 目录页与详情页的视觉尺度

- 同一业务域的目录页和详情页必须共享主内容宽度与密度口径；详情页升级为宽屏布局后，目录页不得继续保留明显更窄的旧容器。
- 材料目录桌面端以 `max-w-[1920px]` 为上限，固定筛选栏保持紧凑，剩余空间交给自适应商品网格；卡片数量随视口增加，而不是用小卡片硬塞固定列数。
- 商品卡标题、价格、供应商信息必须保留稳定行高；空标题使用中性 fallback，空价格只留视觉槽位，不得让相邻卡片的文字基线错位。
- 验收至少记录桌面容器宽度、侧栏宽度、卡片宽度和移动端横向溢出结果，并与对应详情页的视觉尺度对照。
- 长商品目录不得依赖用户点击 “Load more” 才暴露后续内容；使用带提前量的 `IntersectionObserver` 自动翻页，并保留加载提示、失败重试、并发锁和跨页去重。
