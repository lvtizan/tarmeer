# Tarmeer 4.0 — 2026年4月工作月报

**统计周期**：2026-04-01 ~ 2026-04-30
**版本区间**：v5.10.9 → v5.12.0
**计划文档**：27 份（含 design + impl，合计约 55,000 行规格）
**Harness 测试脚本**：39 个（全套通过）
**主要交付模块**：12 个

---

## 一、模块交付概览

| 模块 | 周期 | 核心成果 | 新增代码量 |
|------|------|---------|---------|
| Admin 后台重构 | 4.07 | 询盘批删/审计/回收站/案例CRUD | ~1,500 行 |
| Harness 自动化强制层 | 4.07 | 全局 hook 拦截 + lint 门禁 | ~700 行 |
| GEO 优化 / AI 搜索引擎适配 | 4.10 | 预渲染服务 + JSON-LD + FAQ + Sitemap | ~1,300 行 |
| AI 图片自动标签 | 4.10 | Gemini Vision 上传即打标、14 类分类 | ~470 行 |
| 阿拉伯语 i18n | 4.13 | 全站语言切换 + Azure 动态翻译 | ~600 行 |
| 装企入驻 Wizard | 4.14 | 三步引导，强制上传项目才进 Dashboard | ~250 行 |
| Admin 数据分析合并 | 4.20 | 4 页合 1，Recharts 图表，操作记录 | ~470 行 |
| 供应商系统 | 4.21–4.29 | 独立入驻+公开展示+数据爬取449条 | ~2,800 行 |
| 装企服务分类扩展 | 4.28 | 新增 11 类装企类型 + 11 服务标签 | ~380 行 |
| 外勤访谈系统 | 4.29 | 新 DB + 角色 + 移动端表单 + Admin 管理 | ~800 行 |
| 装企项目审核流程 | 4.30 | 拒绝模板 API + 单项目审核按钮 + 状态横幅 | ~330 行 |
| Admin UI / 平台移动适配 | 4.25–4.30 | 汉堡侧栏、卡片视图、大数字 Dashboard | ~620 行 |

---

## 二、模块详情

### 1. Admin 后台重构（4月7日）

**目标**：让后台具备企业级操作能力——可审计、可撤销、批量处理。

- **询盘批量删除 + 审计日志**：选中多条询盘一键删除，所有操作写入 `admin_audit_log`（含操作人/时间/操作类型/受影响 ID），记录永不删除。
- **30 天软删除回收站**：删除的询盘进入回收站，30 天内可还原，超期自动清理。
- **通知红点已读**：点击通知消息后红点消失，不再刷新后复现。
- **案例 CRUD（Admin 侧）**：Admin 可直接增删改装企项目，含图片管理。
- **首页排序独立**：Home Order 限最多 6 条，各区块排序互不影响。

新增：`admin_audit_log` 表 + 软删除字段 + 5 个后端 API + AdminInquiriesPage 批量操作 UI。

---

### 2. Harness 自动化强制层（4月7日）

**目标**：把"部署前跑一遍"变成必须通过的门禁，防止回归。

- **全局 Claude Stop Hook**：每次 Claude 停止后自动触发 TSC 类型检查，发现错误自动唤醒修复，无需人工介入。
- **Lint 门禁新增**：`lint-admin-ui.mjs`（Admin 组件规范）、`lint-cors-nginx.mjs`（CORS 一致性）、`lint-mobile.mjs`（移动端响应式）、`lint-reliability.mjs`（可靠性规范）。
- **标准化测试输出**：所有 harness 脚本统一返回 PASS/FAIL + 行号，CI 可消费。

月末 harness 脚本总数：**39 个**。

---

### 3. GEO 优化 / AI 搜索引擎适配（4月10日）

**目标**：让 Perplexity、ChatGPT Search、Google AI Overview 能准确抓取并引用 tarmeer.com。

- **Prerender 服务**：Node.js + Puppeteer，跑在 3003 端口，nginx 根据 UA 把爬虫流量转到预渲染版本，避免 SPA 空 HTML。
- **JSON-LD 全站扩充**：Company 详情页 LocalBusiness schema、项目页 CreativeWork、FAQ 页 FAQPage，每个公开页都有结构化数据。
- **动态 Sitemap**：后端生成，含所有公司 slug + 项目 slug，每日刷新。
- **FAQ 页**（/faq）：覆盖 20 个常见室内设计问题，针对 Dubai/UAE 关键词优化。
- **Python 运维 watchdog**：自动监控预渲染服务存活，挂了自动重启并发邮件告警。

