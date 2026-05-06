# Project Rejection Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When admin rejects a company project, trigger an email to the company owner + show persistent in-app rejection banners across the company portal.

**Architecture:** Backend adds `rejection_templates` table (per-admin history) and modifies `rejectProject` to email the company owner and save the template. Admin UI gets per-project Approve/Reject buttons with a template picker dialog. Company portal gets a non-dismissible dashboard banner, "Not Approved" badges, an upload-page warning, and a deep-link scroll-highlight via `?projectId=`.

**Tech Stack:** React + TypeScript (Vite), Express + MySQL, nodemailer (existing `emailService.ts`).

---

## Existing Patterns to Follow

- **Email:** add new export to `server/src/services/emailService.ts`, call `sendTransactionalMail({ to, subject, html, text })`.
- **DB migration:** add to `REQUIRED_TABLES` array in `server/src/lib/autoMigrate.ts`.
- **Backend routes:** import handler + `router.*` in `server/src/routes/admin.ts`.
- **Admin API client:** add method to `src/lib/adminApi.ts` calling `this.request(...)`.
- **Company data fetch:** company portal uses `api.get('/auth/company/...')`.
- **rejectProject** (the function we extend): `server/src/controllers/designerAdminController.ts` line 581.

---

## Task 1: DB — rejection_templates table

**Files:**
- Modify: `server/src/lib/autoMigrate.ts`

- [ ] **Step 1: Add rejection_templates to REQUIRED_TABLES**

Open `server/src/lib/autoMigrate.ts`. Find the `REQUIRED_TABLES` array (it's an array of `{ name, sql }` objects). Add this entry before the closing `];`:

```typescript
  {
    name: 'rejection_templates',
    sql: `CREATE TABLE IF NOT EXISTS rejection_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      text TEXT NOT NULL,
      use_count INT NOT NULL DEFAULT 1,
      last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_admin_text (admin_id, text(500))
    )`,
  },
```

- [ ] **Step 2: Verify autoMigrate runs on next backend start**

Run: `cd server && npx ts-node -e "import('./src/lib/autoMigrate').then(m => m.runAutoMigrate()).then(() => process.exit(0))" 2>&1 | tail -5`

Expected output includes: `rejection_templates` created or already exists.

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/autoMigrate.ts
git commit -m "feat: add rejection_templates table migration"
```

---

## Task 2: Email — sendProjectRejectionEmail

**Files:**
- Modify: `server/src/services/emailService.ts`

- [ ] **Step 1: Add sendProjectRejectionEmail export**

At the end of `server/src/services/emailService.ts`, add:

```typescript
export async function sendProjectRejectionEmail(
  to: string,
  companyName: string,
  projectTitle: string,
  rejectionReason: string,
  projectListUrl: string,
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #b8864a;">Your project submission was not approved</h2>
      <p>Hi <strong>${companyName}</strong>,</p>
      <p>We reviewed your recently submitted project <strong>"${projectTitle}"</strong> and it does not meet our content guidelines at this time.</p>
      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 10px 12px; background:#fef2f2; border-left: 4px solid #ef4444; color:#7f1d1d; font-size:14px;">
            <strong>Reason:</strong> ${rejectionReason}
          </td>
        </tr>
      </table>
      <p>Please update your project photos to show interior design or renovation work, then resubmit for review.</p>
      <a href="${projectListUrl}" style="display:inline-block; padding:12px 24px; background-color:#b8864a; color:white; text-decoration:none; border-radius:8px; margin:16px 0; font-size:14px;">
        View &amp; Edit Your Projects
      </a>
      <p style="color:#666; font-size:13px;">If you have any questions, feel free to contact our support team.</p>
      <p style="color:#b8864a; font-weight:bold;">The Tarmeer Team</p>
    </div>
  `;

  const text = [
    `Your project submission was not approved`,
    ``,
    `Hi ${companyName},`,
    ``,
    `We reviewed your project "${projectTitle}" and it does not meet our content guidelines.`,
    ``,
    `Reason: ${rejectionReason}`,
    ``,
    `Please update your project photos (interior design / renovation work) and resubmit.`,
    ``,
    `View & Edit Your Projects: ${projectListUrl}`,
    ``,
    `The Tarmeer Team`,
  ].join('\n');

  await sendTransactionalMail({
    to,
    subject: `Your project "${projectTitle}" was not approved — Tarmeer`,
    html,
    text,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/emailService.ts
git commit -m "feat: add sendProjectRejectionEmail"
```

---

## Task 3: Backend — rejectProject sends email + saves template

**Files:**
- Modify: `server/src/controllers/designerAdminController.ts`

The existing `rejectProject` function (line 581) updates the project status but doesn't email or save templates. We extend it.

- [ ] **Step 1: Add imports at top of designerAdminController.ts**

Find the existing imports block (top of file). Add:

```typescript
import { sendProjectRejectionEmail } from '../services/emailService';
import pool from '../lib/db';
```

(If `pool` is already imported, skip that line.)

- [ ] **Step 2: Replace the rejectProject function body**

Find the existing function (starting at `export async function rejectProject`). Replace the entire function with:

```typescript
export async function rejectProject(req: any, res: Response) {
  const { projectId } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, designer_id, company_profile_id, title, status FROM projects WHERE id = ?',
      [projectId]
    );

    const projects = rows as any[];
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projects[0];
    if (!canAdminReviewProject(project.status)) {
      return res.status(400).json({ error: 'Only pending projects can be rejected.' });
    }

    await pool.execute(
      `UPDATE projects SET status = 'rejected', rejection_reason = ?, updated_at = NOW() WHERE id = ?`,
      [reason.trim(), projectId]
    );

    await logActivity(req.admin.id, 'reject_project', 'project', parseInt(projectId, 10), {
      title: project.title,
      designerId: project.designer_id,
      reason: reason.trim()
    });

    // Fire-and-forget: save template for this admin
    if (req.admin?.id) {
      pool.execute(
        `INSERT INTO rejection_templates (admin_id, text, use_count, last_used_at)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE use_count = use_count + 1, last_used_at = NOW()`,
        [req.admin.id, reason.trim()]
      ).catch((err: any) => console.error('Template save error:', err));
    }

    // Fire-and-forget: send email to company owner (if this is a company project)
    if (project.company_profile_id) {
      (async () => {
        try {
          const [cpRows] = await pool.execute(
            `SELECT u.email, cp.company_name
             FROM company_profiles cp
             JOIN users u ON u.id = cp.user_id
             WHERE cp.id = ?`,
            [project.company_profile_id]
          );
          const cp = (cpRows as any[])[0];
          if (cp?.email) {
            const frontendUrl = process.env.FRONTEND_URL || 'https://www.tarmeer.com';
            const projectListUrl = `${frontendUrl}/company/projects?projectId=${projectId}`;
            await sendProjectRejectionEmail(
              cp.email,
              cp.company_name || 'Company',
              project.title,
              reason.trim(),
              projectListUrl,
            );
          }
        } catch (emailErr) {
          console.error('Rejection email error:', emailErr);
        }
      })();
    }

    res.json({
      message: 'Project rejected.',
      project: { id: Number(projectId), status: 'rejected', rejectionReason: reason.trim() }
    });
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ error: 'Failed to reject project.' });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/controllers/designerAdminController.ts
git commit -m "feat: rejectProject sends rejection email + saves template history"
```

---

## Task 4: Backend — template CRUD routes

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/controllers/designerAdminController.ts`

- [ ] **Step 1: Add controller functions for templates**

In `server/src/controllers/designerAdminController.ts`, add at the end of the file:

```typescript
// Rejection template history (per admin)
export async function getRejectionTemplates(req: any, res: Response) {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ error: 'Unauthorized.' });

    const [rows] = await pool.execute(
      `SELECT id, text, use_count, last_used_at
       FROM rejection_templates
       WHERE admin_id = ?
       ORDER BY last_used_at DESC
       LIMIT 10`,
      [adminId]
    );

    res.json({ templates: rows });
  } catch (error) {
    console.error('getRejectionTemplates error:', error);
    res.status(500).json({ error: 'Failed to load templates.' });
  }
}
```

- [ ] **Step 2: Register route in admin.ts**

Open `server/src/routes/admin.ts`. Find the import for `designerAdminController` functions. Add `getRejectionTemplates` to the destructured import. Then find a logical place (e.g. near the project approve/reject routes) and add:

```typescript
router.get('/rejection-templates', getRejectionTemplates);
```

- [ ] **Step 3: Add adminApi client method**

Open `src/lib/adminApi.ts`. Find the `approveProject` / `rejectProject` methods and add after them:

```typescript
async getRejectionTemplates(): Promise<{ templates: Array<{ id: number; text: string; use_count: number; last_used_at: string }> }> {
  return this.request('/rejection-templates');
}
```

- [ ] **Step 4: Verify TypeScript compiles (both)**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/designerAdminController.ts server/src/routes/admin.ts src/lib/adminApi.ts
git commit -m "feat: GET /admin/rejection-templates endpoint + adminApi method"
```

