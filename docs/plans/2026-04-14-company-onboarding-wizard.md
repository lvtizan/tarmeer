# Company Onboarding Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace empty Dashboard landing for new companies with a 3-step wizard that forces project upload before accessing Dashboard.

**Architecture:** New independent page `/company/onboarding` (no CompanyLayout). CompanyLayout adds guard that redirects new companies (no projects + onboarding incomplete) to the wizard. PhoneRequiredModal skips company users. Backend adds `onboarding_step` column to company_profiles.

**Tech Stack:** React + TypeScript + Tailwind, Express backend, MySQL

---

## Task 1: Add onboarding_step column to company_profiles

**Files:**
- Modify: `server/src/lib/autoMigrate.ts` (add REQUIRED_COLUMNS entry)

**Step 1:** Add to the `REQUIRED_COLUMNS` array:

```typescript
{ table: 'company_profiles', column: 'onboarding_step', type: 'TINYINT DEFAULT 0' },
```

**Step 2:** Commit

```bash
git add server/src/lib/autoMigrate.ts
git commit -m "feat: add onboarding_step column to company_profiles"
```

---

## Task 2: Backend — return onboarding_step + project count in profile API

**Files:**
- Modify: `server/src/controllers/companyProfileController.ts`

**Step 1:** In `getProfile`, add project count to the response. After fetching profile, add:

```typescript
// Count projects for this company
let projectCount = 0;
if (profile) {
  const [countRows] = await pool.execute(
    'SELECT COUNT(*) as cnt FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL',
    [profile.id]
  );
  projectCount = (countRows as any[])[0]?.cnt || 0;
}
res.json({ profile: profile || null, projectCount });
```

**Step 2:** In `upsertProfile`, accept and save `onboarding_step` if provided in the payload. Add to UPDATE and INSERT queries:

For UPDATE — only update onboarding_step if it's higher than current (never go backwards):
```sql
, onboarding_step = GREATEST(COALESCE(onboarding_step, 0), ?)
```

For INSERT — include onboarding_step in fields.

**Step 3:** Commit

```bash
git add server/src/controllers/companyProfileController.ts
git commit -m "feat: return projectCount in profile API + save onboarding_step"
```

---

## Task 3: Skip PhoneRequiredModal for company users

**Files:**
- Modify: `src/components/company/CompanyLayout.tsx`

**Step 1:** Remove `<PhoneRequiredModal blocking />` from CompanyLayout (line 54). Company users will provide phone in the Wizard Step 1 instead.

**Step 2:** Commit

```bash
git add src/components/company/CompanyLayout.tsx
git commit -m "feat: skip PhoneRequiredModal for company users (moved to wizard)"
```

---

## Task 4: CompanyLayout onboarding guard

**Files:**
- Modify: `src/components/company/CompanyLayout.tsx`

**Step 1:** After auth validation succeeds (line 30), also fetch profile + project count:

```typescript
const [profileData, setProfileData] = useState<any>(null);
const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

// Inside the auth check useEffect, after setAuthValid(true):
api.get('/auth/company/profile').then(res => {
  setProfileData(res);
  const profile = res.profile;
  const projectCount = res.projectCount || 0;
  const step = profile?.onboarding_step || 0;
  // Needs onboarding if: no projects AND hasn't completed step 2
  setNeedsOnboarding(projectCount === 0 && step < 2);
}).catch(() => setNeedsOnboarding(false));
```

**Step 2:** After auth check, before rendering:

```typescript
if (needsOnboarding === true) {
  return <Navigate to="/company/onboarding" replace />;
}
if (needsOnboarding === null) {
  return <div>Checking session...</div>; // still loading
}
```

**Step 3:** Commit

```bash
git add src/components/company/CompanyLayout.tsx
git commit -m "feat: add onboarding guard to CompanyLayout"
```

---

## Task 5: Create CompanyOnboardingPage — the 3-step Wizard

**Files:**
- Create: `src/pages/company/CompanyOnboardingPage.tsx`

This is the biggest task. The page has:

