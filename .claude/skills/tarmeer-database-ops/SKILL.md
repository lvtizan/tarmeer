---
name: tarmeer-database-ops
description: Tarmeer 数据库操作安全——本地库与生产 RDS 的边界、脚本运行规矩、schema 漂移防护。适用于：跑任何操作数据库的脚本、写 SQL、seed/清理数据、修 collation/字段问题。第一步永远是确认 DB_HOST。
---

# 数据库操作安全

## 何时不用本技能

- 只是读代码里的 SQL 逻辑 → 不需要
- 后端代码部署 → `tarmeer-deploy-backend`
- 国家归属字段设计 → `tarmeer-country-isolation`

## 第一步：确认连的是哪个库（每次必做）

跑任何操作数据库的脚本前，先看 `server/.env` 的 `DB_HOST`：

- `DB_HOST=localhost` → 本地 MySQL `tarmeer` 库，生产不受影响
- `DB_HOST=rm-eb3t6y5093m91i2wzqo...` → **生产 RDS，停手**

**铁律：凡要改生产数据，必须 SSH 到服务器（`ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104`），用服务器上的 `/tarmeer/tarmeer_api/.env` 执行。本地脚本只做本地开发。**

## 脚本分类速查

| 脚本 | 性质 | 运行位置 |
|------|------|---------|
| `scripts/seed-vn-experts.js`、`seed-vn-expert-projects.js`、`update-vn-expert-services.js`、`prune-low-quality-experts.js` | 写库 | 本地（造/清测试数据） |
| `scripts/vietnam-scraper/import.js` | 爬虫数据入库 | 本地 |
| `scripts/filter-portfolio-images.js` | 写库（图片引用），需本地图片 + sharp | **只能本地** |
| 服务器 `/tmp/purge-vn-missing.js` | 删生产库失效图片引用 | 只在服务器上跑，且先向用户确认 |
| `tests/feature-verify.mjs` | MySQL 直连断言 | 本地 |

## Schema 漂移防护（本地绿生产炸的根源）

1. **跨表字符串比较（列 vs 列）上线前**，在生产查比对 collation：
   ```sql
   SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME IN ('表A','表B') AND COLUMN_NAME IN ('列A','列B');
   ```
   collation 不一致 = 生产直接 500（历史事故，见 `tarmeer-failure-archaeology` FA-7）。
2. **避免 `SELECT *` / `SELECT sp.*`**：生产库可能缺列，触发 ER_BAD_FIELD_ERROR（revert 549d85ab3）。显式列名。
3. 本地加了列/表，生产也要同步 DDL 才能部署引用它的代码——DDL 先行，代码后上。

## 破坏性操作闸门

- DELETE/UPDATE 无 WHERE、TRUNCATE、DROP：先输出将影响的行数（`SELECT COUNT(*)` 同条件），向用户展示并确认。
- 生产写操作前后各留一次可核对的快照/计数。
- 批量数据操作优先写成幂等脚本（可重跑不翻倍）。

## 姊妹文档

引用/归属字段怎么设计 → `tarmeer-country-isolation`；操作完验证 → `tarmeer-verification`。
