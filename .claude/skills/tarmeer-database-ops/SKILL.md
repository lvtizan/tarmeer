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

## 2026-09-30 采购询价 schema 与管理员国家边界
- **现象**：独立 DDL 若漏跑，新询价控制器可能读写不存在字段；country 查询参数可扩大后台读取范围。
- **根因**：迁移未绑定严格启动，国家过滤未绑定登录管理员。
- **修复**：ensureSourcingRequestSchema 接入 autoMigrate(required)，手动预检共用同一实现并保留既有 enum/default/nullability；非 super admin 强制使用 admin.country。
- **预防规则**：新增数据库字段先迁移、校验再上代码；必须测迁移失败不监听、幂等再执行、普通管理员 country 参数伪造；批量内容变更必须有完整行备份、并发前置比较、事务和未修改字段断言。

## [2026-09-30] 公开供应商资料白名单与代采身份
- 公开 DTO 禁止展开 `supplier_profiles.*`；只列出页面所需字段，营业执照、账号关联、创建人、内部权重及未来新增列不能自动外发。
- 代采目录搜索只按公开品类、编号与公开 reference 匹配，不以私密公司名称作为公开探测条件；后台管理员搜索保留真实公司字段。
- supplier fallback SEO 与公开详情同样带 country、approved、is_published；结构化 JSON 输出转义 `<`，防闭合 script。
- AE-only 商品详情链接不得从 VN 产品库生成；非 AE 保留当地图库入口。跨页面共享组件变更必须同时查供应商产品库、分类页、主目录和搜索入口。