---

### 4. AI 图片自动标签（4月10日）

**目标**：装企上传图片后自动打分类标签，提升搜索精准度。

- 集成 **Gemini Vision API**（替代 Google Cloud Vision，成本更低）。
- 上传时异步调用，返回 14 个预定义分类标签 + 细粒度 AI 标签，存入 `project_images.ai_tags`。
- 失败不阻断上传流程，静默降级。
- 后台 Admin 可查看/修改每张图片的标签。

---

### 5. 阿拉伯语 i18n（4月13日）

**目标**：tarmeer.com 支持阿拉伯语，覆盖迪拜本地用户。

- 语言切换按钮（EN / AR），偏好存 localStorage。
- **Azure Translator Free Tier 自动翻译**：动态内容（公司名、项目描述、询盘）按需翻译并缓存。
- RTL 布局支持：`dir="rtl"` + Tailwind RTL 前缀。
- 静态 UI 文本人工校对，动态内容机翻兜底。

---

### 6. 装企入驻 Wizard（4月14日）

**目标**：解决"公司填完资料不上传项目就走了"问题，强制走完上传流程。

参考 Houzz Pro 入驻流程设计：
1. **Step 1**：公司基础信息（名称 + 联系人 + 手机）
2. **Step 2**：上传第一个项目（不可跳过，不传不让进 Dashboard）
3. **Step 3**：补全 Profile（可跳过）

新增 `CompanyWizardPage`，Wizard 完成后跳转 Dashboard，每步状态持久化防刷新丢失。

---

### 7. Admin 数据分析合并（4月20日）

**目标**：把分散的 4 个分析页面合并，同时新增可操作记录审计。

- 注册数据 + 访客数据合并为双 Tab，Recharts 折线图/柱状图可视化。
- **操作记录页**：Admin 所有操作（审批/删除/修改）按时间线展示，可按操作人筛选。
- 月活/日活统计卡片，趋势箭头（环比）。

---

### 8. 供应商系统（4月21日–29日）

**目标**：从零搭建供应商目录——数据采集、公开展示、Admin 管理全链路。

**数据层**
- `suppliers` 表：独立供应商数据模型（含 origin、categories、has_physical_store、sort_order）。
- **Alibaba 爬虫**（`scripts/scrape-alibaba-suppliers.mjs`，540 行）：Puppeteer 自动化抓取阿里巴巴国际站供应商列表。
- **导入脚本**（`scripts/import-alibaba-suppliers.mjs`，197 行）：去重清洗后批量写入 RDS，本月导入 **449 条**。

**公开端**
- **ShowroomsPage**（/materials）：左侧边栏多维筛选（产地/品类/是否实体店），右侧供应商卡片网格，移动端折叠筛选抽屉，结果计数实时更新。
- **SupplierDetailPage**（/materials/suppliers/:slug）：Hero 区 + 面包屑导航，产品/目录/工程案例三 Tab，图片灯箱，SEO 完整（JSON-LD + og:image）。

**Admin 端**
- AdminSuppliersPage：列表搜索、产地/状态筛选、可排序（产品数量 / 加入时间）、状态一键切换。
- AdminSupplierDetailPage：左右两栏布局，内联编辑供应商信息、图片批量管理、产品管理。

**Harness**：`test-supplier-system.mjs`、`test-supplier-detail-page.mjs`、`lint-supplier-frontend.mjs`。

---

### 9. 装企服务分类扩展（4月28日）

**目标**：覆盖更多装企类型，提升平台对细分市场的收录能力。

- 新增 **11 个装企公司类型**（泳池、防水、景观设计、FFE、机电等）。
- 新增 **11 个服务标签**，与公司类型对应。
- 同步更新：后端枚举验证、前端 i18n labels、注册表单、Profile 编辑表单、Admin 查看模态框。
- 新增 **AdminEnumsPage**（/admin/enums，364 行）：可视化管理所有枚举分类，Admin 直接增删改，无需改代码部署。

