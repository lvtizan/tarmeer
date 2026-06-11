/**
 * Portal UI 设计 tokens —— 装企 / 业主 / 供应商个人中心共用的视觉常量。
 *
 * 规则：所有 portal 页面（dashboard / profile / settings 等）的颜色、圆角、
 * 阴影、渐变必须引用这里的常量，禁止在页面里散落硬编码色值，保证三端视觉一致。
 * 详细用法见 docs/portal-ui-spec.md。
 */

/* ── 颜色 ── */
export const PORTAL_GOLD = '#b8864a';        // 主品牌金（按钮、强调、激活态）
export const PORTAL_GOLD_HOVER = '#a4763f';  // 金色按钮 hover
export const PORTAL_GOLD_SOFT = '#d4a96a';   // 深色背景上的浅金文字/图标
export const PORTAL_INK = '#2c2c2c';         // 主文字色
export const PORTAL_BG = '#faf9f7';          // 页面浅色背景

/* ── 深色渐变（HighlightBanner 背景）── */
export const PORTAL_BANNER_GRADIENT =
  'linear-gradient(135deg, #1a1208 0%, #2d1f0e 60%, #3d2c14 100%)';
export const PORTAL_GOLD_BUTTON_GRADIENT =
  'linear-gradient(135deg, #c6a065 0%, #b8864a 100%)';

/* ── 圆角 ── */
export const PORTAL_RADIUS_CARD = 'rounded-2xl';     // 标准卡片
export const PORTAL_RADIUS_PANEL = 'rounded-[24px]'; // 大面板（表单容器等）

/* ── 复用的 className 片段 ── */
// 标准白色卡片
export const portalCardCls =
  'rounded-2xl border border-stone-200 bg-white shadow-sm';
// 金色主按钮
export const portalPrimaryBtnCls =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#b8864a] text-white font-semibold hover:bg-[#a4763f] transition disabled:opacity-50';
// section 小标题（大写灰字）
export const portalSectionLabelCls =
  'text-xs font-semibold text-stone-400 uppercase tracking-wider';
