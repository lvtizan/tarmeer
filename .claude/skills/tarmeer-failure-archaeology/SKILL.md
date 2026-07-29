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

### FA-14 供应商去标识漏 name_zh + 遮蔽可见渲染 ≠ 遮蔽序列化 payload（2026-07-17）
- **现象**：给公开供应商做去标识（英文厂名遮成星号、地址/联系方式/logo 隐藏、可见标题改品类通用名 "System Windows Supplier"）并上线后，`curl 首页 | grep name_zh` 仍能读到 `"name_zh":"华盛家具"` 等**真实中文厂名**；这些字段虽不在页面上可见渲染，却躺在 Next.js RSC/Flight 序列化数据流（`self.__next_f`）和 `/api/suppliers` JSON 里，view-source 一眼可得。
- **根因**：两个叠加疏漏。① 去标识只处理了「显示名」`company_name`，漏了另一个身份字段 `name_zh`——`redactPublicSupplier` 没 null 它，`SELECT sp.*` 原样带出。② 误以为「前端不渲染星号名、改用品类名」就等于去标识完成；实际客户端组件收到的是**整个 supplier 对象**，Next 会把完整 props 序列化进 RSC payload，未被 null 的字段全部进页面源码。遮蔽发生在「render」层而非「数据出站」层 = 假去标识。
- **修复**：① `redactPublicSupplier` 增加 `name_zh: null`，并把简介里出现的中文名一并 `maskSupplierMentions`（英文名已遮）；② `supplierProjectController.getPublicProject` 补取 `name_zh`、项目标题/简介用中英文名双重遮蔽、`redactedSupplier` 置 `name_zh=null`；③ 前端首页供应商栏（`HomeSupplierSection`）与关于页（`AboutClient`）此前仍直接渲染星号 `company_name`/`description`——补成 `supplierPublicTitle(categories)` 品类名。单测 name_zh=null + 中英文名均从 description 遮蔽通过；生产 `/api/suppliers` name_zh 0/6、首页源码 0 残留。
- **预防**：① **去标识/脱敏必须在「数据出站」层做（controller 返回前的 redact 函数），列全部身份承载字段一次性 null/mask——不是只处理显示用的那一个**；同类身份字段清单：`company_name / name_zh / 任何 *_name / 联系方式 / 地址 / 坐标 / logo / user_*`。② **牢记 SSR 框架会把组件完整 props 序列化进页面源码（RSC/Flight、`__NEXT_DATA__`）**，"前端不渲染"不代表"数据不出站"；验证脱敏必须 `curl 页面源码 + /api 原始 JSON` grep 真实值，而非只看浏览器可见文本。③ 新增脱敏后按此法回归：`curl <页面> | grep <真实中英文名>` 应 0。已写进本条 + 与 tarmeer-country-isolation 的「显示层兜底」口径并列（一个防串国、一个防泄身份）。
### FA-15 供应商上传产品却不上站——可见性门槛只认 partner（2026-07-22）
- **现象**：广东福永发(id139)昨天上传 28 个产品(25 条 stone_materials)，admin 里 approved/published/Products=28，但公开供应商列表完全搜不到。
- **根因**：`listPublicSuppliers`(supplierProfileController.js) 的可见性门槛写成「有已发布案例(projects) **OR** (`source='partner'` **AND** 有产品)」。该供应商 `source='manual'`、案例数=0，两分支皆 false → 被整条排除。这是「供应商自助上传产品」功能上线后的迁移遗漏：门槛只为 partner 扇出的产品放行，没覆盖 manual/company 账号自己传的产品。
- **修复**：门槛改为「有已发布案例 **OR** 有任意产品」，去掉 `source='partner'` 限定（一处，SQL WHERE）。生产读复现：AE 56→59(+3 product-only 供应商)、139 现可见、VN 隔离仍为 2。
- **次要坑（未改，属数据/策展）**：分类筛选走的是 **档案级** `sp.categories`(JSON_CONTAINS)，与**产品级** `category` 是两套枚举(`stone` vs `stone_materials`)且不自动回填；档案 categories 为空 → 即使进了列表，勾选某分类仍不显示。要在分类下出现须由 admin 用 Categories 列「+Add」策展，不能靠产品分类自动映射。
- **预防**：① 新增「用户自助内容」功能时，务必同步检查**公开侧可见性门槛**是否只认旧来源(如 partner/manual/爬虫)，避免新来源内容被静默过滤；② admin 显示「有内容(Products=28)」不等于公开可见，两套判定条件要对齐；③ 档案 categories 与产品 category 是两套枚举，分类展示靠 admin 策展，别假设自动联动。

