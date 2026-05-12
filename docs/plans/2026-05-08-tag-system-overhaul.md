# Tag System Overhaul — Implementation Plan

Date: 2026-05-08

## Background

Two parallel changes:
1. **全站标签改造** — Replace the current flat tag lists with a structured two-level space/scene taxonomy that is consistent across projects, company profiles, Find Company filter, and portfolio display.
2. **项目编辑图片标签** — Each image in a project gets exactly one user-assigned tag (no multi-tag per image).

---

## New Tag Taxonomy

### Space / Scene Tags (场景空间)

Used as project tags AND company Specialties. Two-level hierarchy.

| L1 (一级) | L2 (二级 / existing values to keep) |
|-----------|--------------------------------------|
| **Residential** (住宅装修) | Apartment, Villa, Luxury Residential, Townhouse |
| **Commercial** (商业装修) | Retail, Office, Restaurant, Hotel, Hospitality, Showroom, Mall |
| **Public / Institutional** (公装/其他) | School, Education, Healthcare, Hospital, Club, Factory, ADU, Mixed-Use |
| **Outdoor / Landscape** (室外/庭院) | Garden, Terrace, Pool, Fence, Driveway, Landscape |

L2 values are chosen to overlap with current `SPECIALTIES` list to minimize data migration.

### Service Tags (专项工种 — 20 categories)

These are the company profile **Services** field. The 20 Chinese categories each become one English service tag.
Old tags (Interior Design, Joinery, MEP, etc.) are **retired as selectable options** but preserved in existing company DB records for backward compat.

| # | Chinese | English Tag (stored in DB) | Maps from old tags |
|---|---------|---------------------------|--------------------|
| 1 | 设计与规划 | **Design & Planning** | Interior Design, Architecture, Project Management, Design & Build |
| 2 | 施工总承包/管理 | **General Contracting** | Fit-Out, Construction, Turnkey Solutions, Renovation |
| 3 | 厨卫局部改造 | **Kitchen & Bath Renovation** | *(new)* |
| 4 | 门窗 | **Doors & Windows** | Glass & Aluminium, Curtains & Blinds |
| 5 | 地板/地毯 | **Flooring & Carpet** | Flooring & Tiling, Epoxy & PU Flooring |
| 6 | 木作/定制柜 | **Joinery & Custom Cabinetry** | Joinery, Furniture |
| 7 | 石材/台面 | **Stone & Countertops** | Stone & Marble Fixing |
| 8 | 瓷砖/石材铺贴 | **Tile Installation** | Flooring & Tiling (partial) |
| 9 | 油漆/墙纸/墙布 | **Painting & Wall Finishes** | Painting & Finishing, Gypsum & Partitions |
| 10 | 楼梯/栏杆/扶手 | **Stairs & Railings** | Steel & Fabrication (partial) |
| 11 | 防水/防潮 | **Waterproofing** | Waterproofing |
| 12 | 水电改造 | **Plumbing & Electrical** | MEP |
| 13 | 暖通/空调/新风 | **HVAC & Fresh Air** | HVAC & Ducting |
| 14 | 全屋净水/软水 | **Water Purification** | *(new)* |
| 15 | 全屋智能 | **Smart Home** | Smart Home & Automation |
| 16 | 墙面/顶面翻新 | **Wall & Ceiling Renovation** | Painting & Finishing, Gypsum & Partitions (partial) |
| 17 | 阳台/露台改造 | **Balcony & Terrace** | *(new)* |
| 18 | 泳池/水景 | **Pools & Water Features** | Pools |
| 19 | 阳光房/雨棚 | **Sunroom & Canopy** | *(new)* |
| 20 | 庭院/花园工程 | **Garden & Landscaping** | Landscape |

**Remaining old tags** (kept for existing company data, not selectable going forward):
Maintenance, Fire Fighting, Solar Systems, Lighting Installation, Scaffolding, Demolition, Cleaning Services, Deep Cleaning — retire from UI, preserve in DB.

**tagTaxonomy.ts `SERVICE_GROUPS` structure:**
```ts
export const SERVICE_GROUPS = [
  {
    group: 'Design',
    tags: ['Design & Planning', 'General Contracting'],
  },
  {
    group: 'Renovation',
    tags: ['Kitchen & Bath Renovation', 'Wall & Ceiling Renovation', 'Balcony & Terrace'],
  },
  {
    group: 'Finishes',
    tags: ['Flooring & Carpet', 'Tile Installation', 'Painting & Wall Finishes',
           'Stone & Countertops', 'Doors & Windows'],
  },
  {
    group: 'Joinery & Furniture',
    tags: ['Joinery & Custom Cabinetry', 'Stairs & Railings'],
  },
  {
    group: 'Systems',
    tags: ['Plumbing & Electrical', 'HVAC & Fresh Air', 'Waterproofing',
           'Water Purification', 'Smart Home'],
  },
  {
    group: 'Outdoor',
    tags: ['Pools & Water Features', 'Sunroom & Canopy', 'Garden & Landscaping'],
  },
];
export const ALL_SERVICES = SERVICE_GROUPS.flatMap(g => g.tags);  // 20 tags
```

