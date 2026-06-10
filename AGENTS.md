<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 开发工作流 — 每次动手前必查

### 第一步：确认数据库环境

运行任何操作数据库的脚本前，先看 `server/.env` 的 `DB_HOST`：

- `DB_HOST=localhost` → 连本地 MySQL，**生产库不受影响**
- `DB_HOST=rm-eb3t6y5093m91i2wzqo...` → 连生产 RDS

**规则：凡是要改生产数据，必须 SSH 到服务器，用服务器上的 `/tarmeer/tarmeer_api/.env` 执行。本地脚本只做本地开发。**

### 第二步：确认部署路径

| 操作 | 正确命令 |
|------|---------|
| 前端代码上线 | `git push` → SSH: `git pull && next build && pm2 restart tarmeer-next` |
| 静态图片上线 | `rsync -avz public/images/vn-companies/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/vn-companies/` |
| 后端代码上线 | 见下方后端部署规则 |

`deploy-simple.sh` 已废弃（部署到旧 Vite 目录），**不要用它部署前端代码**。

**后端部署规则（凡改 `server/dist/` 下任何文件，必须同步到生产）：**

`deploy-backend-ecs.sh` 需要完整 `server/package.json`，本地不满足条件，**改用 rsync 增量同步**：

```bash
# ⚠️ 多文件 rsync 必须分开写，目标路径必须指定到文件名
# 原因：rsync 多文件时会把所有文件展平到目标目录根，导致路径错误
rsync -avz server/dist/controllers/fieldAdminController.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/controllers/fieldAdminController.js

rsync -avz server/dist/routes/admin.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/routes/admin.js

# 同步完必须重启后端
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

批量同步所有 dist 文件：
```bash
rsync -avz server/dist/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

**判断标准：改了 `server/dist/` = 必须 rsync 后端 + pm2 restart tarmeer-api。改了 `src/` = 只需前端部署。两者都改 = 先后端后前端。**

### 第三步：新增 VN 公司图片后必须 rsync

爬虫入库结束后，图片在本地 `public/images/vn-companies/`，**必须手动 rsync 到服务器才能在线上显示**：

```bash
rsync -avz public/images/vn-companies/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/vn-companies/
```

### 第四步：新建子域名必须检查 nginx 配置

新建任何子域名的 nginx server block，必须包含以下三块，缺一会导致已知 404：

```nginx
# 静态图片（与 www.tarmeer.com 共用）
location ^~ /images/ {
    alias /tarmeer/tarmeer_web_portal/images/;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}

# API 上传文件
location ^~ /uploads/ {
    alias /tarmeer/tarmeer_api/public/uploads/;
    expires 30d;
}

# 后端 API
location ^~ /api/ {
    proxy_pass http://localhost:3002/api/;
    ...
}
```

### 第五步：图片过滤脚本使用规范

`scripts/filter-portfolio-images.js` 需要本地图片文件 + `sharp`，只能在本地运行。但改的是本地 DB（`DB_HOST=localhost`），生产库不变。

