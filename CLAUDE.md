
## UI/CSS Rules (MUST FOLLOW)

All pages MUST use the global design tokens defined in `src/index.css`. NEVER hardcode colors, font sizes, or input styles inline. Use these:

### Colors (CSS variables)
- `var(--color-tarmeer-primary)` = `#b8864a` — all accent, focus rings, active states
- `var(--color-tarmeer-text)` = `#2c2c2c` — primary text (AAA contrast on white)
- `var(--color-tarmeer-muted)` = `#6b6b6b` — secondary text (AA contrast)
- `var(--color-tarmeer-bg)` = `#faf9f7` — page background
- Placeholder text: `text-stone-400` (#a1a1a1)
- Labels: `text-stone-500` (#6b7280) at `text-sm` (14px)

### Text contrast (AAA = 7:1 minimum)
- Body text: `text-[#2c2c2c]` on white (contrast 12.6:1) ✅
- Secondary: `text-[#6b6b6b]` on white (contrast 5.7:1 — AA)
- NEVER use `text-stone-300` for readable text. Only for decorative placeholders.

### Global component classes
- Primary button: `className="btn-primary"` (defined in index.css)
- Input fields: Use the standard Tailwind classes matching AuthPage:
  ```
  h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80
  text-[15px] text-[#1c1917] placeholder:text-stone-400
  focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white
  ```
- Tags (selected): `bg-[#b8864a] text-white rounded-2xl`
- Tags (unselected): `border border-stone-200 text-stone-600 rounded-2xl`
- Cards: `bg-white rounded-2xl border border-stone-200 shadow-sm`
- Status banners: `rounded-2xl p-4 flex items-center gap-3`

### Font sizes
- Page title: `text-xl font-bold` (20px)
- Section label: `text-sm font-medium` (14px)
- Body/input text: `text-[15px]`
- Small/meta: `text-xs` (12px)

### Border radius
All interactive elements use `rounded-2xl` (20px) to match global `--radius-2xl`.

### Rules
1. NEVER create local `inputClass` constants — use the standard pattern above
2. NEVER use `text-sm` (14px) for main content — minimum `text-[15px]`
3. NEVER use colors outside the theme variables
4. All focus states use `ring-[#B8864A]/15` — no blue outlines
5. Labels always use `text-sm font-medium text-stone-500`

## Image Storage Rules (MUST FOLLOW)

1. **NEVER** store images as base64 data URLs in the database. All image data must be saved to the filesystem under `/uploads/` and only the relative URL path stored in the DB.
2. Avatar uploads go to `/uploads/avatars/{id}-{uuid}.{ext}`
3. Project images go to `/uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}`
4. Use `projectImageStorage.ts` utilities (`persistProjectImages`, `isImageDataUrl`) for project images.
5. If you encounter existing base64 data in the DB, run `node scripts/migrate-base64-avatars.mjs --apply` to convert it.
6. Any API endpoint that accepts image data must validate and convert base64 to file before saving.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