---

### 10. 外勤访谈系统（4月29日）

**目标**：员工外出访谈装企时，用手机快速填写结构化记录，全部字段可选，无手动输入压力。

- **DB**：新建 `company_interviews` 表；新增 `field_staff` 角色。
- **FieldSurveyPage**（移动端）：所有问题均为单选/多选/滑块，支持整题跳过，提交时自动关联公司 ID。
- **AdminVisitRecordsPage**：访谈记录列表，按日期/员工/状态筛选，导出 CSV。
- **AdminStaffPage**：外勤员工管理，分配角色，查看访谈量统计。

---

### 11. 装企项目审核流程（4月30日）

**目标**：Admin 能对每个项目单独审核并发送结构化拒绝原因，装企第一时间知道如何修改。

**Admin 侧**
- `GET /admin/rejection-templates`：从历史拒绝记录提取高频模板，供审核时一键引用。
- AdminRegisteredCompanyDetailPage：每个 pending/rejected 项目卡片上独立 Approve / Reject 按钮；点击 Reject 弹出模板选择器 + 自定义文字框，操作后状态即时更新。

**装企侧**
- CompanyDashboardPage：有被拒项目时顶部显示红色横幅（含原因 + 修复链接，不可关闭）；有待审核项目时显示琥珀色横幅（可关闭，sessionStorage 记忆）。
- CompanyUploadPage：有被拒项目时显示顶部警告。
- CompanyProjectsPage：被拒项目显示 `Not Approved` 角标，支持 URL deep-link 滚动到对应项目并高亮。

---

### 12. Admin UI / 平台移动适配（4月25日–30日）

- **Admin 移动端**：汉堡菜单 + 侧边栏抽屉，触控目标 ≥ 44px。
- **AdminCompaniesPage**：大数字统计卡片（注册公司数 / 待审核 / 本月新增），搜索+筛选合并为一行。
- **AdminApplicationsTable**：移动端卡片视图，"查看"+"审核"双按钮。
- **AdminRegisteredCompanyDetailPage**：审核者视角单列布局（基本信息 → 作品集 → 详情），Approve/Reject 为主操作。
- **CompanyDashboardPage**：排名提升横幅（"上传更多项目 → 排名更高"）。
- **短URL系统**：`/@slug` 路由在全平台正常工作，公司可发 `tarmeer.com/@company-name` 短链。
- **深度链接**：`/company/auth?returnTo=/company/dashboard`，登录后自动返回目标页。
- **Admin 侧边栏徽章**：今日新增数字可点击消除，避免干扰日常操作。
- **用户表**：新增删除按钮，注册时间精确到时分。

---

## 三、关键量化指标

| 指标 | 数值 |
|------|------|
| 版本跨度 | v5.10.9 → v5.12.0 |
| 计划文档（docs/plans/） | **27 份**（设计+实施，含 55,000+ 行规格） |
| Harness 测试脚本 | **39 个**（全套通过） |
| 主要交付模块 | **12 个** |
| 净增源代码估计 | **~10,000 行** |
| 新增数据库表 | 3 个（company_interviews、admin_audit_log、suppliers 相关） |
| 新增角色 | 1 个（field_staff） |
| 新增 API 端点 | 12+ 个 |
| 导入供应商数据 | **449 条** |
| 新增公开页面 | 4 个（/materials、/materials/:slug、/faq、/guide） |
| 新增 Admin 页面 | 5 个（枚举管理、访谈记录、外勤员工、数据分析合并、操作记录） |
| 语言支持 | +1（阿拉伯语，含 RTL 布局） |
| 部署次数 | **14 次** |

---

## 四、待下月跟进

| 项目 | 状态 | 说明 |
|------|------|------|
| 项目拒绝通知（邮件/站内信） | 计划已写，未开发 | docs/plans/2026-04-30-project-rejection-notification.md |
| 业主落地页（/for-homeowners） | 需求已确认，待排期 | docs/plans/2026-04-21-for-homeowners-landing-design.md |
| Geo SEO — 预渲染服务上线 | 开发完成，待部署到生产 | 需配置 nginx UA 检测 |
| 供应商 SEO foundation | 方案已出 | supplier sitemap + seoMetaInjector 待上线 |
