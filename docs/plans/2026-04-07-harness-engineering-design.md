# Tarmeer 4.0 Harness Engineering 体系设计

> 日期：2026-04-07
> 状态：待实施
> 背景：参考 OpenAI Harness Engineering 方法论，为 Tarmeer 4.0 建立 AI 驱动的开发、测试、发布全流程规范

## 目标

将所有隐性知识（脑子里的、聊天记录里的、踩坑经验里的）编码到 repo，让 AI agent 能直接从代码仓库推理出完整的业务领域和开发规范。核心原则：**agent 看不到的就不存在。**

## 一、现有文档评估

| 处理 | 文件 |
|---|---|
| **保留整合** (11个) | deploy-safety-workflow, deployment-troubleshooting, scraping-workflow, recrawl-runbook, unified-admin-panel (design+plan), 5个 test-cases |
| **归档** (4个) | oauth 三件套 (已完成)、project-image-fix (已解决) |
| **丢弃** (2个) | portfolio-enhancement design+plan (被 V4 取代) |

## 二、知识库结构

```
CLAUDE.md                    ← 目录 (~100行)，指向 docs/ 具体文档
ARCHITECTURE.md              ← 系统架构总览：前后端分层、域划分、依赖方向
docs/
├── design-docs/
│   ├── index.md             ← 设计文档目录
│   ├── core-beliefs.md      ← 核心开发理念（AI优先原则）
│   └── unified-admin-panel.md  ← 整合自现有文档
├── product-specs/
│   ├── index.md
│   ├── companies.md         ← 公司域：目录公司vs注册公司，合并规则
│   ├── homeowners.md        ← 业主域：浏览、询盘、角色切换
│   └── auth-roles.md        ← 角色系统：homeowner⇄company、admin
├── operations/
│   ├── deploy-runbook.md    ← 部署 checklist（前端+后端+DB+验证）
│   ├── deploy-troubleshooting.md  ← 整合自现有
│   ├── scraping-workflow.md       ← 保留
│   └── recrawl-runbook.md         ← 保留
├── testing/
│   ├── index.md             ← 测试策略总览
│   ├── auth-profile.md      ← 整合自现有
│   ├── full-site.md         ← 整合自现有
│   ├── staging-flows.md     ← 整合自现有
│   └── site-config.md       ← 整合自现有
├── references/
│   ├── cors-domains.md      ← 当前CORS白名单+新增流程
│   ├── nginx-configs.md     ← 所有域名Nginx配置备份+说明
│   └── image-pipeline.md    ← 图片质量管道5层过滤规则
├── incident-log/
│   ├── 2026-04-07-cors-company-list.md  ← CORS+排序事故复盘
│   └── 2026-04-03-base64-image-fix.md   ← 整合自现有
├── archive/                 ← 已完成的设计/计划
│   └── oauth-2025/
├── DESIGN.md                ← UI设计规范（从CLAUDE.md迁出）
├── FRONTEND.md              ← 前端约定：组件使用、Tailwind规则
├── RELIABILITY.md           ← 数据源合并规则、CORS安全、部署不变量
├── SECURITY.md              ← 反爬虫、限流、CORS策略
└── QUALITY.md               ← 代码质量标准、技术债追踪
```

## 三、CLAUDE.md 重新定位

从"百科全书"变为"目录"（约100行），只保留关键指引：

```markdown
# Tarmeer 4.0 — Agent Guide

## Quick Nav
- Architecture: → ARCHITECTURE.md
- UI/Design rules: → docs/DESIGN.md
- Frontend conventions: → docs/FRONTEND.md
- Reliability invariants: → docs/RELIABILITY.md
- Security policies: → docs/SECURITY.md
- Deploy checklist: → docs/operations/deploy-runbook.md
- Test cases: → docs/testing/index.md

## Critical Rules (never skip)
1. Deploy: MUST read deploy-runbook.md before ANY deploy
2. Data merge: directory companies BEFORE approved (→ RELIABILITY.md)
3. New subdomain: MUST update CORS whitelist (→ SECURITY.md)
4. Images: NEVER base64 in DB (→ RELIABILITY.md)
```

## 四、ARCHITECTURE.md

```
┌─────────────────────────────────────────────────┐
│                   Nginx (SSL)                    │
│  www.tarmeer.com / admin.tarmeer.com             │
├────────────────────┬────────────────────────────┤
│    Frontend (Vite) │     Backend (Express)       │
│    /dist → static  │     :3002 → /api/*          │
├────────────────────┼────────────────────────────┤
│  Pages             │  Routes → Controllers       │
│  Components        │  Services / Lib              │
│  Contexts          │  Middleware (auth/CORS/rate)  │
│  Lib (utils)       │  Config                      │
├────────────────────┴────────────────────────────┤
│              MySQL (Aliyun RDS)                   │
└─────────────────────────────────────────────────┘
```

### 业务域

| 域 | 说明 |
|---|---|
| **Companies** | 核心域。目录公司（爬取）+ 注册公司（设计工作室/装修公司），列表/详情/portfolio/项目管理 |
| **Homeowners** | 业主端。浏览公司、发送询盘、管理装修需求、可切换角色为公司 |
| **Auth** | OAuth + 密码登录、角色系统（homeowner⇄company、admin）、角色切换 |
| **Admin** | 管理后台：公司审核、用户管理、数据统计、站点配置 |
| **Home/Marketing** | 首页、落地页、搜索入口 |
| **Shared/UI** | 通用组件、图片处理、CORS/限流、工具函数 |

