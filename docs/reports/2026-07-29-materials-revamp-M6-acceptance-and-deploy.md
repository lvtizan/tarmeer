# 材料改版合并 · M6 验收报告 + 生产部署包（2026-07-29）

> 状态：**代码完成 + 已验收（REVAMP-SCOPE CLEAN）。未部署。** 生产切换等用户「部署」。
> 分支：前端 `integrate/materials-revamp`、后端 `backend/materials-public-endpoints`（均已 push origin）。

## 0. 一句话结论

test.tarmeer.com 的材料改版已合并成两条可上线分支并跑完 5 轮验收：AE 首页/材料区换成新叙事+MaterialsHub、旧首页保留在 `/classic`、VN 站逐字节保真、7 个公开材料端点去标识+国家隔离。**改版引入的问题全部修掉（F4 串域、C1 目录泄名）**；剩余 3 项是**先于改版就在 www 上的 de-id 引擎债**（F1/F2/F5），单独立票，不阻断本次前端改版上线。

## 1. 验收轮次与结论

| 轮 | 视角 | 结论 |
|----|------|------|
| R1（本人 curl 断言）| 后端数据+隔离+去标识 / 前端渲染+VN 保真+/classic 门禁 | 后端 10/10、前端 14/14 绿（2 个"失败"是断言串 bug：POST 201≠200、title `&amp;` 转义）|
| R2（fable5 完整性）| 112 路由 AE/VN 全扫、导航/Footer、i18n、SEO、MaterialsHub 填充 | **COMPLETE — 无功能缺失**；0 P0/P1；2 个 P2 均 main 既有 |
| R3（fable5 数据/去标识/表单）| 端点数据 + 详情页去标识 + 表单端到端 | 表单全绿；发现 F1–F5（4 P0 面 + 1 P1）|
| R4（fable5 复验+前科认定）| F4/maskArr 复验 + 逐条 pre-existence + 新扫 | F4/maskArr HOLD；F1/F2/F5 确认 pre-existing；**发现 C1（改版新引入）**|
| R5（fable5 终审）| C1/F4 复验 + 全绿 + 终扫 | **REVAMP-SCOPE CLEAN**；C1/F4 HOLD；7 端点 AE 非空/VN 隔离；无新发现 |

（R5 期间工作树临时切到后端分支，4 个 AE 专属前端路由未编译；已在切回后补验：`/materials/{flooring,new-materials,showroom,category/furniture}` 全 AE=200 / VN=404。）

## 2. 改版引入问题 —— 已修（阻断项，全部 fixed）

### F4 · VN 串到 AE 供应商/项目详情页（P0 国家隔离）
- 现象：`Host: vn.*` 访问 `/materials/suppliers/<ae-slug>`、`.../projects/<id>` 返 200 渲染 AE 内容。
- 根因：① 两个 SSR 页 fetch 不转发国家（SSR 不继承入站 x-country）② 后端 `supplierProjectController` 项目端点缺 `AND country=?`。
- 修复：前端 `integrate@945312d33`（`?country=`+`x-country` 头，入缓存键防跨国污染）+ 后端 `backend@3d0112b86`（项目端点补 country）。实测 ae=200/vn=404。归档 **FA-17**。

### C1 · 改版新产品页经未遮蔽目录端点泄真实厂名（P0 去标识）
- 现象：新 `/materials/products/[id]` → `fetchSupplierCatalogs` → 未遮蔽的 `/suppliers/detail/:slug/catalogs` → CatalogReader 可见渲染 "Huasheng 2024 Product Catalog"。
- 修复：后端 `backend@728273bfd` `listCatalogs` 补标题 `maskSupplierMentions`（含 name_zh）。实测标题变 `******** 2024 Product Catalog`。**注：生产版 `listCatalogs` 已有国家隔离（甚至含 is_published），部署只需补"标题遮蔽"这一处**（见 §4 部署矩阵）。

### maskArr · specs/certifications/application_scenes 去标识补齐（P0 面）
- 后端 `backend@ee5a5f0f0`：产品详情三数组字段字符串叶子也过 mask（R4 对抗注入验证：真名全变 `********`，正常规格值不损）。

## 3. 先于改版的 de-id 引擎债 —— 未修（不阻断，另立 P0 跟进票）

**这三项在**当前生产 www 上已存在**（改版不涉及、不加重，除 C1 已修的产品页目录标题）。修复需别名数据/基建，属独立工程，不塞进本次前端改版切换以免引新险。**

