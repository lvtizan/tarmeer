# Tarmeer App 准备 & API 改造方案

> 状态：方案稿（待评审）· 日期：2026-06-24
> 目标：在开发原生 App 之前，先把"业务理解 + 后端契约"打好底，避免在 Web 紧耦合的 API 上直接长 App。
> 范围：单 App 装三类角色（C 端业主 + B 端装企/专家/供应商，外勤为后续阶段）。

---

## 0. 一句话结论

**App 开发 80% 的准备工作在后端，不在 App 本身。** 当前 API 是贴着 Web（子域名分国家 + Next middleware 注入 header + cookie/JSON）长出来的，App 直接用会在「国家归属、认证续期、图片上传、版本兼容」四处踩坑。本方案先冻结一套 App-ready 的 API 契约（阶段 0），再分阶段交付 App。

---

## 1. 业务模式（已与产品方确认，作为本方案前提）

平台 = **阿联酋(AE) + 越南(VN) 的室内设计 / 装修 / 建材撮合平台**。一个站点（子域名分国家）、一套 Express API、一个 MySQL。

### 1.1 角色 / 账号体系
| 角色 | 账号表 | 资料表 | 备注 |
|---|---|---|---|
| 业主 homeowner | `users` | — | C 端，浏览 + 发询盘 |
| 装企 company | `users`(role=company) | `company_profiles` | 自注册公司 |
| 专家 expert | `users`(role=expert) | `expert_profiles` | **个人**持证者，区别于公司 |
| 供应商 supplier | `supplier_users`（独立） | `supplier_profiles` | 建材商，账号体系**完全隔离** |
| 外勤 field_staff | `admin_users`(role=field_staff) | — | 上门调研，按国家隔离 |
| 管理员 admin | `admin_users` | — | 后台 |

- **多门户已有基建**：一个邮箱可同时是 业主+装企+专家（共用 `users`），`getLinkedPortals` + `crossPortalToken` 不重登换门户。`supplier_users` 与 `users` 互斥。
- **装企两种来源**：`uae_companies`（爬虫目录，无主）vs `company_profiles`（自注册）；admin 通过 merge 关联认领（`linked_uae_company_id` ↔ `owner_user_id`）。

### 1.2 变现模式（双轮）
1. **商家付费**：`is_certified`（认证徽章，线下收费）+ `is_signed`（签约金牌，`weight_score += 500` → 排名靠前）。
2. **CRM 卖线索**：业主询盘 / 装企应聘线索异步推送到 CRM（双租户：线索租户 + 应聘租户），CRM 侧跟进并计费。
3. **电话点击（phone_reveals）= 需求热度统计**，非计费点；详情页电话默认遮罩，点击出全号并去重计数，给运营/商家看热度。

> 排序权重 `weight_score = 50 + 作品×10 + 文章×10 + 签约500`（`server/dist/lib/weightCalculator.js`）。

### 1.3 子业务 & AE/VN 差异
| 功能 | AE | VN | 备注 |
|---|---|---|---|
| 装企 / 专家 / 外勤 / 博客 | ✓ | ✓ | 共享表，按 `country` 隔离 |
| 建材供应商 Materials | ✓ | ✗ | `supplier_profiles` 无 country 字段，AE 专属 |
| Guide 指南 / 服务×城市落地页 | ✓ | ✗ | SEO 内容，VN 走 404 |
| 专家电话显示 | 显示 | 默认隐藏 | 设计规则 |

**国家隔离是 P0 铁律**：跨表引用成对存 `(ref_id, ref_source)`；所有 JOIN 带国家一致性条件；所有列表/统计/搜索接口接受并应用 `country`；任何 A 国视图出现 B 国内容 = P0。

---

## 2. App 产品模型（单 App 多角色）

与 Web 架构同构：匿名公开层 + 登录后按角色解锁。

```
匿名层（所有人，无需登录）
  └ 浏览公司 / 作品 / 专家 / 建材（C 端）+ 发询盘 / 查看电话
        │ 登录（统一入口，自动识别账号类型）
        ▼
  getLinkedPortals → 当前邮箱可进的门户
  ├ 业主    → 我的询盘 / 收藏
  ├ 装企    → 我的线索 / 询盘 / 资料 / 作品 / 认证状态
  ├ 专家    → 我的留言 / 简历 / 项目 / 认证状态
  ├ 供应商  → 产品 / 目录 / 线索
  └ 外勤    → 现场调研（阶段 4）
        ↕ App 内门户切换 = crossPortalToken（已现成）
```

