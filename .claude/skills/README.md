# Tarmeer 项目技能索引

项目私有技能，2026-07-03 由仓库考古 + 用户访谈蒸馏而成，取代原 `memory/*.md`（已不存在的 pitfalls/backend-patterns/ui-patterns/deployment/images）。

## 按场景选技能

| 场景 | 技能 |
|------|------|
| 新会话首次接触仓库 / 找东西在哪 | `tarmeer-architecture` |
| 动手写代码前 | `tarmeer-change-control` + `tarmeer-protected-features` |
| 任何国家相关读写 | `tarmeer-country-isolation` |
| 前端 UI 改动 | `tarmeer-ui-conventions` |
| 下拉/分类/枚举/问卷字段 | `tarmeer-dynamic-data` |
| 公开页面 / URL / 详情页空态 | `tarmeer-seo-conventions` |
| 数据库脚本 / SQL | `tarmeer-database-ops` |
| 写完代码验收 | `tarmeer-verification` |
| 上线前端 | `tarmeer-deploy-frontend` |
| 上线后端（改了 server/dist/） | `tarmeer-deploy-backend` |
| 新增静态图片 / 图片 404 | `tarmeer-image-pipeline` |
| 线上故障排查 | `tarmeer-debugging` |
| 查历史事故 / 修完 bug 归档 / 想懂某条怪规矩的来历 | `tarmeer-failure-archaeology` |
| 改 Footer/专家页/问卷等敏感区，或想"顺手优化" | `tarmeer-protected-features` |

## 典型工作流串联

改功能：change-control →（country-isolation / ui-conventions / dynamic-data 按需）→ verification → deploy-* → 出事故则 debugging → failure-archaeology 归档。

## 维护规则

- 新踩坑：案例进 `tarmeer-failure-archaeology`，预防规则写进对应专项技能，两边都要动。
- 规则变更（如部署方式调整）：改对应技能 + 检查姊妹技能引用是否连带失效。
- 每份技能都有"何时不用"一节，新增技能必须保持这个结构，禁止复述 README 式的水货内容。
