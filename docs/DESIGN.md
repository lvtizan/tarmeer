# Design System

All pages MUST use the global design tokens defined in `src/index.css`. NEVER hardcode colors, font sizes, or input styles inline.

---

## Color System

CSS variables defined in `src/index.css` under `@theme`:

| Variable | Value | Usage |
|---|---|---|
| `--color-tarmeer-primary` | `#b8864a` | All accent, focus rings, active states |
| `--color-tarmeer-primary-btn` | `#b8864a` | Primary button background |
| `--color-tarmeer-primary-btn-hover` | `#a67c47` | Primary button hover |
| `--color-tarmeer-gold` | `#c6a065` | Secondary gold accent (hover borders, category labels) |
| `--color-tarmeer-warm` | `#b8864a` | Alias for primary |
| `--color-tarmeer-text` | `#2c2c2c` | Primary text (AAA contrast on white) |
| `--color-tarmeer-muted` | `#6b6b6b` | Secondary text (AA contrast) |
| `--color-tarmeer-bg` | `#faf9f7` | Page background |
| `--color-tarmeer-card` | `#ffffff` | Card background |

Additional Tailwind utility colors used by convention:

- Placeholder text: `text-stone-400` (`#a1a1a1`)
- Labels: `text-stone-500` (`#6b7280`) at `text-sm` (14px)
- Borders: `border-stone-200` (`#e7e5e4`)