### 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Express + TypeScript + MySQL (mysql2)
- 认证：Passport.js (Google/Facebook OAuth) + JWT
- 部署：Aliyun ECS + Nginx + PM2
- 数据库：Aliyun RDS MySQL

## 五、关键不变量

编码到 `docs/RELIABILITY.md`，从踩坑经验提炼：

| 不变量 | 来源 | 强制方式 |
|---|---|---|
| 数据源合并：有图片的排前面 | 2026-04-07 事故 | 代码注释 + 测试 |
| 新子域名必须同步 CORS | 2026-04-07 事故 | deploy checklist |
| Nginx 必须显式处理裸域名 | 2026-04-07 事故 | nginx config 注释 |
| 图片禁止 base64 存 DB | 2026-04-03 事故 | 运行时校验 |
| 部署前后端必须匹配 | 多次经验 | deploy-runbook |
| NotificationBell 仅 admin 可见 | 2026-04-07 修复 | 代码条件渲染 |

## 六、开发工作流

```
需求
 ↓
设计文档 (docs/design-docs/)
 ↓
实现 (branch)
 ↓
测试 (docs/testing/ 相关用例全跑一遍)
 ↓
审查 (diff review)
 ↓
部署 (deploy-runbook.md checklist 逐项检查)
 ↓
验证 (线上冒烟测试)
 ↓
事故? → incident-log/ 复盘 → 更新 RELIABILITY.md
```

### 开发规范

1. **设计先行**：任何非 trivial 改动必须先写设计文档或在现有文档中记录变更理由
2. **避免重复犯错**：每次事故后，根因和修复编码到 RELIABILITY.md 或 SECURITY.md，不依赖记忆
3. **踩坑自动积累**：incident-log/ 记录每次生产事故，提炼出的规则写入不变量表
4. **代码仓库是唯一真相**：所有决策、约束、架构信息必须在 repo 内，不存在于聊天记录或脑子里

## 七、设计规范 (docs/DESIGN.md)

从现有 CLAUDE.md 迁出 UI/CSS 规则，扩展为完整设计规范：

- 色彩系统：CSS 变量定义（primary=#b8864a, text=#2c2c2c, muted=#6b6b6b, bg=#faf9f7）
- 排版：页面标题 text-xl、正文 text-[15px]、标签 text-sm
- 组件规范：按钮 btn-primary、输入框样式、卡片、标签、状态横幅
- 圆角：所有交互元素 rounded-2xl (20px)
- 对比度：正文 AAA (7:1+)、辅助文本 AA (4.5:1+)
- 一致性要求：禁止局部 inputClass 常量、禁止主题外颜色、焦点状态统一用 ring-[#B8864A]/15

## 八、测试流程

### 测试策略

- **改了哪个域，跑那个域的测试用例**
- **部署前必须跑 `docs/testing/full-site.md` 冒烟测试**
- **测试用例随功能迭代持续更新**

### 测试用例矩阵

| 域 | 测试文件 | 覆盖内容 |
|---|---|---|
| Auth | testing/auth-profile.md | 注册、OAuth、登录、头像、角色升级、权限 |
| Full Site | testing/full-site.md | 匿名/业主/公司/管理员全角色流程，50+ 用例 |
| Staging | testing/staging-flows.md | 邮件注册、OAuth、公司档案、portfolio上传 |
| Site Config | testing/site-config.md | 固定业务配置（地址、地图、WhatsApp、Instagram） |

### 上线前检查

1. 相关域测试用例全部通过
2. full-site.md 冒烟测试通过
3. deploy-runbook.md checklist 逐项完成
4. 线上验证：首页 200、API health、图片访问、新功能验证

## 九、部署流程 (docs/operations/deploy-runbook.md)

### 部署前检查清单

- [ ] 前端改动? → `vite build` + rsync dist/
- [ ] 后端改动? → `tsc` + tar + rsync + pm2 restart
- [ ] 数据库变更? → 先在 RDS 执行 migration SQL
- [ ] 新子域名? → 更新 CORS 白名单 + Nginx config
- [ ] 新 API? → 后端先部署，再部署前端
- [ ] 图片变更? → rsync images + 检查权限

### 部署后验证

- [ ] 首页 HTTP 200
- [ ] API /health 正常
- [ ] 图片访问正常
- [ ] 新功能验证
- [ ] 控制台无报错

## 十、安全策略 (docs/SECURITY.md)

- **CORS 白名单**：www.tarmeer.com, tarmeer.com, designer.tarmeer.com, admin.tarmeer.com
- **新增域名流程**：修改 corsOrigins.ts → 部署后端 → 验证
- **反爬虫**：UA 黑名单 + IP 限流 (60/min) + 5分钟封禁
- **管理员登录**：IP 限流 (5次/15min)
- **图片安全**：禁止 base64 存 DB、上传压缩 (>300KB 自动压缩)、最大 20MB

## 十一、实施计划

### Phase 1：骨架搭建
- 创建目录结构
- 重写 CLAUDE.md 为目录
- 创建 ARCHITECTURE.md
- 创建 docs/RELIABILITY.md、SECURITY.md、DESIGN.md、FRONTEND.md、QUALITY.md

### Phase 2：文档迁移
- 现有文档搬到新位置
- 归档已完成文档
- 删除被取代的文档
- 创建 incident-log/ 复盘记录

### Phase 3：规范落地
- 创建 deploy-runbook.md
- 整理测试用例到 testing/
- 创建 product-specs/ 业务域文档
- 创建 references/ 技术参考

### Phase 4：验证
- 本地全量测试
- 确认 CLAUDE.md 目录链接全部有效
- 提交到 repo