| 编号 | 泄漏面 | 根因 | 建议修法 |
|------|--------|------|---------|
| **F1** | 供应商简介（Organization JSON-LD + sr-only）含品牌别名"Suofeiya"、股票代码 002572 | `maskSupplierMentions` 只遮完整厂名+首个≥4字符品牌词，抓不到别名拼写（DB 里没有该拼写） | 建 `supplier_name_alias` 清单（人工录入索菲亚/Suofeiya/Sofeyia 等）；mask 扩展为"厂名所有≥4字符词元 + alias 清单" |
| **F2** | 目录 `file_url` 下载文件名含真名（`Huasheng-2024-Product-Catalog.pdf`）；供应商详情页 CatalogReader 与新产品页**共用** | file_url 是磁盘真实路径 | 加 proxy 下载路由 `GET /api/suppliers/catalog-file/:id`（带国家隔离 + Range 支持给 pdf.js）流式返回，响应头置通用文件名；listCatalogs 的 file_url 改写成该 proxy 路径 |
| **F5** | 产品标题/alt 含品牌词"JAIYI"（"Dongguan Jaiyi Electric Co., Ltd." 第二词） | 同 F1 首词遮蔽盲区（爬取数据） | 同 F1（词元级遮蔽 + alias） |

补充（R5 记录，均属既有债，不新增）：slug 本身含真名（`huasheng-furniture`，`redactPublicSupplier` 有意保留作公开 handle）、`/suppliers/search` 用原始 company_name 匹配（身份确认 oracle，但 slug 本就暴露）。若要彻底"公开零可推断真名"，需统一改 slug 策略（不透明 slug），属全站级独立课题。

## 4. 生产后端部署矩阵（⚠️ 关键：生产 tarmeer_api 已分叉，禁盲 rsync）

**排雷发现**：生产 `/tarmeer/tarmeer_api` 已有队友部署的**未合回 main** 的功能：① `addProduct/updateProduct` 支持 specs/certs/scenes 落库（供应商门户）② `supplierCatalogController` 有 PDF 光栅化（`catalogRasterizer` lib，本地 main 没有）+ 已带国家隔离 ③ 若干 raw（未去标识）的材料 controller（但路由未注册 = dormant，线上 `/suppliers/products/public` 现 404，未泄漏）。**盲 rsync 我的 main-based 分支会回退门户/光栅化功能（违反"后台不能乱动"）。**

| 文件 | 生产现状 | 部署动作 |
|------|---------|---------|
| `routes/sourcingRequests.js` | 缺 | **rsync**（新文件） |
| `controllers/sourcingRequestController.js` | 与我逐字节相同 | rsync（no-op）/ 跳过 |
| `lib/productJsonFields.js` | 相同 | rsync（no-op）/ 跳过 |
| `controllers/productCategoryController.js` | 7 个 admin 函数与我逐字节相同 | **rsync 安全**（我=生产7函数+`getPublicProductCategoryGroups` 真超集） |
| `controllers/supplierProductController.js` | 门户 specs 逻辑；raw 公开 feed | **rsync 安全**（分支已 reconcile：`backend@5e7792c67` graft 生产门户 specs + 我的 de-id feed = 超集，逐字节含生产门户逻辑） |
| `controllers/supplierProjectController.js` | =main（无 country） | **rsync 安全**（生产 vs 我 diff 仅 F4 country 行） |
| `controllers/materialsMacroController.js` | raw/dormant（路由未注册） | **rsync 安全**（我=生产全部函数+`maskTitle` 超集；覆盖即把 dormant raw 换成 de-id 版并随路由注册启用） |
| `app.js` | 大量队友改动 | **外科补丁生产版**（勿覆盖）：加 2 个 require + 2 个 mount（`sourcingRequests`、`/api/public/product-categories`）见 §5 |
| `routes/suppliers.js` | 队友路由 | **外科补丁生产版**（勿覆盖）：加 `materialsMacro` require + 注册 8 条路由（macro-categories、macro/:key/products、search、mega-menu、popular-products、products/public、products/public/:id），**静态路由须在 `/detail/:slug` 之前** |
| `controllers/supplierCatalogController.js` | 有光栅化+`catalogRasterizer` lib+国家隔离 | **外科补丁生产版**（勿覆盖，分支版缺 lib 会崩）：仅加"标题遮蔽"——① `const supplierRedact_1 = require("../lib/supplierRedact");` ② `listCatalogs` 的 profile SELECT 补 `company_name, name_zh`，返回前对每条 `title` 走 `maskSupplierMentions`（含 name_zh）。生产版已有 country 隔离，无需再加 |

> 参考实现见分支 `backend@728273bfd` 的 `supplierCatalogController.listCatalogs`（那是 main-base+C1，仅供抄"标题遮蔽"两处，**勿整文件 rsync**）。

