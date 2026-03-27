# Edit Project Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改核心业务逻辑和不上线的前提下，完成 Edit Project 页面改版（P0+P1）并提供“uploading...”无感提交体验。  
**Architecture:** 以前端结构重组为主，后端接口保持兼容；通过 Context 层插入 optimistic uploading 项目，实现提交后立即可见，再由真实响应回填。  
**Tech Stack:** React 19 + TypeScript + Tailwind + Playwright。

---

### Task 1: 建立失败测试（提交可用性反馈）

**Files:**
- Modify: `tests/auth-registration-persistence.spec.ts`
- Test: `tests/auth-registration-persistence.spec.ts`

**Step 1: Write the failing test**
- 新增用例：进入 `/designer/upload` 时，未满足必填项要显示 `Incomplete submission` 和 `Missing:` 文案。

**Step 2: Run test to verify it fails**
- Run: `npx playwright test tests/auth-registration-persistence.spec.ts -g "edit project shows incomplete submission status with explicit missing fields" --workers=1`
- Expected: FAIL（当前页面无该状态栏或文案不匹配）

**Step 3: Write minimal implementation**
- 在上传页实现状态栏与缺失项计算。

**Step 4: Run test to verify it passes**
- 同上命令，Expected: PASS

### Task 2: 上传页结构重构（P0）

**Files:**
- Modify: `src/pages/designer/DesignerUploadPage.tsx`

**Step 1: Replace heavy progress block**
- 删除 `Upload Flow` / 大进度条 / steps chip。
- 新增 Header + 简洁状态栏。

**Step 2: Tighten form and metadata grouping**
- Description 改为推荐填写。
- 元数据区重排并保持两列主布局。

**Step 3: Upgrade Image Board interactions**
- 增加封面预览、紧凑网格、拖拽反馈、上传状态统计。
- 删除使用二次确认。

**Step 4: Add autosave status UX**
- 增加本地自动保存状态提示，减少输入焦虑。

### Task 3: My Projects uploading 过渡态

**Files:**
- Modify: `src/contexts/DesignerContext.tsx`
- Modify: `src/pages/designer/DesignerProjectsPage.tsx`

**Step 1: Add uploading statuses in model**
- 扩展项目状态：`uploading`, `upload_failed`。

**Step 2: Add optimistic submit helper**
- Context 新增 optimistic 添加方法，先插卡片，再请求。
- 增加自动重试（上限 8 次）。

**Step 3: Render uploading state**
- My Projects 卡片支持 `uploading...` 展示和视觉区分。

### Task 4: P1 交互增强

**Files:**
- Modify: `src/pages/designer/DesignerUploadPage.tsx`

**Step 1: Add image preview modal**
- 支持上一张/下一张、序号、封面状态、设封面和删除。

**Step 2: Strengthen micro feedback**
- 排序后提示 `Image order updated`。
- 上传失败提示保持明确原因。

### Task 5: Verification

**Files:**
- Modify: `docs/WORKING-RULES-AND-TODO.md`

**Step 1: Run focused checks**
- `npm --prefix server run build`
- `npm run build`
- `npx playwright test tests/auth-registration-persistence.spec.ts -g "edit project shows incomplete submission status with explicit missing fields|designer project survives logout and login again|designer project with a heavy gallery survives a My Projects refresh|new draft stays on an edit route and survives refresh" --workers=1`

**Step 2: Record result in working doc**
- 追加本轮“本地完成，未上线”状态与验收命令。

