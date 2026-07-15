---
name: tarmeer-failure-archaeology
description: Tarmeer 失败案例考古——历史事故的现象/根因/修复/预防规则档案。适用于：动手改高危区域前查前科、新事故修复后归档、想知道"为什么会有这条奇怪的规矩"。每次修完 bug 必须往这里追加条目（不归档 = 没修完）。
---

# 失败案例考古

## 何时不用本技能

- 找操作步骤 → 各专项技能（deploy/image/country 等）已把预防规则内化，日常按那些执行即可
- 正在救火 → `tarmeer-debugging`（分诊表），灭完火再回来归档

## 案例档案

### FA-1 国家串桶事件（2026-06-10，用户认定代价最大之一）
- **现象**：阿联酋 admin 访谈记录里冒出越南公司名。
- **根因**：问卷 saveDraft 对缺失的 `company_ref_source` 默认 `'uae'`；VN 公司导入 uae_companies 后占用相同 ID 区间，引用解析指错表。
- **修复**：引用改为成对存储 `(ref_id, ref_source)`；JOIN 补国家一致性条件。
- **预防**：`tarmeer-country-isolation` 七条铁律 + country-walkthrough 全绿。**教训本质：靠默认值猜归属 = 定时炸弹。**

### FA-2 全站图片被删事件（用户认定代价最大之一）
- **现象**：线上站点图片大面积丢失，被迫花大量时间重新上传。
- **根因**：服务器图片目录被删除性操作波及（rsync/清理类操作缺确认闸门）。
- **修复**：人工重传全部图片。
- **预防**：`tarmeer-image-pipeline` 防删铁律——rsync 禁 `--delete`、删除类操作先列清单征得用户确认、批量操作前后核对文件数。

### FA-3 "做好的功能被改坏"惯性回归（用户长期痛点）
- **现象**：新改动上线，旧功能悄悄坏掉；多次整页 revert（supplier 详情页 5f26227d6、for-companies 页 16186213a、服务分类名 ed0b91356）。
- **根因**：共享组件/共享逻辑改动没排查全部引用点；大重构一把梭。
- **预防**：`tarmeer-change-control` 回归守则（改共享组件先 Grep 引用点、每个受影响页面自查、重构先问用户）+ `tarmeer-protected-features` 锁定清单。

### FA-4 filter bar 一日五连修（2026-04-26）
- **现象**：作品集筛选栏定位问题，同日 5 个 commit 反复横跳（fixed→sticky→IntersectionObserver→ResizeObserver→sticky→scroll-listener+fixed，09fa260de→33a8e34f2）。
- **根因**：`position: sticky` 在 `flex-1` main 容器内失效；无诊断盲试方案。
- **修复**：最终方案 scroll-listener + fixed。
- **预防**：动这个组件前读懂最终方案的 commit；CSS 定位问题先确认容器上下文再选方案；禁止盲改试错式提交。

### FA-5 生产 build 失败静默跑旧版
- **现象**：部署"成功"，站点看似正常，实际 pm2 一直跑旧代码。
- **根因**：`next build` 失败时 pm2 不会停，旧 `.next` 继续服务。
- **预防**：部署后对比 `.next/BUILD_ID`（`tarmeer-deploy-frontend` 必验项）。

### FA-6 本地绿生产炸：类型文件漏提交
- **现象**：本地 build 绿，生产 build 失败。
- **根因**：引用新类型/新字段的文件提交了，`types.ts` 没进同一个 commit，本地靠未提交文件通过。
- **预防**：`tarmeer-change-control` 提交纪律第 1 条。

### FA-7 collation 不一致直接 500 / ER_BAD_FIELD_ERROR
- **现象**：跨表字符串比较接口生产 500，本地正常；另有 `SELECT sp.*` 引用生产库没有的列（revert 549d85ab3）。
- **根因**：本地与生产库 schema/collation 漂移。
- **预防**：上线前在生产查 `INFORMATION_SCHEMA.COLUMNS` 比对 `COLLATION_NAME`；避免 `SELECT *`，显式列名（`tarmeer-database-ops`）。

### FA-8 deploy-simple.sh 部署错目录
- **现象**：跑了部署脚本，线上没变化。
- **根因**：`deploy-simple.sh` 面向已废弃的旧 Vite 目录结构。
- **预防**：该脚本禁用于前端部署；`docs/operations/deploy-safety-workflow.md` 相关段落是旧架构遗留，以 `tarmeer-deploy-frontend` 为准。

### FA-9 SA 沙特脚手架整体回滚（96e17eea7）
- **现象**：三国架构推倒重来，只保留 AE/VN。
- **教训**：不要为"将来可能的国家"预埋分支逻辑；发现遗留 SA 代码应清理而非扩展。

