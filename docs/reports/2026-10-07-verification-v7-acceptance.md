# V7 访谈升级验收记录

状态：0.1.48 已上线；三轮审查、本地及生产验收通过。

## 范围与保留

AE/迪拜访谈填写及后台详情按参考 HTML 升级，服务端提取 327 字段（320 普通答案、7 证据类别），客户端从 DB schema 或记录快照渲染。旧答案及字段不改写。既有公开公司侧写不会自动被 V7 覆盖。未指定版本的旧缓存客户端继续使用 legacy。

用户最新要求：后续国家业务验收只测迪拜，不开展 VN 业务验收；国家及引用来源隔离规则仍生效。

## 测试证据

- 最终 `next build` exit=0；构建后已重启 5180 开发服务。
- 最终 smoke：42/42 PASS。
- 前端动态字段及恢复逻辑：16/16 PASS。
- 实际 API 客户端 transport：6/6 PASS（含附件/照片上传 401）。
- 后台真实 React 渲染及列表：22/22 PASS。
- 服务端目录、验证及能力令牌：7/7 PASS。
- 本地独立 MySQL + HTTP V7 集成：15/15 PASS（此前完成，包括保存、提交、并发、附件、旧数据、事务回滚）。
- 部署连接配置：5/5 PASS，实际 SSH 预检 exit=0。
- 既有编辑 7/7、附件 5/5、其他答案 5/5；公开价格 33/33 PASS。
- 浏览器：真实 V7 保存→提交→后台查看；320px/390px/PC 无页面横向溢出；320px 操作栏可用；PC 区域列表正确；旧记录未知答案和附件仍显示。

## 独立审查

1. 规格/安全：5 项发现（404 草稿、重复显示、320px 操作栏、区域列表、401 登录恢复）；均修复复审，CLEAR。独立客户端 27/27、后台 22/22。
2. 修复/质量：0 项问题，CLEAR；独立 65/65 PASS。
3. 整体/遗漏：0 项问题，CLEAR；独立 56/56 PASS，参考 HTML 哈希一致、命名控件及上传类别完整。

## 备份及部署入口

- 本地原版：`/Users/yiming/Code/tarmeer/backups/visit-records-before-v7-20261007-220255/`（含原代码、参考 HTML、测试前本地数据库）。
- 生产发布前：`/tarmeer/backups/verification-v7-20261007/`（API dist、前端构建/source、35 条访谈、1 份旧 schema、18 条审计记录及原 Git HEAD/BUILD_ID）。
- 私有认证保存在仓库外，未输出或提交。标准入口：`docs/operations/deployment-runbook.md`、AGENTS.md、前后端部署技能；先运行 `node scripts/ops/deploy-preflight.mjs`。
- 发布顺序：兼容后端同步并重启 → 前端 pull/build 成功并重启 → SSH 使用生产 .env 激活 schema。激活再次备份且事务内验证所有旧列未改。

## 生产结果

- 发布 commit `daa1c4d379d87360b5303b9e9bc9c98237d4c496`；生产 Next build exit=0，前后端 online。
- BUILD_ID：`kofLt9Ujt1Sg_Wa9uP-sb` → `yxVIBDX9bndY_VUtuZ6xe`，确认新构建运行。
- 激活附加备份 `verification-before-v7-2026-10-07T14-37-21-854Z.json`；35/35 旧访谈逐列检查未改写，原问卷快照保留。
- 迪拜生产 HTTP 8/8 PASS：327 字段、旧缓存兼容、ID-only 读取拒绝、保存读取零值/区域、提交、后台详情、列表区域、35 条旧快照。测试数据已单独归档并清理。
- 公网首页、问卷、后台访谈、V7 schema 4/4 HTTP200。
- 生产浏览器复核：V7 后台六章节、零人数及区域恢复正确；PC 1792px / 手机 320px 页面宽度匹配；手机编辑入口加载原答案，输入框白色、Next 品牌金色。浏览器验收夹具另行归档清理。