**MVP 范围（已确认）**：C 端浏览/联系 + B 端商家（装企/专家/供应商）。外勤 = 后续阶段。

---

## 3. 后端现状评估（基于代码实查）

### ✅ 已具备（可直接复用）
- **JWT 鉴权**，token 在响应 body 返回（App 友好）：`userAuthController.js` 各 `jwt.sign(..., {expiresIn:'7d'})`。
- **多门户切换**：`getLinkedPortals` / `crossPortalToken`（`userAuthController.js:671-745`）。
- **统一登录雏形**：登录返回 `accountType`（user/supplier 等）。
- **multipart 上传**（部分接口）：`routes/admin.js` 用 multer memoryStorage。
- **国家参数**：`companies` / `portfolio` / `articles` 等已支持按 country 过滤（本周刚统一收口了一批）。
- **通知系统**：站内通知 + analytics 事件（可扩展成推送）。
- **反爬中间件** `antiScraping`（可扩展成 App 限流）。

### ⚠️ 缺口（App 上线前必须补）
| 缺口 | 现状 | App 影响 |
|---|---|---|
| **API 无版本前缀** | 直接 `/api/...` | App 发版后 Web 改 API 会打挂老版本 App |
| **国家参数读法不统一** | 有的读 `?country=`，有的读 `x-country` header，有的兜底 `ae` | App 无子域名，必须每请求显式带国家；读法不一会串国家（P0 隐患） |
| **JWT 无 refresh** | 7 天硬过期 | App 用户每周被踢下线 |
| **图片上传混用 base64** | 项目图 `readAsDataURL` 塞 JSON（`src/app/admin/.../projects/[projectId]/page.tsx`） | 外勤/商家现场拍高清照走 base64 会爆请求体、慢、费流量 |
| **无 OpenAPI 文档** | 无 | App 端联调靠猜，类型不同步 |
| **CORS 仅面向 Web 源** | — | 原生 App 来源需放开 + 按设备限流 |
| **无推送基建** | 仅站内通知 | App 收不到线索/询盘实时提醒 |

---

## 4. 阶段 0：后端地基（关键路径，先做，且同时利好 Web）

> 原则：每条都先在**新增层**做，尽量不破坏现有 Web 行为；高风险项灰度。

### 4.1 API 版本化 `/api/v1`
- 新增 `/api/v1/*` 路由命名空间，App 只用 v1；现有 `/api/*` 维持给 Web（或并行别名），逐步收敛。
- v1 冻结契约：统一响应包络（`{ data, error, meta }`）、统一错误码、统一分页结构。
- **Web 影响**：低（新增层，老路由不动）。

### 4.2 国家参数标准化（最关键，P0 收口）
- 统一约定：**所有公共/业务接口一律读 `X-Country` header**（App 启动按用户选择/IP 设一次，全局带上）；`?country=` 作为兼容回退。
- 后端加一个统一中间件：`req.country = header(X-Country) || query.country || 'ae'`，**所有控制器只读 `req.country`**，禁止各自兜底。
- 配套：把本周排查出的"读法不一"的接口全部对齐（延续 country-walkthrough 回归用例，新增 App-header 场景）。
- **Web 影响**：中（要全量核对接口读法），但能彻底消除国家串桶隐患。

### 4.3 鉴权加 refresh token
- access token 短期（如 30 分钟）+ refresh token 长期（如 30 天，可吊销）。
- App 端 access 存内存、refresh 存安全区（iOS Keychain / Android Keystore）。
- 新增 `POST /api/v1/auth/refresh`、登出吊销。
- **Web 影响**：低（Web 可继续用现有 7 天 token 或一并升级）。

### 4.4 图片/文件上传改造
- 提供正规 **multipart 上传**或 **OSS 预签名直传**接口（现场照直传 OSS，回存 URL，不走 base64）。
- 统一图片处理（缩略图/多档 webp，复用现有 `gen-image-variants` 思路）。
- **Web 影响**：中（项目图编辑页可顺带从 base64 迁到 multipart）。

### 4.5 统一登录 + 角色解析
- `POST /api/v1/auth/login`：一个入口，自动判断账号在 users / supplier_users / admin_users，返回 token + `accountType` + `linkedPortals`。
- App 据此渲染对应角色首页；门户切换复用 `crossPortalToken`。
- **Web 影响**：低（基于现有 getLinkedPortals 封装）。

