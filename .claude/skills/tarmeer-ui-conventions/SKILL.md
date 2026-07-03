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

## 姊妹文档

分类/枚举/下拉选项来源 → `tarmeer-dynamic-data`（禁止硬编码后台可配数据）。