### FA-10 软 404 不被收录
- **现象**：动态详情页数据拉不到时渲染 fallback UI，Google 不收录。
- **预防**：fetch 失败分支必须 `notFound()`，禁止 200 + fallback。

### FA-11 硬编码 schema 静默丢数据
- **现象**：DB 加了问卷字段，admin 详情页看不到；用户填的答案"消失"且无报错。
- **根因**：前端硬编码 survey schema。
- **预防**：`tarmeer-dynamic-data`——schema 一律来自 `GET /api/field/survey-schema`。

### FA-12 SSR 取数兜底缺陷 + 一次错误诊断（2026-07-03）
- **现象**：代码层面确认：生产不设 `NEXT_PUBLIC_API_URL` 时，多数页面 SSR 取数兜底到相对路径 `/api`（Node fetch 必然失败）且被静默吞掉。⚠️ 但最初"线上 /companies 正文全空"的诊断是**错的**——验证者只读了抓取结果的前 99 行就下结论；读完全文后确认线上 HTML 有完整公司内容（服务器侧另有配置/并行修复）。
- **根因**：生产 `.env.production` 不设 `NEXT_PUBLIC_API_URL`，`API_BASE` 兜底为相对路径 `/api`；Node 的 fetch 不支持相对 URL，SSR 取数必然抛错，又被 `.catch(() => [])` 静默吞掉，服务端输出空列表。仓库里已有正确方案（`serverFetch.ts` 的 `API_INTERNAL_URL`）但大部分页面没用。
- **修复**：15 个文件统一修正——服务端取数兜底改为 `http://localhost:3002/api`（Next 与 Express 同机内网直连），浏览器端维持 `/api`；`publicApi.ts` 按 `typeof window` 区分同构场景。
- **额外教训**：验证线上抓取结果必须读完整个响应再下结论，只看开头 = 会把正常页面误诊成空页。
- **预防**：① 服务端组件取数一律走 `serverFetch.ts` 或带 `API_INTERNAL_URL` 兜底链，禁止裸 `|| '/api'`；② **禁止 `.catch(() => 空数组)` 静默吞错**，至少 `console.error`，否则 SSR 失败无人知晓；③ 上线后用 `curl <页面> | grep <真实数据关键词>` 验证 SSR 正文存在（不是只看浏览器）。

### FA-13 rsync 后端覆盖队友未拉取的提交（多人协作，2026-07-15）
- **现象**：给后台加「查看供应商」权限、部署时 `git push` 被拒（non-fast-forward）——origin/main 已被队友推了 10+ 提交（供应商后台中文名/tab/导出、materials hero 改版、版本号 0.1.22），且这些提交动的正是我改的同一批权限文件。更险：push 失败**之前**我已把 4 个后端 dist 文件 rsync 到生产，覆盖了队友已部署的版本。
- **根因**：部署前没先 `git fetch` 看远端是否领先；在本地落后 origin 10 个提交的状态下直接 rsync 后端到生产，覆盖了队友基于更新代码的 dist。幸而 `pm2 restart` 因 shell 变量展开报错没执行 → 生产进程仍跑队友内存中的代码，磁盘被污染但未加载 = 未爆。
- **修复**：① 立即 `git show origin/main:<file>` 提取队友版本 rsync 回生产，恢复被覆盖的 4 文件；② `git rebase origin/main`（**零冲突**，我的权限增量与队友改动在文件不同区域，git 3-way 自动合并）把功能叠到队友之上；③ 核实生产前端 HEAD 已是队友最新 `118d028c`（team 已部署）→ 我的部署只加 1 提交，安全；④ 合并后重跑 tsc/build/smoke 11/11 + 后端端到端（超管 200/无权限 403）全绿再部署。
- **预防**：① **部署前必先 `git fetch origin main` 并看 `git log --oneline HEAD..origin/main`**，远端领先就先 rebase 再动手，禁止在落后状态下 rsync 后端；② rsync 后端前用 `git merge-base --is-ancestor origin/main HEAD` 确认本地已含远端最新；③ 多人同仓库：**先 `git push`（分叉会被 non-fast-forward 拒绝）暴露远端领先，rebase 解决后再 rsync/部署——push 成功 = 安全门通过**，绝不在 push 之前 rsync 后端。已写进 `tarmeer-deploy-backend`。

## 归档模板（新事故追加到本文件末尾）

```
### FA-N 标题（日期）
- **现象**：用户看到了什么 / 什么功能失效
- **根因**：一句话说清为什么
- **修复**：做了什么
- **预防**：写进了哪份技能 / 新增了什么规则
```
