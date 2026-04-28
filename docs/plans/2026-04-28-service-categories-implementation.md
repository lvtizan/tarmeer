# Service Categories Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 11 new company_type values and 11 new services tags across server enums, frontend labels, i18n, signup form, profile form, and admin modal.

**Architecture:** Pure enum/constant expansion — no DB schema changes, no API route changes. VALID_COMPANY_TYPES is already VARCHAR on the server; services is already JSON. All changes are in constants, labels, and dropdown arrays.

**Tech Stack:** TypeScript, React, i18n object (forCompanies.ts)

---

## New values to add

### company_type (11 new, 19 total)
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
| `swimming_pool` | Swimming Pool Contractor | مقاول مسابح |

### services (11 new, 32 total)
HVAC & Ducting, Fire Fighting, Smart Home & Automation, Waterproofing, Solar Systems, Epoxy & PU Flooring, Scaffolding, Lighting Installation, Stone & Marble Fixing, Gypsum & Partitions, Deep Cleaning

---

## Task 1: Server — extend VALID_COMPANY_TYPES + VALID_SERVICES

**File:** `server/src/lib/companyProfileDraft.ts` lines 1–11

**Step 1: Edit the file**

Replace lines 1–11 with:

```typescript
const VALID_COMPANY_TYPES = [
  'design_studio', 'renovation_company', 'general_contractor',
  'mep_contractor', 'maintenance_company', 'specialty_trade', 'landscaping', 'furnishing',
  'fitout_contractor', 'glass_aluminium', 'waterproofing', 'smart_home', 'fire_fighting',
  'carpentry_joinery', 'stone_marble', 'steel_fabrication', 'cleaning_services',
  'manpower_supply', 'swimming_pool',
];

const VALID_SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
  'Glass & Aluminium', 'Painting & Finishing', 'Flooring & Tiling', 'Demolition',
  'Steel & Fabrication', 'Curtains & Blinds', 'Cleaning Services', 'Pools',
  'HVAC & Ducting', 'Fire Fighting', 'Smart Home & Automation', 'Waterproofing',
  'Solar Systems', 'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation',
  'Stone & Marble Fixing', 'Gypsum & Partitions', 'Deep Cleaning',
];
```

**Step 2: Type-check**

```bash
cd /Users/kp/Code/tarmeer-4.0-local
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from this file.

**Step 3: Commit**

```bash
git add server/src/lib/companyProfileDraft.ts
git commit -m "feat(categories): expand VALID_COMPANY_TYPES (8→19) + VALID_SERVICES (21→32)"
```

---

## Task 2: Frontend — extend COMPANY_TYPE_LABELS

**File:** `src/lib/companyData.ts` lines 41–50

**Step 1: Edit**

Replace the `COMPANY_TYPE_LABELS` object (lines 41–50) with:

```typescript
export const COMPANY_TYPE_LABELS: Record<string, string> = {
  design_studio: 'Design Studio',
  renovation_company: 'Renovation & Fit-out',
  general_contractor: 'General Contractor',
  mep_contractor: 'MEP Contractor',
  maintenance_company: 'Maintenance Company',
  specialty_trade: 'Specialty Trade',
  landscaping: 'Landscaping & Pools',
  furnishing: 'Furnishing',
  fitout_contractor: 'Fit-Out Contractor',
  glass_aluminium: 'Glass & Aluminium',
  waterproofing: 'Waterproofing',
  smart_home: 'Smart Home & IT',
  fire_fighting: 'Fire Fighting & Safety',
  carpentry_joinery: 'Carpentry & Joinery',
  stone_marble: 'Stone, Marble & Tile',
  steel_fabrication: 'Steel & Metal Works',
  cleaning_services: 'Cleaning Services',
  manpower_supply: 'Manpower Supply',
  swimming_pool: 'Swimming Pool Contractor',
};
```

**Step 2: Commit**

```bash
git add src/lib/companyData.ts
git commit -m "feat(categories): extend COMPANY_TYPE_LABELS with 11 new types"
```

---

## Task 3: i18n — add EN + AR label keys for new types

**File:** `src/i18n/forCompanies.ts`

The `COMPANY_TYPES` array in `CompanySignupForm.tsx` uses `labelKey` that maps to translation keys. Need to add 11 new keys to both `en` and `ar` translation objects.

**Step 1: In the `en` block, after `typeFurnishing: 'Furnishing',` (line ~50) add:**

```typescript
    typeFitoutContractor: 'Fit-Out Contractor',
    typeGlassAluminium: 'Glass & Aluminium',
    typeWaterproofing: 'Waterproofing',
    typeSmartHome: 'Smart Home & IT',
    typeFireFighting: 'Fire Fighting & Safety',
    typeCarpentryJoinery: 'Carpentry & Joinery',
    typeStoneMarble: 'Stone, Marble & Tile',
    typeSteelFabrication: 'Steel & Metal Works',
    typeCleaningServices: 'Cleaning Services',
    typeManpowerSupply: 'Manpower Supply',
    typeSwimmingPool: 'Swimming Pool Contractor',
