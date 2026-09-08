# 全站图片上传自动压缩 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让公共上传组件将超限图片在浏览器端逐张压缩后再上传，覆盖拖放、文件夹、粘贴与选择文件。

**Architecture:** 新的 `uploadImageCompression` 工具负责文件阈值判断与可测试的压缩参数策略，浏览器 Canvas 负责编码。`ImageUploadZone` 在调用现有 XHR 上传前调用该工具，因此供应商产品、项目及目录共享同一逻辑；PDF 分块上传维持原流程。

**Tech Stack:** TypeScript、React 19、Canvas API、Node test。

---

### Task 1: 为压缩策略补充先失败的单元测试

**Files:**
- Create: `src/lib/uploadImageCompression.test.mjs`
- Create: `src/lib/uploadImageCompression.ts`

**Step 1:** 断言小图跳过压缩、超限图片启用压缩、PNG 选择 WebP、JPEG 选择 JPEG，以及压缩轮次会降低质量和尺寸。

**Step 2:** 执行 `node --test src/lib/uploadImageCompression.test.mjs`，确认在实现前失败。

**Step 3:** 实现纯策略函数及浏览器端文件转换函数。

**Step 4:** 再次执行单元测试，确认全绿。

### Task 2: 接入公共上传组件

**Files:**
- Modify: `src/components/ui/ImageUploadZone.tsx`
- Modify: `src/lib/uploadImageCompression.ts`

**Step 1:** 在 `uploadOne` 前预处理图片；非图片和分块 PDF 不参与处理。

**Step 2:** 保持原文件名、逐张进度、成功即显示和失败提示逻辑。

**Step 3:** 构建验证 `node_modules/.bin/next build`。

### Task 3: 回归与上线

**Files:**
- Modify: `scripts/harness/smoke-test.mjs`（仅在现有用例无法覆盖公共上传路径时）
- Modify: `.claude/skills/tarmeer-failure-archaeology/SKILL.md`

**Step 1:** 跑单元测试、供应商产品上传回归及烟测。

**Step 2:** 进行三轮规格/安全、质量、集成审查，修复后复审。

**Step 3:** 构建、部署前端，并以真实供应商页面上传超限样本验证。