---

## What Changes Where

### A. `src/lib/tagTaxonomy.ts` — NEW FILE

Single source of truth for the whole system. All components import from here.

```ts
export const SPACE_TAXONOMY = [
  {
    id: 'residential',
    label: 'Residential',
    tags: ['Apartment', 'Villa', 'Luxury Residential', 'Townhouse'],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    tags: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall'],
  },
  {
    id: 'public',
    label: 'Public / Institutional',
    tags: ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  },
  {
    id: 'outdoor',
    label: 'Outdoor / Landscape',
    tags: ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
  },
];

export const SERVICE_GROUPS = [...]; // grouped version of current SERVICES

export const ALL_SPACE_TAGS = SPACE_TAXONOMY.flatMap(g => g.tags);
export const ALL_SERVICES = SERVICE_GROUPS.flatMap(g => g.tags);

export function getL1ForTag(tag: string): string | null { ... }
```

---

### B. Project Edit — `src/pages/company/CompanyProjectsPage.tsx`

**Current:** flat `TAGS` array, click to toggle.

**New:**
1. **L1 dropdown** (AdminSelect, size `sm`): "Select project type…" → Residential / Commercial / Public / Outdoor
2. **L2 chips** (dynamic, appear only after L1 chosen): the corresponding L2 tags from `SPACE_TAXONOMY`
3. **Optional service tags**: below L2 chips, same grouped multi-select style as company profile Services

State changes:
```ts
const [spaceL1, setSpaceL1] = useState<string>('');  // replaces current `style`?
const [tags, setTags] = useState<string[]>([]);        // L2 space tags (multi)
const [serviceTags, setServiceTags] = useState<string[]>([]);  // service tags
```

API payload: add `service_tags` field (stored separately from space `tags`).

**DB:** `projects` table already has `tags` (JSON) — reuse for space L2 tags. Add `service_tags` column (JSON) for service-type tags. Migration: default `service_tags = '[]'` for existing rows.

---

### C. Per-Image Tag — `ImageEntry` Schema Change

**Current `ImageEntry`:**
```ts
interface ImageEntry {
  url: string;
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}
```

**New:**
```ts
interface ImageEntry {
  url: string;
  tag?: string;           // NEW — one user-assigned space/scene tag
  ai_tags?: string[];
  ai_category?: string[];
  ai_tagged_at?: string;
}
```

**UI change in the project edit image grid:**

**Batch-assign mode (primary UX):**
- Each image card has a checkbox in the corner (appears on hover, or always visible in edit mode)
- User ticks multiple image checkboxes → a floating tag bar appears at the bottom of the grid showing the available L2 space tags
- Clicking a tag assigns it to all checked images simultaneously
- After assignment, checkboxes clear, confirmed by a subtle tag chip on each image card

**Per-image tag display:**
- Each image card shows its current tag as a small chip overlay (bottom-left)
- Clicking the chip on a single image opens a mini picker to reassign

**Constraint:** each image gets exactly ONE tag. Assigning a new tag to an image replaces the old one. Multiple images CAN share the same tag.

If no L2 tags are selected yet in step B, the tag assignment UI shows "Select project type first".

No backend schema change needed — `images` column is already `JSON`, `tag` field just gets stored alongside `url`.

**Backend:** `persistProjectImages` in `projectImageStorage.ts` — already passes through the image objects; just needs to not strip unknown fields. Verify and add `tag` to the pass-through.

---

### D. Company Profile — `src/components/company/CompanyProfileForm.tsx`

**Specialties section:** Replace flat chip list with visually grouped layout.

Current flat list:
```
[ Residential ] [ Villa ] [ Commercial ] [ Hospitality ] [ Retail ] ...
```

New grouped layout (still flat multi-select, grouped by L1 header):
```
Residential
  [ Apartment ] [ Villa ] [ Luxury Residential ] [ Townhouse ]
Commercial
  [ Retail ] [ Office ] [ Restaurant ] [ Hotel ] [ Hospitality ] [ Showroom ] [ Mall ]
Public / Institutional
  [ School ] [ Education ] [ Healthcare ] [ Hospital ] [ Club ] [ Factory ] [ ADU ] [ Mixed-Use ]
Outdoor / Landscape
  [ Garden ] [ Terrace ] [ Pool ] [ Fence ] [ Driveway ] [ Landscape ]
```

Values stored in `specialties` JSON column stay as-is (flat array of L2 strings). No DB change. Just visual grouping.