```

**Step 2: In the `ar` block, after `typeFurnishing: 'تأثيث',` (line ~120) add:**

```typescript
    typeFitoutContractor: 'مقاول تشطيبات',
    typeGlassAluminium: 'زجاج وألمنيوم',
    typeWaterproofing: 'عزل مائي',
    typeSmartHome: 'منازل ذكية وتقنية',
    typeFireFighting: 'حماية من الحرائق',
    typeCarpentryJoinery: 'نجارة وأعمال خشبية',
    typeStoneMarble: 'حجر ورخام وبلاط',
    typeSteelFabrication: 'أعمال حديد ومعادن',
    typeCleaningServices: 'خدمات التنظيف',
    typeManpowerSupply: 'توريد عمالة',
    typeSwimmingPool: 'مقاول مسابح',
```

**Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (the `t()` function type-checks keys against the translations object).

**Step 4: Commit**

```bash
git add src/i18n/forCompanies.ts
git commit -m "feat(categories): add i18n keys for 11 new company types (EN + AR)"
```

---

## Task 4: CompanySignupForm — extend COMPANY_TYPES array

**File:** `src/components/for-companies/CompanySignupForm.tsx` lines 20–29

**Step 1: Edit**

Replace the `COMPANY_TYPES` array (lines 20–29) with:

```typescript
const COMPANY_TYPES = [
  { value: 'design_studio', labelKey: 'typeDesignStudio' as const },
  { value: 'renovation_company', labelKey: 'typeRenovation' as const },
  { value: 'general_contractor', labelKey: 'typeGeneralContractor' as const },
  { value: 'mep_contractor', labelKey: 'typeMepContractor' as const },
  { value: 'maintenance_company', labelKey: 'typeMaintenanceCompany' as const },
  { value: 'specialty_trade', labelKey: 'typeSpecialtyTrade' as const },
  { value: 'landscaping', labelKey: 'typeLandscaping' as const },
  { value: 'furnishing', labelKey: 'typeFurnishing' as const },
  { value: 'fitout_contractor', labelKey: 'typeFitoutContractor' as const },
  { value: 'glass_aluminium', labelKey: 'typeGlassAluminium' as const },
  { value: 'waterproofing', labelKey: 'typeWaterproofing' as const },
  { value: 'smart_home', labelKey: 'typeSmartHome' as const },
  { value: 'fire_fighting', labelKey: 'typeFireFighting' as const },
  { value: 'carpentry_joinery', labelKey: 'typeCarpentryJoinery' as const },
  { value: 'stone_marble', labelKey: 'typeStoneMarble' as const },
  { value: 'steel_fabrication', labelKey: 'typeSteelFabrication' as const },
  { value: 'cleaning_services', labelKey: 'typeCleaningServices' as const },
  { value: 'manpower_supply', labelKey: 'typeManpowerSupply' as const },
  { value: 'swimming_pool', labelKey: 'typeSwimmingPool' as const },
];
```

**Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors — the `as const` type-checks against the i18n keys added in Task 3.

**Step 3: Commit**

```bash
git add src/components/for-companies/CompanySignupForm.tsx
git commit -m "feat(categories): extend CompanySignupForm COMPANY_TYPES to 19 options"
```

---

## Task 5: CompanyProfileForm — extend SERVICES + TYPE_OPTIONS

**File:** `src/components/company/CompanyProfileForm.tsx` lines 31–43

**Step 1: Edit**

Replace `SERVICES` and `TYPE_OPTIONS` (lines 31–43) with:

```typescript
export const SERVICES = [
  'Interior Design','Architecture','Fit-Out','Renovation','Construction','Landscape',
  'Furniture','Joinery','MEP','Project Management','Design & Build','Turnkey Solutions','Maintenance',
  'Glass & Aluminium','Painting & Finishing','Flooring & Tiling','Demolition',
  'Steel & Fabrication','Curtains & Blinds','Cleaning Services','Pools',
  'HVAC & Ducting','Fire Fighting','Smart Home & Automation','Waterproofing',
  'Solar Systems','Epoxy & PU Flooring','Scaffolding','Lighting Installation',
  'Stone & Marble Fixing','Gypsum & Partitions','Deep Cleaning',
];
export const SPECIALTIES = ['Residential','Villa','Commercial','Hospitality','Retail','Office','Education','Healthcare','F&B','Luxury Residential','Mixed-Use'];
export const EMIRATES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
export const TYPE_OPTIONS = [
  { value:'design_studio', label:'Interior Design Studio' },
  { value:'renovation_company', label:'Renovation & Fit-out' },
  { value:'general_contractor', label:'General Contractor' },
  { value:'mep_contractor', label:'MEP Contractor' },
  { value:'maintenance_company', label:'Maintenance Company' },
  { value:'specialty_trade', label:'Specialty Trade' },
  { value:'landscaping', label:'Landscaping & Pools' },
  { value:'furnishing', label:'Furnishing' },
  { value:'fitout_contractor', label:'Fit-Out Contractor' },
  { value:'glass_aluminium', label:'Glass & Aluminium' },
  { value:'waterproofing', label:'Waterproofing' },
  { value:'smart_home', label:'Smart Home & IT' },
  { value:'fire_fighting', label:'Fire Fighting & Safety' },
  { value:'carpentry_joinery', label:'Carpentry & Joinery' },
  { value:'stone_marble', label:'Stone, Marble & Tile' },
  { value:'steel_fabrication', label:'Steel & Metal Works' },
  { value:'cleaning_services', label:'Cleaning Services' },
  { value:'manpower_supply', label:'Manpower Supply' },
  { value:'swimming_pool', label:'Swimming Pool Contractor' },
];
```

**Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/components/company/CompanyProfileForm.tsx
git commit -m "feat(categories): extend CompanyProfileForm SERVICES (21→32) + TYPE_OPTIONS (8→19)"
```

