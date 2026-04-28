# Company UX Fixes — Test Cases

> Related commit: `fix(company): project tags rename, materials filter, rejection banner`
> Related commit: `fix(crm): remove duplicate CRM push on company application`

---

## TC-UX-01: Project Tags label

**File:** `src/pages/company/CompanyProjectsPage.tsx:445`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as company → Projects → Upload New Project | Form renders |
| 2 | Scroll to tag section | Label reads **"Project Tags"** (not "Renovation Tags") |
| 3 | Select a tag | Tag highlights in gold |

---

## TC-UX-02: Materials filter — Dubai first + 跨境 label

**URL:** `/materials/`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/materials/` desktop | Left sidebar ORIGIN section: order is **Dubai → 跨境** (not China → Dubai) |
| 2 | Click 跨境 | Supplier cards filter to `origin = 'china'`; badge on card reads **🇨🇳 跨境** |
| 3 | Click Dubai | Badge on card reads **🇦🇪 Dubai** |
| 4 | Mobile viewport (375px) | Pill filters order: All → Dubai → 跨境 |
| 5 | Select 跨境 on mobile | Result count line shows `· 🇨🇳 跨境` |

---

## TC-UX-03: Project rejection banner + reason

**Prereq:** Need a `projects` row with `status = 'rejected'` and `rejection_reason` set. Insert via DB:

```sql
-- Find a company_profile_id for test
SELECT id FROM company_profiles LIMIT 1;

-- Insert rejected project
INSERT INTO projects (company_profile_id, title, status, rejection_reason, images, tags, style, location, slug)
VALUES (<id>, 'Test Rejected Project', 'rejected', 'Images are too low resolution. Please upload at least 1000px width.', '[]', '[]', 'modern', 'Dubai', 'test-rejected-proj');
```

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as that company → Projects | Amber banner appears at top: `"Test Rejected Project" was not approved` |
| 2 | Check banner subtext | `Review the reason below and resubmit after making changes.` |
| 3 | Find the project card | Red box below title: `Reason: Images are too low resolution...` |
| 4 | Approved project card | No red reason box shown |
| 5 | Pending project card | No banner triggered by it (only rejected count) |
| 6 | Multiple rejected projects | Banner reads `X projects need your attention` |

---

## TC-CRM-02: applyAsCompany does NOT push to CRM (harness)

> Extends TC-FC-03 in `test-crm-routing.mjs`

**What to verify:** After calling `POST /api/auth/company/apply`, no call is made to `pushCompanyLeadToCRM`.

**Method:** Inject a spy by checking CRM push config is absent in test env (CRM_URL not set → push is no-op), then assert that the DB state is unaffected (no new `design_inquiries` row from the apply route).

**Manual check (simpler):**

```bash
# Search for pushCompanyLeadToCRM in companyApplicationController.ts
grep "pushCompanyLead" server/src/controllers/companyApplicationController.ts
# Expected: no output (function removed)
```

Run this now:
