# Service Categories Expansion — Design Doc

**Date**: 2026-04-28
**Status**: Approved
**Scope**: Expand company_type + services enums, update all form dropdowns, enrich public filter

---

## Background

Market analysis of 162 contractor leads (TikTok @tarmeer contractor network) revealed 10 business categories not covered by the current 8 company_type values. Full analysis: `.context/market-analysis-2026-04-28.md`

---

## Decisions

- Expand **both** `company_type` (main category, single-select) and `services` (multi-select tags)
- For-companies signup form: extend `company_type` dropdown only (keep form short)
- Public companies page: both company_type filter AND services multi-select filter
- **Zero DB migration**: `company_type` is already VARCHAR, `services` is already JSON — no schema changes needed

---

## New company_type Values (10 added, 18 total)

| Value | EN Label | AR Label |
|---|---|---|
| `fitout_contractor` | Fit-Out Contractor | مقاول تشطيبات |
| `glass_aluminium` | Glass & Aluminium | زجاج وألمنيوم |
| `waterproofing` | Waterproofing | عزل مائي |
| `smart_home` | Smart Home & IT | منازل ذكية وتقنية |
| `fire_fighting` | Fire Fighting & Safety | حماية من الحرائق |
| `carpentry_joinery` | Carpentry & Joinery | نجارة وأعمال خشبية |
| `stone_marble` | Stone, Marble & Tile | حجر ورخام وبلاط |
| `steel_fabrication` | Steel & Metal Works | أعمال حديد ومعادن |
| `cleaning_services` | Cleaning Services | خدمات التنظيف |
| `manpower_supply` | Manpower Supply | توريد عمالة |

---

## New services Tags (11 added, 32 total)

HVAC & Ducting, Fire Fighting, Smart Home & Automation, Waterproofing, Solar Systems, Epoxy & PU Flooring, Scaffolding, Lighting Installation, Stone & Marble Fixing, Gypsum & Partitions, Deep Cleaning

---

## Files Changed

| File | Change |
|---|---|
| `server/src/lib/companyProfileDraft.ts` | Extend `VALID_COMPANY_TYPES` (8→18) + `VALID_SERVICES` (21→32) |
| `src/lib/companyData.ts` | Extend `COMPANY_TYPE_LABELS` map |
| `src/i18n/forCompanies.ts` | Add 10 EN + AR label keys for new types |
| `src/components/for-companies/CompanySignupForm.tsx` | Add 10 items to `COMPANY_TYPES` array |
| `src/components/company/CompanyProfileForm.tsx` | Extend company_type dropdown + services multi-select |
| `src/components/admin/CompanyEditModal.tsx` | Extend company_type dropdown |
| `.context/market-analysis-2026-04-28.md` | Save market analysis report |

---

## Files NOT Changed

- DB schema (no migration needed)
- API routes
- `publicCompanyController.ts` (already reads company_type dynamically)
- `AdminApplicationsTable.tsx` color map (new types fallback to default style gracefully)

---

## Testing

- `npx tsc --noEmit` — no unused variables
- Visit `/for-companies` → company type dropdown shows 18 options
- Visit `/companies` → type filter + services filter both work with new values
- Admin company edit modal → new types selectable
- Company profile form → new types selectable, new services checkable