### FA-16 分类筛选下拉枚举与档案枚举错位——选任一品类都"No suppliers found"（2026-07-22）
- **现象**：/materials 选 Stone Contact 分类 → "No suppliers found"；福永发有 25 个 stone_materials 产品仍不出现（接 FA-15 之后仍看不到）。
- **根因**：**两套品类枚举错位**。分类下拉选项来自 `/api/suppliers/categories`（产品品类枚举，值如 `stone_materials`、label 被机翻成 "Stone Contact"），但 `listPublicSuppliers` 的筛选 SQL 只 `JSON_CONTAINS(sp.categories, ?)` 匹配**档案级** categories（旧枚举，值如 `stone`）。生产实测 `category=stone_materials`→0 家、`category=stone`→4 家。于是选任一新枚举选项几乎都空，只传产品无档案分类的供应商永远不匹配。
- **修复**：category 条件改为 `JSON_CONTAINS(sp.categories, ?) OR EXISTS(supplier_products WHERE category=?)`——命中档案分类或有对应品类产品二者取一即匹配。生产读复现 `stone_materials` 0→1，福永发现可在 Stone 下出现；smoke 12/12、price 9/9。
- **遗留（未修，属数据质量）**：品类 label 机翻污染——`石材`→"Stone Contact"、group `Stone, Tile & Flooring`→"tone,_tile_&_flooring"。翻译管线把权威枚举 label 译坏，需单独修 label 源。
- **预防**：① **下拉选项的取值域必须与筛选所匹配的字段取值域同源**——选项来自产品品类枚举，就必须能匹配到产品品类，不能只匹配另一套档案枚举；新增筛选器先确认"选项 value ↔ WHERE 字段 value"同一命名空间。② 验证筛选器不能只看"有结果"，要对**每个选项**抽查是否真能命中（本例 3 个月里没人发现选项几乎全空）。③ 品类 label 走机翻前要挡住权威枚举的 label（枚举 label 应是人工固定文案，不进翻译管线）。

### FA-15 sub_admin 后台绑定访谈公司搜索被 403，前端把错误吞成"无匹配公司"（2026-07-22）
- **现象**：sub_admin（kp99.cn 数据录入组）在后台「访谈详情 → 绑定公司」搜索一家**确实存在**的公司（`company_profiles` id=284 "Najm alriyah"，country=ae），却显示"无匹配公司"。
- **根因**：两层叠加。① 访谈列表/详情页对**所有 admin 角色**开放（`/api/admin/interviews` 注释就是 "all admins"），但公司搜索走的是 **field 路由** `/api/field/companies/search`，该路由被 `requireFieldOrSuperAdmin` 守卫——只放行 `super_admin`/`field_staff`，**sub_admin → 403**（实测 super/field→200，sub→403）。② 前端 `handleBindSearch` 的 `catch { setBindResults([]) }` 把 403/500/网络错误**一律吞成空结果**，渲染成"无匹配公司"，掩盖了真正的 403。用户看到的"搜索坏了"其实是权限被拒 + 错误被吞。
- **修复**：① `server/dist/routes/field.js` 把 `requireFieldOrSuperAdmin` 下移——公司搜索只需 `requireAdmin`（任意已登录 admin，含 sub_admin），`/interviews/:id/load`、`/re-submit` 仍保留在其后受限。国家隔离不变：非 super_admin 的 `staffCountry` 仍强制取本人 `admin_users.country`（`?country=` 只对 super 生效），sub_admin 只能搜到本国公司，不越权。**注：sub_admin 本就能经 `PATCH /api/admin/interviews/:id` 绑定公司，此处仅补齐"搜索"能力，非提权。** ② 前端新增 `bindError`，搜索失败显示"搜索失败，请重试"（红字）而非"无匹配公司"。③ 新增回归 `scripts/harness/field-search-access.mjs` 并接入 smoke-test `[3b]`，守护中间件挂载顺序（sub 搜索 200 / load 403 双向）。生产实测：sub_admin 搜 Najm→200 返回 id284；`?country=vn` 仍只返 ae 数据；load 仍 403。
- **预防**：① **同一功能被开放给某角色时，该功能依赖的每一个后端端点都要核对角色门禁是否一致**——不要"页面对所有 admin 开放，但底层 API 只放行部分角色"造成半残。改角色可见性/权限前用 Grep 找出该功能链路上的**所有**端点及其 `require*` 中间件。② **前端 `catch` 禁止把请求错误静默吞成"空/无数据"**——403/500/网络错误要与"真的没有数据"区分渲染，否则线上排障时"看起来没数据"其实是权限/接口坏了（本次就被误报成"搜索坏了"）。新增数据拉取一律：失败→显式错误态，空→空态。③ 中间件顺序改动必须加回归（`router.use` 只影响其**之后**注册的路由）。已并入 tarmeer-change-control 的"改权限先全链路 Grep"口径。

