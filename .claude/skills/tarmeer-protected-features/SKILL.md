---
name: tarmeer-protected-features
description: Tarmeer 锁定功能清单——这些功能有逐条铁律，历史上被改坏过或有业务硬约束，改动前必须逐条核对，违反 = 必须还原/返工。适用于：改 Footer、专家页、联系表单、问卷渲染、任何"顺手优化一下"的冲动出现时。
---

# 锁定功能清单（改前逐条核对）

## 何时不用本技能

- 改动完全不触碰下列区域 → 不需要，但共享组件改动仍要过 `tarmeer-change-control` 回归守则
- 想知道这些规矩的来历 → `tarmeer-failure-archaeology`

## 1. VN Footer 联系块（`src/components/Footer.tsx`，锁定）

VN 站（`lang === 'vi'`）底部联系方式必须同时满足：

1. 显示**两个**号码（来自 `VN_WHATSAPP_NUMBERS`）：+84 886 770 218 和 +84 888 175 938
2. 标签格式 `Zalo / WhatsApp: {号码}`（不得简化为只写 WhatsApp）
3. 两个号码缺一不可

违反任何一条 = 必须还原。

## 2. 专家页联系表单（铁律）

1. `ExpertInquiryForm` 必须同时出现在：专家详情页（ExpertDetailClient）右侧 sticky 栏 + 专家项目详情页（ExpertProjectDetailClient）右侧 sticky 栏；桌面端隐藏时移动端必须在内容底部补显。
2. 电话号码（`RevealExpertPhone`）**仅 VN 站显示**（`isVn === true`），AE 站不显示。
3. 联系表单组件统一从 `src/components/experts/ExpertContactSidebar.tsx` 导入，禁止页面内重新实现。
4. 侧边栏顺序（上→下）：询价表单（所有国家）→ 电话查看（VN only）→ 快速信息（经验年限、城市）。

## 3. 问卷 schema 渲染（NEVER hardcode）

survey schema（section 标题、field key、label、options）禁止硬编码在任何前端文件。权威来源：`survey_schema` 表 + `GET /api/field/survey-schema`。详见 `tarmeer-dynamic-data`。

## 4. 服务分类名

分类名以 admin 建立的为权威，前端不得擅自改名/美化（曾被整体 revert，ed0b91356）。

## 5. 国家隔离机制

`(ref_id, ref_source)` 成对存储、JOIN 国家条件、country 参数链路——这些不是"可以顺手简化"的代码，是事故换来的结构。任何简化前读 `tarmeer-country-isolation`。

## 6. 已回滚区域（动之前查前科）

- 作品集 filter bar（scroll-listener + fixed 是五连修后的最终方案，FA-4）
- Supplier 详情页（曾整页回滚到 504845b7）
- for-companies 页（曾回滚重设计）
- SA 沙特相关代码（已整体移除，不要复活）

## 通用判断

一段代码看起来"写得怪/冗余/可以优化"时：先 `git log -- <文件>` 查它是不是事故修复的产物，再查 `tarmeer-failure-archaeology`。**看不懂的防御代码默认有理由，删除前必须向用户确认。**