---

## Task 6: CompanyEditModal — extend SERVICES + company_type options

**File:** `src/components/admin/CompanyEditModal.tsx`

Two changes: `SERVICES` constant (lines 15–20) and the `AdminSelect` options for `company_type` (lines 206–213).

**Step 1: Replace SERVICES (lines 15–20)**

```typescript
const SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
  'Glass & Aluminium', 'Painting & Finishing', 'Flooring & Tiling', 'Demolition',
  'Steel & Fabrication', 'Curtains & Blinds', 'Cleaning Services', 'Pools',
  'HVAC & Ducting', 'Fire Fighting', 'Smart Home & Automation', 'Waterproofing',
  'Solar Systems', 'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation',
  'Stone & Marble Fixing', 'Gypsum & Partitions', 'Deep Cleaning',
];
```

**Step 2: Replace company_type AdminSelect options (lines 206–213)**

```typescript
                  options={[
                    { value: 'design_studio', label: 'Design Studio' },
                    { value: 'renovation_company', label: 'Renovation & Fit-out' },
                    { value: 'general_contractor', label: 'General Contractor' },
                    { value: 'mep_contractor', label: 'MEP Contractor' },
                    { value: 'maintenance_company', label: 'Maintenance Company' },
                    { value: 'specialty_trade', label: 'Specialty Trade' },
                    { value: 'landscaping', label: 'Landscaping & Pools' },
                    { value: 'furnishing', label: 'Furnishing' },
                    { value: 'fitout_contractor', label: 'Fit-Out Contractor' },
                    { value: 'glass_aluminium', label: 'Glass & Aluminium' },
                    { value: 'waterproofing', label: 'Waterproofing' },
                    { value: 'smart_home', label: 'Smart Home & IT' },
                    { value: 'fire_fighting', label: 'Fire Fighting & Safety' },
                    { value: 'carpentry_joinery', label: 'Carpentry & Joinery' },
                    { value: 'stone_marble', label: 'Stone, Marble & Tile' },
                    { value: 'steel_fabrication', label: 'Steel & Metal Works' },
                    { value: 'cleaning_services', label: 'Cleaning Services' },
                    { value: 'manpower_supply', label: 'Manpower Supply' },
                    { value: 'swimming_pool', label: 'Swimming Pool Contractor' },
                  ]}
```

**Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/components/admin/CompanyEditModal.tsx
git commit -m "feat(categories): extend CompanyEditModal SERVICES + company_type options"
```

---

## Task 7: Verify public filter works (no code change needed)

`CompaniesPage.tsx` already reads company types dynamically from the loaded companies list. The services filter also uses whatever services are in the data. No code change required — just verify.

**Step 1: Start local dev server**

```bash
npm run dev
```

**Step 2: Manual checks**

- Visit `http://localhost:5173/for-companies` → Company Type dropdown shows 19 options
- Visit `http://localhost:5173/companies` → Company Type filter shows new types for any company that has them; Services filter shows new services for any company with them
- Visit admin → edit any company → company_type dropdown has 19 options, services checkboxes show 32 items

**Step 3: tsc final check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Summary of all changed files

| File | Change |
|---|---|
| `server/src/lib/companyProfileDraft.ts` | VALID_COMPANY_TYPES 8→19, VALID_SERVICES 21→32 |
| `src/lib/companyData.ts` | COMPANY_TYPE_LABELS 8→19 entries |
| `src/i18n/forCompanies.ts` | +11 EN keys, +11 AR keys |
| `src/components/for-companies/CompanySignupForm.tsx` | COMPANY_TYPES 8→19 items |
| `src/components/company/CompanyProfileForm.tsx` | SERVICES 21→32, TYPE_OPTIONS 8→19 |
| `src/components/admin/CompanyEditModal.tsx` | SERVICES 21→32, company_type options 8→19 |
| `.context/market-analysis-2026-04-28.md` | New file (market analysis report) |
| `docs/plans/2026-04-28-service-categories-design.md` | New file (design doc) |