---

## Task 5: Admin UI — per-project Approve/Reject buttons with template dialog

**Files:**
- Modify: `src/pages/admin/AdminRegisteredCompanyDetailPage.tsx`

Currently the project cards in this page show project info + rejection_reason but have no approve/reject buttons. We add:
1. `[Approve]` + `[Reject]` buttons on each project card (only when status is `pending` or `rejected`)
2. A reject modal with template history list + editable textarea

- [ ] **Step 1: Add state variables and helpers**

Inside `AdminRegisteredCompanyDetailPage`, find the existing state declarations (look for `showRejectModal`, `rejectReason`). Add after them:

```typescript
const [rejectingProjectId, setRejectingProjectId] = useState<number | null>(null);
const [projectRejectReason, setProjectRejectReason] = useState('');
const [projectRejectLoading, setProjectRejectLoading] = useState(false);
const [projectActionError, setProjectActionError] = useState('');
const [rejectionTemplates, setRejectionTemplates] = useState<Array<{ id: number; text: string }>>([]);
const [templatesLoaded, setTemplatesLoaded] = useState(false);
```

- [ ] **Step 2: Add loadTemplates helper**

Inside the component, add this function (before the return):

```typescript
const openProjectRejectModal = async (projectId: number) => {
  setRejectingProjectId(projectId);
  setProjectRejectReason('');
  setProjectActionError('');
  if (!templatesLoaded) {
    try {
      const { templates } = await adminApi.getRejectionTemplates();
      setRejectionTemplates(templates);
      setTemplatesLoaded(true);
    } catch {
      // ignore
    }
  }
};

const handleProjectReject = async () => {
  if (!rejectingProjectId || !projectRejectReason.trim()) return;
  setProjectRejectLoading(true);
  setProjectActionError('');
  try {
    await adminApi.rejectProject(rejectingProjectId, projectRejectReason);
    setProjects((prev: any[]) =>
      prev.map((p: any) =>
        p.id === rejectingProjectId
          ? { ...p, status: 'rejected', rejection_reason: projectRejectReason.trim() }
          : p
      )
    );
    setRejectingProjectId(null);
    setProjectRejectReason('');
    showToast('Project rejected.', 'success');
  } catch (err: any) {
    setProjectActionError(err.message || 'Failed to reject project.');
  } finally {
    setProjectRejectLoading(false);
  }
};

const handleProjectApprove = async (projectId: number) => {
  try {
    await adminApi.approveProject(projectId);
    setProjects((prev: any[]) =>
      prev.map((p: any) =>
        p.id === projectId ? { ...p, status: 'published', rejection_reason: null } : p
      )
    );
    showToast('Project approved.', 'success');
  } catch (err: any) {
    showToast(err.message || 'Failed to approve project.', 'error');
  }
};
```

Note: `setProjects` must exist — find the state declaration for the projects array in this component. If it's called something else (e.g. `setCompanyProjects`), use that name.

- [ ] **Step 3: Add buttons to project cards**

Find the project card JSX (look for `project.rejection_reason` block). After the rejection_reason `<p>` block, add the approve/reject button row:

```tsx
{(project.status === 'pending' || project.status === 'rejected') && (
  <div className="mt-2 flex gap-2">
    <button
      type="button"
      onClick={() => handleProjectApprove(project.id)}
      className="flex-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition"
    >
      Approve
    </button>
    <button
      type="button"
      onClick={() => openProjectRejectModal(project.id)}
      className="flex-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
    >
      Reject
    </button>
  </div>
)}
```

- [ ] **Step 4: Add project reject modal**

Find the end of the JSX return (near the existing company-level reject modal). Add the project reject modal after it:

```tsx
{/* Project reject modal */}
{rejectingProjectId !== null && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
      <h2 className="text-lg font-semibold">{t('Reject Project', '拒绝项目')}</h2>

      {/* Template history */}
      {rejectionTemplates.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-stone-500">{t('Recent reasons (click to use):', '历史话术（点击填入）:')}</p>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {rejectionTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setProjectRejectReason(tpl.text)}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition line-clamp-2"
              >
                {tpl.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        value={projectRejectReason}
        onChange={(e) => setProjectRejectReason(e.target.value)}
        placeholder={t('Reason for rejection...', '拒绝原因...')}
        rows={4}
        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
      />

      {projectActionError && (
        <p className="text-xs text-red-600">{projectActionError}</p>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => { setRejectingProjectId(null); setProjectRejectReason(''); }}
          className="px-4 py-2 text-sm text-stone-600"
        >
          {t('Cancel', '取消')}
        </button>
        <button
          type="button"
          onClick={handleProjectReject}
          disabled={projectRejectLoading || !projectRejectReason.trim()}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {projectRejectLoading ? t('Rejecting...', '拒绝中...') : t('Reject', '拒绝')}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If `setProjects` name is wrong, fix it to match the actual state setter name.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AdminRegisteredCompanyDetailPage.tsx
git commit -m "feat: per-project Approve/Reject buttons with rejection template picker in admin"
```

---

## Task 6: Company UI — Dashboard rejection banner

**Files:**
- Modify: `src/pages/company/CompanyDashboardPage.tsx`

Currently the dashboard fetches projects but only stores the count. We need to store the full list (or at least status info) to drive the banner.

- [ ] **Step 1: Add rejectedProjects state**

In `CompanyDashboardPage`, find:
```typescript
const [projectCount, setProjectCount] = useState(0);
```

Add below it:
```typescript
const [rejectedProjects, setRejectedProjects] = useState<Array<{ id: number; title: string; rejection_reason: string | null }>>([]);
const [hasPendingProjects, setHasPendingProjects] = useState(false);
const [bannerDismissed, setBannerDismissed] = useState(false);
```

- [ ] **Step 2: Populate from projects fetch**

Find the projects fetch block inside the `useEffect`:
```typescript
if (projectsRes.status === 'fulfilled') {
  const list = projectsRes.value?.projects || projectsRes.value || [];
  setProjectCount(Array.isArray(list) ? list.length : 0);
}
```

Replace with:
```typescript
if (projectsRes.status === 'fulfilled') {
  const list: any[] = Array.isArray(projectsRes.value?.projects)
    ? projectsRes.value.projects
    : Array.isArray(projectsRes.value) ? projectsRes.value : [];
  setProjectCount(list.length);
  setRejectedProjects(
    list
      .filter((p: any) => p.status === 'rejected')
      .map((p: any) => ({ id: p.id, title: p.title, rejection_reason: p.rejection_reason || null }))
  );
  setHasPendingProjects(list.some((p: any) => p.status === 'pending'));
}
```

- [ ] **Step 3: Add banner JSX**

In the return JSX, find the opening `<div className="w-full max-w-[900px] mx-auto space-y-8">`. Add the banner block immediately inside it, before the welcome header:

```tsx
{/* Rejection banner — non-dismissible while rejected */}
{rejectedProjects.length > 0 && (
  <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
    <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-red-800">
        {rejectedProjects.length === 1
          ? `"${rejectedProjects[0].title}" was not approved`
          : `${rejectedProjects.length} projects were not approved`}
      </p>
      {rejectedProjects[0]?.rejection_reason && (
        <p className="mt-1 text-xs text-red-700 leading-relaxed">
          Reason: {rejectedProjects[0].rejection_reason}
        </p>
      )}
      <a
        href="/company/projects"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
      >
        View &amp; fix your projects →
      </a>
    </div>
  </div>
)}

{/* Pending review banner — dismissible via sessionStorage */}
{rejectedProjects.length === 0 && hasPendingProjects && !bannerDismissed && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
    <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-amber-800">Your project is under review</p>
      <p className="mt-0.5 text-xs text-amber-700">We'll notify you once the review is complete.</p>
    </div>
    <button
      type="button"
      onClick={() => {
        setBannerDismissed(true);
        sessionStorage.setItem('tarmeer_pending_banner_dismissed', '1');
      }}
      className="text-amber-500 hover:text-amber-700 shrink-0"
      aria-label="Dismiss"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>
)}
```

