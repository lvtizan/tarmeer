# V7 输入校验、错误定位与自动保存验收（0.1.49）

范围：当前 AE 访谈问卷全部 327 个字段与 2 个重复行子字段。schema 始终由数据库 API 下发；策略清单见 `verification-v7-input-policies.md`。按用户要求仅跑迪拜业务路径，未跑 VN 业务用例。

## 发布前证据

- 单元、真实 React 渲染与 API 错误传输：91/91 PASS。
- 327 字段及嵌套策略前后端对照：2883/2883 PASS。
- Dubai HTTP + MySQL：12/12 PASS，包括元数据备份/事务/答案与时间戳保全/重复迁移、历史无效日期纠正、草稿/提交/admin/重新提交校验、字段错误键、号码/地址/编号/金额/面积/枚举、附件并发追加与删除。
- smoke-test：42/42 PASS；最终 `next build` exit=0；`git diff --check` PASS。
- 浏览器：320px 和 1440px 无横向溢出；失焦及选择操作显示 Saved to server；非法地图输入重载后原样恢复；跨步骤错误跳回字段并聚焦；日期输入范围 1900-01-01 至迪拜今天，执照日期允许未来 30 年。

## 三轮独立审查

1. 规格/安全：3 项（服务端语义错误缺 field_key、年份词法不严格、缓存写失败归属清理）；全部修复，CLEAR。
2. 质量复审：2 项（Unicode code point 长度一致性、提交缓存与草稿指针归属清理）；全部修复，CLEAR。增量自动保存及锁内附件删除追加复审 CLEAR。
3. 集成/遗漏：0 项，CLEAR；独立 91/91 与 2883/2883 PASS。

## 生产发布记录

发布前备份：`/tarmeer/backups/verification-navigation-20261007/`，包含前后端、旧 BUILD_ID、36 条当时访谈与 2 个 schema。迁移只补充 AE V7 schema/快照的策略元数据，保留所有原答案与自定义标签，不修改 legacy。迁移在生产事务内确认 1/1 AE V7 记录的每个答案、时间戳及非 schema 列保持一致；35 条 legacy 保持原快照。

自动保存使用本机恢复缓存加修改字段 PATCH；附件删除由服务端对当前记录加锁后按明确 URL 删除，并发新附件保留。服务器拒绝非法值时保留本机原输入并显示待同步；提交后编辑需显式重新提交。

## 生产验收（2026-10-07）

- 产品提交 `caa1c4655973b5e02bfcef94655d188a35744ea5` 已推送 main 并上线；版本 0.1.49。
- 前端生产 build exit=0，重启后 BUILD_ID 从 `yxVIBDX9bndY_VUtuZ6xe` 变为 `eblaoNdZ0IWiTHR3IIoeI`；tarmeer-api 与 tarmeer-next 均 online。
- 真实生产 HTTP 写入→读取→提交→后台详情/列表：17/17 PASS。包含古老年份、非法电话/纯数字地址/年份指数写法/表情编号/伪造地图域名拒绝并带 field_key；增量字段保存保留另一页字段；附件删除安全重试；旧客户端仍取 legacy。
- 合成测试记录 99 已私有归档后移除，仅清理本次创建的记录及其日志。
- 首页、填写入口、访谈后台、schema API：4/4 HTTP 200；14 个前端脚本资源均可达，实际线上问卷 bundle 包含自动保存状态与附件删除增量协议。
- 部署方式见 `docs/operations/deployment-runbook.md`；规则与问题复盘已归档项目技能库，并追加到原工作区，保留其中既有修改。