如需清理生产库中失效的图片引用，在服务器上运行专用脚本：

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
node /tmp/purge-vn-missing.js   # 删除文件不存在的图片引用
```

### 修改前必须：全量搜索所有相关位置，统一修正

**凡是要修改某个逻辑（字段同步、格式化、校验、状态变更等），必须先用 Grep 搜索整个 `server/dist/` 和 `src/` 中所有涉及该逻辑的位置，再统一修正，不得只改一处。**

例：修 `partnerSync` 缺少 phone → 须同时找到所有调用 `UPDATE company_profiles` 的地方，逐一判断是否需要补 partnerSync。

---

### 第六步：做完必须建用例自检，全部绿灯才能通知用户（不得跳过）

**铁律：每次写完代码 → 为本次改动建/补用例 → 自测全绿 → 才能告知用户"完成"。报告里必须附测试结果（如 14/14 PASS）。**

按改动类型执行（可叠加）：

| 改动类型 | 必跑 |
|---------|------|
| 任何代码改动 | `node scripts/harness/smoke-test.mjs`（tsc + 路由 + 前端可达） |
| 国家相关 / 用户侧写入口 / admin 过滤 | `node scripts/harness/country-walkthrough.mjs`（14 用例） |
| 新功能 / 新行为 | **必须为新行为追加用例**（walkthrough 加 UC，或 smoke-test 加路由，或新建脚本），不允许只靠手测 |
| 要部署的前端改动 | 本地 `node_modules/.bin/next build` 验证 exit=0（防止线上 build 失败） |

注意事项：
- walkthrough 含注册接口，**同一后端进程连跑两次会被限流 429** → 跑之前先重启本地后端
- 本地跑过 `next build` 后会覆盖 `.next`，**必须重启 5180 dev server**
- 用例自检 = 模拟真实用户路径（写入 → 按预期视图查询断言），不是只 curl 一下 200

**任何一项失败 / 任何新行为没有用例 = 不能声称"完成"。**

---

### 第七步：问题复盘机制（每次修完 bug/失误后必做）

**凡是在生产上出现的问题、踩过的坑、遗漏的步骤，修完之后必须立即归档，不得只修不记。**

归档位置按问题类型分：

| 问题类型 | 归档位置 |
|---------|---------|
| 部署/发布流程疏漏 | 更新本文件（AGENTS.md）对应步骤 |
| 代码 bug、组件误用 | `memory/pitfalls.md` |
| 后端 API / DB 问题 | `memory/backend-patterns.md` |
| UI / 样式问题 | `memory/ui-patterns.md` |
| 部署/服务器操作 | `memory/deployment.md` |

归档格式（追加到对应文件末尾）：

```
## [日期] [标题]
- **现象**：用户看到了什么 / 什么功能失效
- **根因**：一句话说清为什么
- **修复**：做了什么
- **预防规则**：下次开发前必须做什么（写进 checklist 或这里）
```

**不归档 = 没修完。** 这是工作流的最后一步，不能省略。

---

## VN Footer Contact Rules（锁定，不得修改）

改 `src/components/Footer.tsx` 时，VN 站（`lang === 'vi'`）底部联系方式块必须：

1. 显示 **两个** 号码（来自 `VN_WHATSAPP_NUMBERS`）：+84 886 770 218 和 +84 888 175 938
2. 标签格式：`Zalo / WhatsApp: {号码}`（不得简化为只写 WhatsApp）
3. 两个号码缺一不可

**违反以上任何一条 = 必须还原。**

---

## 国家数据隔离规则（铁律，违反 = 必须返工）

AE / VN / SA 三个国家的数据**严禁串联**（数据混桶）和**文字窜联**（A 国视图出现 B 国语言的公司名/内容）。

1. **跨表引用必须成对存储 `(ref_id, ref_source)`**，禁止只存 id 靠默认值猜表。
   反面教材（2026-06-10）：问卷 saveDraft 对缺失的 `company_ref_source` 默认 `'uae'`，实际引用的是 company_profiles；VN 公司导入 uae_companies 后占用了相同 ID 区间，阿联酋访谈记录立刻冒出越南公司名。
2. **任何解析公司引用的 JOIN 必须带国家一致性条件**，如 `AND uc.country = ci.country`。即使数据錯了，错国家的文字也不允许漏出来（显示层兜底）。
3. **所有列表 / 统计 / 导出 / 搜索接口必须接受并应用 `country` 参数**；admin 页面必须从 `useAdminCountry()` 取 country 传给每一个请求，并在 country 变化时重置分页/缓存。
4. **所有用户侧写入口落库时必须确定国家归属**，机制总表见 `docs/testing/country-bucketing.md`（phone 前缀 / country 字段 / slug / page_path）。
5. **外勤/问卷场景按操作人所属国家（`admin_users.country`）过滤公司搜索**，从源头禁止跨国家关联。
6. **任何 AE 视图出现越南文（或反之）= P0 bug**，第一时间排查引用解析链（ref_source → JOIN → country 条件）。
7. **新增/修改写入口或国家相关查询后，必须跑 `node scripts/harness/country-walkthrough.mjs` 且全绿**（12 个国家归属用例）。

---

## Field Survey Rules

**NEVER hardcode the survey schema (section titles, field keys, field labels, or options)** in any frontend file — not in the survey page, not in the admin visit-records detail view, nowhere.

The canonical schema lives in the `survey_schema` DB table and is served by `GET /api/field/survey-schema`. All components that render survey data MUST fetch from this endpoint and fall back to a minimal default only when the API returns null.

Rationale: hardcoded schemas cause silent data loss — fields added to the DB schema are never shown in the admin view, and filled answers go invisible without any error.
