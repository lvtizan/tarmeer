---
name: tarmeer-country-isolation
description: Tarmeer AE/VN 国家数据隔离契约——本仓库最高优先级铁律。适用于：任何涉及公司/用户/询盘/投诉/问卷/统计的读写接口、admin 列表页、跨表 JOIN、新增用户侧写入口。任何 AE 视图出现越南文（或反之）= P0。
---

# 国家数据隔离契约（铁律，违反 = 返工）

## 何时不用本技能

- 改动与数据查询/写入完全无关（纯样式、纯文案）→ 不需要，但文案要分清 AE/VN 站
- 想了解国家归属机制的完整表 → `docs/testing/country-bucketing.md`（本技能是约束，那份是机制细节）
- 跑验证 → `tarmeer-verification`

## 七条铁律

1. **跨表引用必须成对存储 `(ref_id, ref_source)`**，禁止只存 id 靠默认值猜表。
2. **解析公司引用的 JOIN 必须带国家一致性条件**（如 `AND uc.country = ci.country`）——即使数据错了，显示层也要兜底不让错国文字漏出。
3. **所有列表/统计/导出/搜索接口必须接受并应用 `country` 参数**；admin 页面从 `useAdminCountry()`（`src/contexts/AdminCountryContext.tsx`）取 country 传给每一个请求，country 变化时重置分页/缓存。
4. **所有用户侧写入口落库时必须确定国家归属**（机制：phone 前缀 `+84`/`084`=vn、country 字段、slug `vn-` 前缀、page_path）。
5. **外勤/问卷按操作人所属国家（`admin_users.country`）过滤公司搜索**。
6. **AE 视图出现越南文（或反之）= P0**，排查链：ref_source → JOIN → country 条件。
7. **新增/修改写入口或国家相关查询后，必须跑 `node scripts/harness/country-walkthrough.mjs` 全绿**。

## 血的教训（为什么有第 1 条）

2026-06-10：问卷 saveDraft 对缺失的 `company_ref_source` 默认 `'uae'`，实际引用的是 company_profiles 表；VN 公司导入 uae_companies 后占用相同 ID 区间，阿联酋访谈记录立刻冒出越南公司名。完整案例见 `tarmeer-failure-archaeology`。

## 常用归属速查

| 数据 | 归属机制 |
|------|---------|
| users / designers | phone 前缀（+84/084=vn），无 phone 默认 ae |
| company_profiles / supplier_profiles | 注册时按 phone 前缀写 country |
| design_inquiries | company_id → company_profiles.country；无公司按 phone 兜底 |
| complaints | slug `vn-` 前缀 OR ∈ VN company_profiles |
| company_interviews | saveDraft/reSubmit 时由 company_ref 推导 |
| visitor_logs / analytics_events | page_path LIKE '/companies/vn-%' |

已知边界：业主注册无手机号 → 归 AE；外勤手填公司名不关联 → 默认 'ae'。

## 开发检查清单

新写入口/新查询上线前自问：

- [ ] 落库时 country 如何确定？写清楚了还是靠默认值？（靠默认值 = 违反第 1 条）
- [ ] 查询/JOIN 带 country 条件了吗？
- [ ] admin 页面新请求传了 `useAdminCountry()` 的 country 吗？
- [ ] 前端城市白名单同步了吗？（询盘 city 校验在 `server/dist/controllers/inquiryController.js` 的 `VALID_CITIES`，**前端下拉加城市必须同步后端白名单**，VN 城市曾因缺白名单被 400）
- [ ] `country-walkthrough.mjs` 全绿？（注意：注册接口有限流，连跑两次 429，重启本地后端再跑）

## 姊妹文档

写完代码 → `tarmeer-verification`；出了串桶事故 → `tarmeer-debugging` + 归档进 `tarmeer-failure-archaeology`。