## 5. 生产切换执行顺序（等用户「部署」后执行；务必按序、原子）

> 铁律：部署前 `git fetch origin main` 看远端是否领先（FA-13）；后端补丁必须**先 diff 生产版再补丁**（FA-7/分叉），**所有后端文件一次到位 + 单次 `pm2 restart`**（禁分步，否则先注册路由后旧 raw controller 会短暂裸奔泄名）。

### 5.1 合并分支到 main
```bash
cd /Users/kp/Code/tarmeer-4.0-local
git checkout main && git pull --ff-only
git merge --no-ff integrate/materials-revamp   # 前端（src/*，无 server 冲突）
git merge --no-ff backend/materials-public-endpoints  # 后端（server/dist/*）
git push origin main
```
（注：backend 分支的 `supplierCatalogController.js` 是 main-base+C1，合并进 main 后**不要**据此 rsync 生产该文件——按 §4 外科补丁。可考虑合并后把该文件恢复成生产超集或加 .deploy-ignore 注释，防误 rsync。）

### 5.2 前端上线（www）
```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
cd /tarmeer/tarmeer_web_next
git fetch origin main && git checkout -f origin/main   # detached-HEAD 安全(FA)
git rev-parse HEAD   # 必须 == origin/main
BID=$(cat .next/BUILD_ID); npm run build   # 必须 EXIT=0
[ "$(cat .next/BUILD_ID)" != "$BID" ] && echo "BUILD_ID changed OK" || echo "⚠️ 没变,重跑"
pm2 restart tarmeer-next
```

### 5.3 后端上线（www api）—— rsync 安全文件 + 外科补丁分叉文件
```bash
# A) rsync 安全的 7 个文件（逐个指定文件名，勿展平——AGENTS.md）
for f in routes/sourcingRequests.js controllers/sourcingRequestController.js lib/productJsonFields.js \
         controllers/productCategoryController.js controllers/supplierProductController.js \
         controllers/supplierProjectController.js controllers/materialsMacroController.js; do
  rsync -avz "server/dist/$f" -e "ssh -i ~/.ssh/tarmeer_ecs" "root@47.91.108.104:/tarmeer/tarmeer_api/dist/$f"
done
# B) 外科补丁 app.js / routes/suppliers.js / supplierCatalogController.js（SSH 上手改生产版，见 §4）
#    改前 cp 备份，改后 node --check
# C) 一次性重启
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "cd /tarmeer/tarmeer_api && node -e 0 && pm2 restart tarmeer-api"
```

### 5.4 验收（生产）
```bash
# 7 端点（务必带 x-country；products/public 现应从 404 变 200 且去标识）
curl -s --noproxy '*' -H 'x-country: ae' https://www.tarmeer.com/api/suppliers/macro-categories | head -c 200
curl -s --noproxy '*' -H 'x-country: ae' "https://www.tarmeer.com/api/suppliers/products/public?limit=3" | grep -o '"supplier_name":"[^"]*"' | head  # 应是品类通用名,无真名
# 去标识:任一真实厂名应 0 命中(去掉 slug/file_url)
# 国家隔离:x-country: vn 上述端点应空/404
# 页面:AE / 是材料新首页, /classic 200; VN / 是旧首页, /classic 404
# 供应商门户回归:登录供应商后台传产品带 specs → 应仍能存(证明 reconcile 没回退)
open https://www.tarmeer.com/ ; open https://www.tarmeer.com/materials
```

## 6. 待办（部署后 / 独立票）

- [ ] **P0 de-id 硬化票**：F1（别名清单+词元遮蔽）、F2（catalog proxy 下载路由）、F5（同 F1）——见 §3。
- [ ] 把生产已上线、未合回 main 的门户 specs 逻辑 + catalog 光栅化正式合回主干（消除 server-dist 分叉根源）。
- [ ] R2 记录的 VN `/materials` 既有 UAE 文案（"...in UAE"+🇦🇪 Dubai 筛选，main 硬编码）——国家文案隔离跟进。
- [ ] 部署后 `.next/BUILD_ID` 对比 + 浏览器实渲染验证（不只看 HTTP 200）。

## 附：本次所有提交
- 前端 `integrate/materials-revamp`：`945312d33`(F4)、`1003b7493`(FA-17/18 归档)、`a50b6b00c`(国家判定统一) + M0–M4。
- 后端 `backend/materials-public-endpoints`：`ee5a5f0f0`(maskArr)、`3d0112b86`(F4 项目)、`728273bfd`(C1 目录)、`5e7792c67`(门户 reconcile) + 端点。
