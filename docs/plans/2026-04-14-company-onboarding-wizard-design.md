# Company Onboarding Wizard — Design Doc

**Date**: 2026-04-14
**Goal**: Replace empty Dashboard landing with 3-step wizard that forces project upload, solving "companies fill profile but never upload projects".

---

## Trigger
- Company user login + no projects + onboarding_step < 2 → force `/company/onboarding`
- Existing users with projects → straight to Dashboard

## PhoneRequiredModal
- Skip for role=company users. Phone collected in Wizard Step 1.

## Route
- `/company/onboarding` — independent page (no CompanyLayout)
- CompanyLayout guard: no projects + onboarding incomplete → redirect

## Step 1: Company Basics (10 seconds)
- Fields: Company Name*, Contact Person*, Phone* (GCC selector)
- Pre-fill: full_name from registration, phone from users table
- Save to company_profiles, set onboarding_step = 1

## Step 2: Upload First Project (mandatory, cannot skip)
- Motivational banner: "The more project photos you upload, the higher you rank"
- Fields: Project Title*, City*, Style (optional)
- Photo upload: drag-drop, folder, click. Min 1 photo.
- Reuse existing image upload logic (compress, persist)
- Save via POST /projects, set onboarding_step = 2

## Step 3: Complete Profile (skippable)
- Motivational banner: "A complete profile gets 3x more inquiries"
- Fields: Description, Services* (tags), Specialties (tags), Website, City, Company Type
- Skip → Dashboard. Finish → save + Dashboard.
- Set onboarding_step = 3

## Database
- Add column: company_profiles.onboarding_step TINYINT DEFAULT 0 (autoMigrate)

## Weight Score
- Profile completeness (description, services, project count, image count) factors into weight_score

## Mobile
- Single column, full-width fields
- Photo upload via tap (no drag)
- Progress bar fixed top
- CTA button fixed bottom

## Guard Logic
```
CompanyLayout load:
  1. GET /auth/company/profile
  2. Count projects
  3. if (no projects && onboarding_step < 2) → redirect /company/onboarding
```