### State
```typescript
const [step, setStep] = useState(1);
// Step 1 fields
const [companyName, setCompanyName] = useState('');
const [contactPerson, setContactPerson] = useState('');
const [phoneRegion, setPhoneRegion] = useState(GCC_PHONE_OPTIONS[0]);
const [phoneDigits, setPhoneDigits] = useState('');
// Step 2 fields
const [projectTitle, setProjectTitle] = useState('');
const [projectCity, setProjectCity] = useState('Dubai');
const [projectStyle, setProjectStyle] = useState('');
const [imgs, setImgs] = useState<string[]>([]);
// Step 3 fields
const [description, setDescription] = useState('');
const [services, setServices] = useState<string[]>([]);
const [specialties, setSpecialties] = useState<string[]>([]);
const [website, setWebsite] = useState('');
const [companyType, setCompanyType] = useState('Renovation Company');
// UI state
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
```

### Layout
- Independent page (no CompanyLayout), just Navbar at top
- Progress bar: 3 dots/steps at top, gold for completed
- Max-width content area centered
- Mobile: single column, CTA fixed at bottom

### Step 1: Company Basics
- Company Name*, Contact Person*, Phone* (GCC selector)
- Pre-fill from user data (api.get('/auth/me') for full_name + phone)
- Continue → POST /auth/company/profile with { company_name, contact_person, phone, onboarding_step: 1 }
- Also POST /auth/profile { phone } to save phone to users table

### Step 2: Upload First Project
- Motivational banner at top (gold bg): "The more project photos you upload, the higher you rank in search results."
- Project Title*, City* (select), Style (select, optional)
- Image upload zone: drag-drop + click + folder support
- Reuse image logic from CompanyProjectsPage: `convertProjectImagesForUpload`, compression, size validation
- Min 1 image to enable Continue
- Continue → POST /projects with { title, location: city, style, images, tags: [], status: 'pending' }
- Then PATCH profile with onboarding_step: 2

### Step 3: Complete Profile
- Motivational banner: "A complete profile gets 3x more inquiries and ranks higher."
- Description (textarea), Services* (tag toggle), Specialties (tag toggle), Website, Company Type (select)
- Skip for now → set onboarding_step: 3, navigate to /company/dashboard
- Finish → save profile fields + set onboarding_step: 3, navigate to /company/dashboard

### Design rules (from CLAUDE.md — MUST include in subagent prompt):
- Use `<AdminSelect />` for dropdowns, NOT raw `<select>`
- Gold primary `#b8864a`
- Inputs: `h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80`
- Labels: `text-xs font-medium uppercase tracking-wider text-stone-500`
- Button: `btn-primary` class
- GCC phone selector pattern from Banner.tsx

### Commit

```bash
git add src/pages/company/CompanyOnboardingPage.tsx
git commit -m "feat: add 3-step company onboarding wizard page"
```

---

## Task 6: Register route + lazy import

**Files:**
- Modify: `src/App.tsx`

**Step 1:** Add lazy import:
```typescript
const CompanyOnboardingPage = lazy(() => import('./pages/company/CompanyOnboardingPage'));
```

**Step 2:** Add route BEFORE the company layout routes (since it's independent, no CompanyLayout):
```tsx
{/* ====== Company Onboarding (no layout) ====== */}
<Route path="/company/onboarding" element={<ProtectedRoute><CompanyOnboardingPage /></ProtectedRoute>} />
```

**Step 3:** Commit

```bash
git add src/App.tsx
git commit -m "feat: register /company/onboarding route"
```

---

## Task 7: TypeScript check + harness test

**Step 1:** Run TypeScript check
```bash
npx tsc --noEmit
```
Fix any errors.

**Step 2:** Run SEO linter
```bash
node scripts/harness/lint-seo.mjs
```

**Step 3:** Manual test flow
1. Delete test user from RDS
2. Register as company at /join
3. Verify email, login
4. Should redirect to /company/onboarding (NOT dashboard)
5. Step 1: fill company name, contact, phone → Continue
6. Step 2: fill title, city, upload 1 photo → Continue
7. Step 3: Skip or fill → lands on /company/dashboard
8. Logout, login again → should go to Dashboard (not wizard)
9. Test on mobile viewport (375px)

**Step 4:** Commit any fixes

```bash
git add -A
git commit -m "fix: onboarding wizard QA fixes"
```
