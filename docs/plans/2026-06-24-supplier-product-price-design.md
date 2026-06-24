# 供应商产品上传必须带价格 + 单位 — 设计文档

> 日期：2026-06-24 ｜ 状态：已确认，待实现
> 来源：用户需求「供应商上传东西要带上价格」，brainstorming 收敛

## 1. 范围

只改 **产品 Products**。Projects / Catalogs / License **不动**。

外贸场景：对方产品/品类不确定，建材相关。价格 + 单位都要填。

## 2. 决策汇总（brainstorming 结论）

| 决策点 | 结论 |
|--------|------|
| 目标实体 | 仅 Products |
| 价格形式 | 必填 + 单位 + 可选「起价 / From」勾选 |
| 币种 | 跟随供应商所属国家自动（AE=AED / VN=VND / SA=SAR），不入库，显示时从 `country.ts` 推导 |
| 单位 | 下拉框（建材外贸常用）+ 自定义文本 |
| 存量旧产品 | DB 列可空兼容旧行；公共页无价格则不显示价格块；新上传强制必填 |

## 3. 数据库

`supplier_products` 表新增 3 列（走 `server/dist/lib/autoMigrate.js` 的 columns 数组，幂等加列）：

| 列 | 类型 | 说明 |
|----|------|------|
| `price` | `DECIMAL(12,2) NULL` | DB 允许 NULL（兼容存量），但**接口 + 表单层强制必填且 > 0** |
| `price_unit` | `VARCHAR(32) NULL` | 单位编码或自定义文本 |
| `price_from` | `TINYINT(1) NOT NULL DEFAULT 0` | 「起价 / From」标记 |

**币种不入库**：由供应商 `supplier_profiles.country`（已存在，autoMigrate line 130）推导，显示时取 `src/lib/country.ts` 的 `currency`。符合「单一真相源 + 国家隔离」铁律。
> 实现前确认 country.ts 中 SA 已配置 `currency: 'SAR'`（grep 仅见 AED/VND，需补 SA）。

## 4. 单位字典（建材外贸常用）

单处定义为常量（`src/lib/` 下，禁止多处硬编码）。预设：

`PCS 件`、`SET 套`、`SQM ㎡`、`LM 延米`、`M 米`、`CBM m³`、`KG 千克`、`TON 吨`、`ROLL 卷`、`CTN 箱`、`BAG 袋`、`SHEET 张`、`CONTAINER 货柜(20'/40')` + 「自定义…」→ 文本框。

## 5. 后端

`server/dist/controllers/supplierProductController.js`：
- `addProduct` / `updateProduct` 接收 `price / price_unit / price_from`。
- 校验：`price` 必填且 > 0；`price_unit` 必填（自定义时非空）；否则 400。
- INSERT / UPDATE 带上新列。
- `listMyProducts` SELECT 带出新列。

⚠️ **全量搜索铁律**：grep `server/dist` 与 `src` 中所有读 `supplier_products` 的 SELECT（含公共供应商详情页产品区），统一带出新列。

## 6. 前端

`src/app/supplier/products/page.tsx`：
- `Product` interface 加 `price / price_unit / price_from`。
- 表单加：价格数字输入（必填，`bg-white`）+ 单位 `<AdminSelect>`（选「自定义」出文本框）+「起价」勾选。
- 未填价格/单位 → 提交按钮 disabled。
- 产品卡片展示：`{currency} {price 千分位}{price_from?' 起':''} / {unit}`，例 `AED 1,200 起 / ㎡`。

公共供应商详情页产品区：同步显示价格；无价格的旧产品不显示价格块。

## 7. 部署 & 测试

- 改了 `server/dist/` → rsync 后端 + `pm2 restart tarmeer-api`；改了 `src/` → 前端部署。autoMigrate 后端启动自动加列。
- 测试（AGENTS.md 第六步）：
  - `node scripts/harness/smoke-test.mjs`（tsc + 路由 + 可达）
  - 本地 `next build` exit=0
  - 新增用例：上传产品不填价格 → 被拒（400 / 按钮 disabled）；填了价格 → 正确入库 + 详情页按国家币种展示。