- [ ] **Step 4: Read sessionStorage on mount**

In the `useEffect` that fetches data, add at the start (before the async block):

```typescript
if (sessionStorage.getItem('tarmeer_pending_banner_dismissed')) {
  setBannerDismissed(true);
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/company/CompanyDashboardPage.tsx
git commit -m "feat: rejection + pending-review banners on company dashboard"
```

---

## Task 7: Company UI — "Not Approved" badge + ?projectId scroll-highlight

**Files:**
- Modify: `src/pages/company/CompanyProjectsPage.tsx`

- [ ] **Step 1: Add useSearchParams import**

At the top of the file, `useSearchParams` is from `react-router-dom`. Add to the existing import:

```typescript
import { useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Add state and ref for highlight**

Inside `CompanyProjectsPage`, add:

```typescript
const [searchParams] = useSearchParams();
const highlightId = searchParams.get('projectId') ? Number(searchParams.get('projectId')) : null;
const highlightRef = useRef<HTMLDivElement | null>(null);
```

Add `useRef` to the existing React import if not already there.

- [ ] **Step 3: Scroll to highlighted project on load**

Inside `CompanyProjectsPage`, add a `useEffect` after the projects load:

```typescript
useEffect(() => {
  if (highlightId && highlightRef.current) {
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
}, [highlightId, projects]);
```

- [ ] **Step 4: Change "Rejected" badge text to "Not Approved" + attach ref**

Find this line (around line 326):
```typescript
{p.status === 'published' ? 'Approved' : p.status === 'pending' ? 'Under Review' : p.status === 'rejected' ? 'Rejected' : 'Draft'}
```

Change `'Rejected'` to `'Not Approved'`:
```typescript
{p.status === 'published' ? 'Approved' : p.status === 'pending' ? 'Under Review' : p.status === 'rejected' ? 'Not Approved' : 'Draft'}
```

Find the outer card `<div>` that wraps each project (the one with `key={p.id}`). It looks like:
```tsx
<div key={p.id} className="group overflow-hidden rounded-[20px] border border-stone-200 ...">
```

Replace with:
```tsx
<div
  key={p.id}
  ref={highlightId === p.id ? highlightRef : null}
  className={`group overflow-hidden rounded-[20px] border bg-white shadow-sm transition-shadow hover:shadow-md ${
    highlightId === p.id ? 'border-[#b8864a] ring-2 ring-[#b8864a]/30' : 'border-stone-200'
  }`}
>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/company/CompanyProjectsPage.tsx
git commit -m "feat: Not Approved badge + projectId deep-link scroll highlight"
```

---

## Task 8: Company UI — Upload page warning banner

**Files:**
- Modify: `src/pages/company/CompanyUploadPage.tsx`

Currently this page is minimal (just renders `<ProjectUploader>`). We add a fetch for rejected projects and show a warning.

- [ ] **Step 1: Rewrite CompanyUploadPage with warning banner**

Replace the entire file content with:

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import ProjectUploader from '../../components/ProjectUploader';
import { api } from '../../lib/api';

export default function CompanyUploadPage() {
  const [hasRejected, setHasRejected] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    !!sessionStorage.getItem('tarmeer_upload_warning_dismissed')
  );

  useEffect(() => {
    api.get('/auth/company/projects').then((data: any) => {
      const list: any[] = Array.isArray(data?.projects) ? data.projects
        : Array.isArray(data) ? data : [];
      setHasRejected(list.some((p: any) => p.status === 'rejected'));
    }).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {hasRejected && !bannerDismissed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">You have a project that wasn't approved</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Please{' '}
              <Link to="/company/projects" className="underline font-semibold">
                review the reason
              </Link>{' '}
              and fix it before uploading new work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBannerDismissed(true);
              sessionStorage.setItem('tarmeer_upload_warning_dismissed', '1');
            }}
            className="text-orange-400 hover:text-orange-600 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-stone-800 mb-2">Upload Project Case</h1>
      <p className="text-stone-500 mb-8">Showcase your company's work to attract homeowners.</p>
      {/* @ts-ignore - placeholder component */}
      <ProjectUploader ownerType="company" onSuccess={() => window.history.back()} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/company/CompanyUploadPage.tsx
git commit -m "feat: upload page warning when company has rejected projects"
```

---

## Task 9: Auth — deep link returnTo support

**Files:**
- Modify: `src/App.tsx` (ProtectedRoute function)
- Modify: `src/pages/CompanyAuthPage.tsx`

When a non-logged-in user opens the rejection email link (`/company/projects?projectId=123`), `ProtectedRoute` redirects them to `/auth`. We save the intended URL in `sessionStorage` and restore it after login.

- [ ] **Step 1: Update ProtectedRoute to save returnTo**

In `src/App.tsx`, find:
```typescript
function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = api.getToken();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}
```

Replace with:
```typescript
function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = api.getToken();
  if (!token) {
    const intended = window.location.pathname + window.location.search;
    if (intended.startsWith('/company/')) {
      sessionStorage.setItem('company_returnTo', intended);
    }
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Update CompanyAuthPage to redirect after login**

In `src/pages/CompanyAuthPage.tsx`, find the line after successful login that navigates to `/company`:
```typescript
navigate('/company');
```

There may be two such lines (for login and for register+auto-login). Replace **both** with:

```typescript
const returnTo = sessionStorage.getItem('company_returnTo');
if (returnTo) {
  sessionStorage.removeItem('company_returnTo');
  navigate(returnTo, { replace: true });
} else {
  navigate('/company');
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/CompanyAuthPage.tsx
git commit -m "feat: deep link returnTo support for company portal after login"
```

---

## Task 10: Harness verification + AdminLayout deploy fix

**Files:**
- Run: `node scripts/harness/lint-navbar-and-slug.mjs`
- Verify: all 15 checks pass

- [ ] **Step 1: Run existing harness to ensure nothing regressed**

```bash
node scripts/harness/lint-navbar-and-slug.mjs
```

Expected: `15 passed, 0 failed`

- [ ] **Step 2: Manual test checklist**

Local test (start dev server at `http://localhost:5173`):

1. **Admin template history**: Go to `/admin/profile-companies/:anyId` → find a pending project → click Reject → verify template dropdown appears (empty first time) → type a reason → submit → re-open reject modal → verify the reason appears as a history item
2. **Email**: With `DEV_SKIP_EMAIL=true`, check server logs for "DEV MAIL" line containing the rejection subject
3. **Dashboard banner**: Log in as a company user with a rejected project → go to `/company/dashboard` → verify red banner appears, is non-dismissible
4. **Dashboard pending banner**: After re-uploading a project (status → pending), go to dashboard → verify amber banner appears with X button → click X → verify it disappears and stays gone on refresh
5. **Not Approved badge**: Go to `/company/projects` → verify rejected project shows "Not Approved" instead of "Rejected"
6. **Scroll highlight**: Go to `/company/projects?projectId=<id>` → verify page scrolls to that card and it has an amber ring
7. **Upload warning**: Go to `/company/upload` → verify orange warning banner if any rejected project exists
8. **Deep link**: Log out → open `http://localhost:5173/company/projects?projectId=123` → should redirect to `/auth` → log in → should land on `/company/projects?projectId=123`

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: post-review adjustments for rejection notification system"
```

---

## Self-Review

**Spec coverage:**
- ✅ Per-admin template history (DB + routes + UI picker)
- ✅ Email on rejection (emailService + triggered from rejectProject)
- ✅ Dashboard non-dismissible red banner (rejected projects)
- ✅ Dashboard dismissible amber banner (pending after re-upload)
- ✅ "Not Approved" badge (CompanyProjectsPage badge text)
- ✅ Upload page warning banner
- ✅ Deep link `?projectId=` with scroll + highlight
- ✅ returnTo redirect after login

**Type consistency:**
- `rejectedProjects` used in Task 6 matches the shape `{ id, title, rejection_reason }` derived from the projects API — matches existing `rejection_reason` field in the DB
- `adminApi.getRejectionTemplates()` returns `{ templates: Array<{ id, text, use_count, last_used_at }> }` — used consistently in Task 5
- `handleProjectReject` and `handleProjectApprove` in Task 5 use `adminApi.rejectProject(id, reason)` and `adminApi.approveProject(id)` — both already exist in `adminApi.ts`