### FA-17 材料供应商/项目详情 SSR 页 VN 串到 AE 页——SSR 出站 fetch 不转发国家 + 后端项目端点缺 country 过滤（2026-07-29 改版合并 M6 抓出）

- **现象**：VN 站（`Host: vn.*`）访问 `/materials/suppliers/<ae-slug>` 与 `.../projects/<id>` 返回 **200 并渲染 AE 供应商/项目内容**（`<title>… in Vietnam</title>` 但正文是 AE 厂家简介），应为 404。违反国家隔离铁律第 8 条。
- **根因**：两层。① 前端 SSR：`suppliers/[slug]/page.tsx`、`projects/[projectId]/page.tsx` 的 `fetch(/suppliers/detail/…)` **没带国家**（中间件注入的 `x-country` 不会自动进 SSR 出站请求头），后端默认回落 `ae` → 拿到 AE 数据。对照 `products/[id]/page.tsx` 有显式 `if (c.code!=='ae') notFound()` 守卫所以不漏。② 后端：`supplierProjectController.js` 的 `getPublicProject`/`listPublicProjects` 按 slug 解析供应商时 `WHERE slug=? AND status='approved'` **缺 `AND country=?`**（供应商 `getPublicProfile` 有，项目端点漏了）——即使前端带了国家也命中错国家。
- **修复**：① 两个 SSR 页把国家传进 fetch：`?country=${c.code}`（入 Next Data Cache 缓存键，防跨国缓存污染）+ `headers:{'x-country':c.code}`；后端 detail 对错国家 slug 返 404 → 页面 `notFound()`。② 后端两个项目端点补 `reqCountry`(`?country=`|`req.country`|`ae`) + `AND country=?`，与 `getPublicProfile` 对齐。实测：ae→200 / vn→404，且既有 AE 数据不受影响。
- **预防**：① **任何 SSR 出站 fetch 命中"按国家隔离"的数据，必须显式带 `?country=`（入缓存键）+ `x-country` 头**——SSR 不继承入站头。新建材料/公司/专家类详情 SSR 页先照此模板。② **跨表按 slug/id 解析实体的每一个公开端点都要带 country 条件**——不能"列表端点隔离了、详情/子资源端点漏了"。改一处隔离逻辑先 Grep 出同实体的所有解析点统一补（AGENTS.md「修改前必须全量搜索」）。③ 详情页三选一防串域：SSR 转发国家 + 后端 country 过滤（本次）｜或页面 `c.code!=='ae' notFound()`（AE 专属页，如 products/[id]）——二者至少其一，禁裸 fetch。

### FA-18 Next.js Data Cache（`revalidate`）跨 dev 重启存活——修完代码本地仍复现旧 bug，误判"没修好"（2026-07-29）

- **现象**：修好 F4（VN 应 404）后，`kill` 并重启 `next dev`、甚至重启后端，本地 curl VN 页**仍返回 200 旧行为**；backend 直连却已正确 404。差点误判"前端改动没生效/代码还有 bug"。
- **根因**：页面 `fetch(..., { next: { revalidate: 3600 } })` 命中 Next **Data Cache**（落盘 `.next/cache/fetch-cache`）。我**在后端修复前**先请求过一次带新 URL（`?country=vn`）的页面，把当时后端返回的"错误 200"缓存了；该缓存**不随 `next dev` 进程重启失效**（只按 URL+options+revalidate 过期），所以重启 dev 照样吐旧值。`export const dynamic='force-dynamic'` 只控页面级渲染，**不使带显式 `revalidate` 的 fetch 跳过 Data Cache**。
- **修复**：`rm -rf .next`（或 `.next/cache`）后重启 dev → VN 立即 404。代码本无问题。
- **预防**：① **验证"按国家/参数隔离"的 SSR 修复时，改完必须 `rm -rf .next` 再起 dev**，否则 Data Cache 会拿改前请求的旧响应骗你。② 结果与预期不符时，**先 curl 后端直连（`:3002`）区分"前端缓存 vs 真实行为"**，再判方向——别急着怀疑代码（systematic-debugging：先取证再改）。③ 隔离类 SSR fetch 若不希望跨值缓存污染，国家/关键参数务必进 **URL 查询串**（入缓存键），只塞 header 不进 key 会串。

## 归档模板（新事故追加到本文件末尾）

```
### FA-N 标题（日期）
- **现象**：用户看到了什么 / 什么功能失效
- **根因**：一句话说清为什么
- **修复**：做了什么
- **预防**：写进了哪份技能 / 新增了什么规则
```