### 4.6 OpenAPI 文档 + 推送基建
- 出 Swagger/OpenAPI（App 端自动生成类型）。
- 推送：FCM（安卓）+ APNs（iOS），把现有"新线索/新询盘"通知接到推送通道；设备 token 注册表。

---

## 5. 共享代码架构（让 App 和 Web 不打架）

- **抽共享包（建议 monorepo）**：把 `types.ts`、API client、`src/lib/country.ts` 国家配置、i18n 文案抽成共享模块，App 与 Web 共用。
- **国家隔离规则在 App 里同样是铁律** —— 共用一套 country 配置 + 统一 `X-Country` 注入，才不会重蹈本周隔离 bug。
- 技术栈建议 **React Native（Expo）**：全栈 TS/React，可复用类型与校验逻辑，比 Flutter/原生省事；Expo 便于内测分发（外勤阶段尤其方便）。

---

## 6. 分阶段交付路线

| 阶段 | 内容 | 依赖 | 价值 |
|---|---|---|---|
| **0 后端地基** | /v1 + X-Country 统一 + refresh + 上传 + 统一登录 + OpenAPI + 推送 | — | App 一切的前提，且利好 Web |
| **1 C 端浏览** | App 公开层：公司/作品/专家/建材浏览 + 详情 + 电话点击 + 发询盘（无登录） | 0 | 最低风险，验证 RN/Expo 栈 + 接口联调 |
| **2 登录 + 业主** | 统一登录 + 我的询盘/收藏 + 门户切换 | 1 | 打通账号体系 |
| **3 B 端商家** | 装企/专家/供应商 dashboard：线索/询盘、资料/作品管理、认证状态、**推送** | 2 | 直接服务付费方（变现侧） |
| **4 外勤** | 现场调研：相机/定位/离线录入/问卷（`survey_schema` 动态） | 0,3 | 内部工具，可走内测分发不过审 |

> MVP = 阶段 1 + 2 + 3（C 端 + B 端）。阶段 0 是其前置。

---

## 7. 行政 / 运维准备（有审核滞后，尽早办）

- [ ] **Apple Developer 账号**（$99/年，公司主体邓白氏认证常拖 1–2 周）
- [ ] **Google Play 账号**（$25 一次性）
- [ ] **推送**：FCM 项目 + APNs 证书/密钥
- [ ] **崩溃/分析**：Sentry + 事件埋点
- [ ] **深度链接 / Universal Links**：App 路由 ↔ tarmeer.com / vn.tarmeer.com URL 映射
- [ ] **OSS**：现场照存储桶 + 预签名上传策略
- [ ] **App 内强制升级**：版本检查接口（配合 /v1 弃用策略）

---

## 8. 风险 & 待决策

| 项 | 风险/问题 | 待决策 |
|---|---|---|
| 国家选择 | App 无子域名，用户首启如何定国家？ | IP 自动判 + 手动可切？默认 AE？ |
| 供应商 AE 专属 | VN App 是否隐藏 Materials 入口？ | 按 country 裁剪 App 导航 |
| 专家电话 | VN 默认隐藏规则要在 App 复刻 | App 端按 country 控制显隐 |
| Monorepo 迁移 | 现有 Web 仓库要不要改造成 monorepo | 评估成本 vs 收益（也可先建独立共享 npm 包） |
| /v1 双轨期 | Web 何时从 /api 迁到 /v1 | 先并行，App 上线后逐步收敛 |

---

## 9. 本阶段不做 / 范围外

- 不重写现有 Web；阶段 0 以**新增层 + 对齐**为主，不动既有页面行为。
- 不一上来做外勤（放阶段 4，独立内测分发）。
- 不引入新后端语言/框架（继续 Express + MySQL）。

---

## 10. 建议的第一步

阶段 0 里**性价比最高、且立刻利好 Web** 的两条先做：
1. **国家参数 `X-Country` 统一**（彻底收口本周的隔离问题，App/Web 都受益）
2. **`/api/v1` 骨架 + 统一响应包络**（为后续所有 App 接口立规矩）

二者风险低、不破坏现有功能，可作为本方案落地的起点。其余阶段 0 项（refresh / 上传 / 推送）随 App 阶段 1–3 推进时按需补齐。