**Services section:** Replace flat chip list with grouped layout (6 groups from taxonomy). Visual only — `services` JSON column stays flat.

---

### E. Find Company — Navbar Dropdown + Filter Page

**Navbar "Find Company" dropdown:**
```
SPACE TYPE                      SERVICE
──────────────────────────────  ──────────────
Residential                     Interior Design
Commercial                      Fit-Out / Renovation
Public / Institutional          Construction
Outdoor / Landscape             Landscape
                                MEP
                                Joinery & Furniture
                                Maintenance
  All Companies →
```

Clicking a space type → `/companies?space=residential` (or `commercial` etc.)
Clicking a service → `/companies?service=Interior+Design`

**Company list page filter sidebar:**
- Group 1: Space Type (L1 radio/checkbox)
- Group 2: Service (existing multi-select)

**Backend `GET /api/companies` filter:** add `?space=residential` that filters by companies whose `specialties` JSON array contains ANY of the L2 tags under that L1 category. Use `JSON_OVERLAPS` or `JSON_CONTAINS`.

```sql
-- Example: space=residential
WHERE JSON_OVERLAPS(specialties, '["Apartment","Villa","Luxury Residential","Townhouse"]')
```

---

### F. Company Detail Page — Portfolio Tab

After these changes, the company detail page portfolio display can group project images by their `tag` field. Each unique tag becomes a section header.

This is Phase 2 — not required for the initial tag overhaul launch.

---

## Implementation Phases

### Phase 1 — Taxonomy file + Company profile UI (no DB changes)
1. Create `src/lib/tagTaxonomy.ts`
2. Update `CompanyProfileForm.tsx`: grouped Specialties + grouped Services
3. Update Onboarding wizard Specialties step to use grouped layout
4. **No DB change needed** — just visual reorganization, same flat array stored

### Phase 2 — Project edit tags (hierarchical)
1. Update `CompanyProjectsPage.tsx` project form: L1 dropdown → L2 chips
2. Add `service_tags` state + API payload
3. Add `service_tags` column to `projects` table via `autoMigrate`
4. Update `projectController.ts` to read/write `service_tags`
5. Update mobile project upload page if applicable

### Phase 3 — Per-image tag
1. Add `tag?: string` to `ImageEntry`
2. Add tag picker UI per image card in project edit form
3. Verify `persistProjectImages` passes through `tag` field
4. Add one-to-one constraint enforcement in frontend (selecting tag X on image A clears tag X from any other image)

### Phase 4 — Find Company filter
1. Update Navbar `FindCompany` dropdown to show L1 space groups + service groups
2. Update company list filter sidebar
3. Update `GET /api/companies` query to support `?space=` filter

### Phase 5 — Portfolio grouping (company detail page)
1. Group images by `tag` on the company detail portfolio tab
2. Add tag filter chips on the portfolio view

---

## Files Touched Summary

| File | Change |
|------|--------|
| `src/lib/tagTaxonomy.ts` | NEW — full taxonomy definition |
| `src/components/company/CompanyProfileForm.tsx` | Grouped Specialties + Services UI |
| `src/pages/company/CompanyProjectsPage.tsx` | L1 dropdown, L2 chips, per-image tag |
| `src/pages/company/CompanyOnboardingPage.tsx` | Grouped Specialties step |
| `src/components/Navbar.tsx` | Find Company dropdown groups |
| `src/pages/CompaniesPage.tsx` (or similar) | Space type filter |
| `server/src/lib/projectPersistence.ts` | Add `service_tags` field |
| `server/src/controllers/projectController.ts` | Read/write `service_tags` |
| `server/src/lib/autoMigrate.ts` | Add `service_tags` column to projects |
| `server/src/controllers/companyController.ts` | `?space=` filter on company list |

---

## Data Migration

- **Specialties** (company_profiles): no migration — new L2 values overlap with existing ones. Companies that had "Residential" still have "Residential". Add new L2 options (Apartment, Townhouse, Garden, etc.) going forward.
- **Project tags**: existing flat tags (Apartment, Villa, Bathroom, etc.) — Apartment/Villa remain valid L2 tags. Others (Bathroom, Kitchen, Lighting, Storage) are dropped from the taxonomy. No DB cleanup needed for old rows — frontend just ignores unknown values.
- **service_tags**: new column, default `[]` for all existing projects.

---

## Confirmed Decisions

1. **`style` field** (Modern Contemporary, Classic, etc.) — **stays independent**. Not merged with L1 space tags. Both coexist on the project form.
2. **Project L2 space tags** — multi-select (Villa + Outdoor can both be selected).
3. **Per-image tag** — each image gets exactly one tag. Multiple images can share the same tag. Batch-assign UI lets user tick multiple images and assign the same tag in one click.

## Open Questions (remaining)

1. Per-image tag — required or optional before submitting? Or always optional?
