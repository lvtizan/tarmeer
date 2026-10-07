# Visit verification V7 implementation plan

> For agentic workers: use superpowers:subagent-driven-development. User authorizes parallel ownership and production release after strict tests and reviews.

**Goal:** Upgrade AE interview collection and admin details to all six V7 steps, preserving legacy records and country boundaries.

**Architecture:** DB-managed V7 catalogue with stored schema snapshots and verification_data JSON; metadata-driven responsive UI; legacy section_1..9 remain unchanged.

**Tech Stack:** Next.js 16, React 19, Express compiled JS, MySQL, node:test and project harness.

## 1. Backend and migration — backend_v7 owns
- [x] Inspect all field/admin interview paths and permissions; send schema contract.
- [x] Write failing node:test cases for V7 persistence validation, snapshot version selection, country isolation and legacy preservation.
- [x] Generate server-owned V7 catalogue from reference HTML, retain exact fields/options including works/counts/trades/projects/evidence.
- [x] Add verification_data/schema_version/schema_snapshot safely; migrations require backup and preserve existing answers. New AE drafts use V7 only after configured schema installed.
- [x] Protect new draft contacts with capability token; preserve authorized editing and avoid changing legacy data.
- [x] Run unit tests and real local save → submit → admin detail assertions.

## 2. Survey — survey_v7 owns
- [x] Read current schema-driven survey and Next use-client guide; retain legacy renderer.
- [x] Write failing tests for metadata-driven empty/zero/numeric/custom values, validation and review formatting.
- [x] New dynamic renderer: six steps, company contacts copy, groups of work with counts/custom rows, team/trades availability, projects/evidence, verification and review.
- [x] PC step sidebar and dual columns; mobile horizontal steps/single columns/safe action bar, explicit save/upload failures.
- [x] Preserve protected admin edit flow, country header, capability draft restoration and cleanup; draft save/submit/export/print.

## 3. Admin — admin_v7 owns
- [x] Write failing tests for snapshot choice and V7 all-field formatting including zeros/arrays/nested rows/unsafe URL.
- [x] Render detail from stored schema; retain legacy detail and existing company binding/delete/filter/editor logs.
- [x] Add responsive lists/details, explicit errors and country race protection.
- [x] Ensure unknown legacy fields remain visible and no cross-country records appear.

## 4. Integration and environment — root owns
- [x] Add optional country/version/capability args to fieldApi, coordinate stable types with workers.
- [x] Establish local MySQL/backends on localhost using local-only env; install compatible deps and baseline checks.
- [x] Obtain production SSH access, inspect deployed commits/process cwd, back up code and survey data using server env before migration.
- [x] Add real V7 walkthrough including role/country/capability/legacy/save-read/submit/attachments cases.
- [x] Run node scripts/harness/smoke-test.mjs; country-walkthrough.mjs; field-attachments-test.mjs; field-edit-test.mjs; field-other-test.mjs; V7 tests. All must pass with counts.
- [x] Run node_modules/.bin/next build exit 0; restart development server. Verify PC and phone UI and error cases.

## 5. Independent review and release — root orchestrates
- [x] Independent round 1 specification/security; fix and repeat until clear.
- [x] Independent round 2 fixes/quality; fix and repeat until clear.
- [x] Independent round 3 integration/omissions; fix and repeat until clear.
- [ ] Re-run affected validations, bump patch version, commit only feature files, fetch/rebase if needed and push main fast-forward.
- [ ] Back up production code/schema/records; migrate on server, rsync exact changed backend files and restart API; pull/build frontend then restart Next only after successful build.
- [ ] Verify BUILD_ID changed, health, authenticated detail and phone/PC, preserve rollback evidence. Record final test counts and three round findings.

最新测试范围：按用户追加要求，后续国家业务验收仅迪拜；国家隔离继续由代码审查及既有防护保证。生产按兼容后端 → 前端 → 激活 V7 顺序发布。