### Fonts

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-serif: 'Cormorant Garamond', ui-serif, Georgia, serif;
```

`font-sans` is the body default. `font-serif` is used for section headings (e.g. "Portfolio" in MasonryGallery).

---

## Typography

| Role | Classes | Size |
|---|---|---|
| Page title | `text-xl font-bold` | 20px |
| Section heading (serif) | `font-serif text-3xl sm:text-4xl` | 30-36px |
| Section label | `text-sm font-medium` | 14px |
| Body / input text | `text-[15px]` | 15px |
| Small / meta | `text-xs` | 12px |
| Tab count | `text-xs opacity-70` | 12px, dimmed |

---

## Text Contrast

AAA = 7:1 minimum ratio on white background.

| Purpose | Class | Hex | Contrast ratio | Rating |
|---|---|---|---|---|
| Body text | `text-[#2c2c2c]` | #2c2c2c | 12.6:1 | AAA |
| Secondary text | `text-[#6b6b6b]` | #6b6b6b | 5.7:1 | AA |
| Placeholder | `text-stone-400` | #a1a1a1 | decorative only | -- |
| Stone-300 | `text-stone-300` | -- | NEVER use for readable text | -- |

---

## Component Patterns

### Primary Button

Use `className="btn-primary"` (defined in `src/index.css`).

Renders as: gold background, white text, 16px border-radius, 500 font-weight, 0.75rem/1.5rem padding.

```html
<button className="btn-primary">Submit</button>
```

For buttons with loading states, use `<LoadingButton>` from `src/components/ui/LoadingButton.tsx`.

### Input Fields

Two approaches exist in the codebase:

**CSS class (preferred for standalone forms):**
```html
<input className="input-standard" />
<textarea className="textarea-standard" />
<select className="select-standard" />
```

These are defined in `src/index.css`: 50px height, 20px border-radius, stone-200 border, stone-50 background, focus ring with primary color.

**Tailwind inline (legacy, used in AuthPage):**
```
h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80
text-[15px] text-[#1c1917] placeholder:text-stone-400
focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white
```

**Form components (for structured forms):**
Use `FormInput`, `FormTextarea`, `FormSelect`, `FormLabel`, `FormTag` from `src/components/form/FormInput.tsx`. These use `rounded-lg`, `h-12`, and slightly different focus ring opacity (`ring-[#b8864a]/35`).

Use `SelectField` from `src/components/form/SelectField.tsx` for selects with optional leading icon.

### Tags

| State | Classes |
|---|---|
| Selected | `bg-[#b8864a] text-white rounded-2xl` (or `rounded-full` in FormTag) |
| Unselected | `border border-stone-200 text-stone-600 rounded-2xl` |

FormTag uses `rounded-full`, `text-xs font-semibold`, and `bg-stone-50` for unselected state.

### Cards

```
bg-white rounded-2xl border border-stone-200 shadow-sm
```

### Status Banners

```
rounded-2xl p-4 flex items-center gap-3
```

### Category Tabs (MasonryGallery)

```
px-4 py-2 rounded-full text-sm font-medium
Active:   bg-[#1c1917] text-white
Inactive: text-[#6b6b6b] hover:text-[#1c1917] hover:bg-stone-100
```

### Sidebar Navigation Links

Use `SidebarNavLink` from `src/components/ui/SidebarNavLink.tsx`.

Active state: `bg-[#b8864a]/10 text-[#2c2c2c]`
Inactive state: `text-stone-600 hover:bg-stone-50`

### Avatar

Use `<Avatar>` from `src/components/ui/Avatar.tsx`. Supports sizes `sm|md|lg|xl`, falls back to colored initials when image fails. Optional `editable` prop shows camera icon overlay.

---

## Border Radius

| Variable | Value | Usage |
|---|---|---|
| `--radius-sm` | 8px | Small elements |
| `--radius-md` | 12px | Medium elements |
| `--radius-lg` | 16px | Cards, containers |
| `--radius-xl` | 16px | Same as lg |
| `--radius-2xl` | 16px | Interactive elements (note: Tailwind `rounded-2xl` maps to 16px in this theme) |
| `--radius-3xl` | 20px | Largest radius |

All interactive elements use `rounded-2xl` (16px) to match global `--radius-2xl`. Some form components use `rounded-lg` or `rounded-full` for pills/tags.

---

## Spacing & Layout

### Admin Layout (MUST FOLLOW)
- 后台所有页面右侧内容区域必须**水平居中**，使用 `max-w-5xl mx-auto` 或等效方式
- 内容区不能贴左对齐或撑满全宽，保持阅读舒适度
- 表格类页面可用 `max-w-7xl mx-auto`（需要更多宽度）

### Page Container

Use `<PageContainer>` from `src/components/PageContainer.tsx`:

```
max-w-6xl mx-auto px-4 sm:px-6
```

This matches the top navigation width.

### Page Layout

The root `<Layout>` component (`src/components/Layout.tsx`) provides:
- `min-h-screen flex flex-col` on wrapper
- `<Navbar>` at top
- `<main className="flex-1">` for content
- `<Footer>` at bottom

### Common Spacing Patterns

- Section padding: `py-10 lg:py-14`
- Section header margin: `mb-8`
- Grid gap: `gap-4` for masonry, `gap-2` for tab rows
- Card internal padding: `p-4`
- Button padding: `px-8 py-3` (outline), `px-4 py-2` (tabs)

---

## Design Rules

1. NEVER create local `inputClass` constants -- use `input-standard` CSS class or `FormInput` component.
2. NEVER use `text-sm` (14px) for main content -- minimum `text-[15px]`.
3. NEVER use colors outside the theme variables.
4. All focus states use `ring-[#B8864A]/15` (or `/35` in form components) -- no blue outlines.
5. Labels always use `text-sm font-medium text-stone-500`.
6. All interactive elements (buttons, links, inputs) get `cursor: pointer` globally via `index.css`.
7. Disabled elements get `cursor: not-allowed` globally.
8. Checkboxes use `accent-color: var(--color-tarmeer-primary)`.
9. No browser-default focus outlines -- all replaced with primary-color box-shadow via `index.css`.

---

## Icon System

Icons use **lucide-react** (`^0.468.0`).

Common pattern:
```tsx
import { Loader2, Camera, Trash2, ChevronDown } from 'lucide-react';

// Inline icon
<Camera className="w-4 h-4 text-[#b8864a]" strokeWidth={1.5} />

// Spinner
<Loader2 className="w-5 h-5 animate-spin" />
```

Standard sizes:
- `w-3.5 h-3.5` -- small (delete buttons, indicators)
- `w-4 h-4` -- default (form icons, chevrons)
- `w-5 h-5` -- medium (inline spinners)
- `w-6 h-6` -- large (page spinners)

Use `strokeWidth={1.5}` for thinner icons in overlays (e.g. avatar camera button).

---

## Animation

Uses **framer-motion** (`^12.0.6`) for page transitions and gallery animations.

Common patterns:
- Fade in/slide: `initial={{ opacity: 0, y: 12 }}` / `animate={{ opacity: 1, y: 0 }}`
- Staggered items: `transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.5) }}`
- Tab switch: `AnimatePresence mode="wait"` with exit animation
- Hover scale: `transition-transform duration-300 group-hover:scale-105` (CSS only)
