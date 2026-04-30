# Tarmeer 4.0 变更日志

记录网站功能完善和新增，保持文档最新最全。

---


## [5.0.99] - 2026-04-30

### Added
- **Supplier Portal** — Full supplier onboarding flow: email verification, profile setup, product/catalogue uploads, and approval dashboard
- **For Suppliers Page** — Redesigned landing page with AI-generated hero image, updated copy positioning Tarmeer as UAE's renovation supply chain platform
- **Supplier Dashboard** — Onboarding progress tracker with 5 completion steps, live product/project/catalogue counts, and approval status banner
- **Supplier Constants** — Centralised `ORIGIN_LABEL` and `ORIGIN_BADGE_CLASS` for consistent China/Dubai badge display across showrooms and detail pages
- **Supplier Dashboard Harness** — 21-case automated test suite covering auth guards, empty lists, pending-status access, and count validation
- **Field Staff & Interviews** — Admin-side field visit records and staff management (super_admin only)
- **Types & Services Enums** — Admin UI to manage company type slugs and service names; seed data included in auto-migrate

### Changed
- **For Suppliers Page** — Replaced "showroom/展厅" messaging with "listing/products/supplier"; feature cards rewritten to reflect supply chain integration model; duplicate footer removed
- **Showrooms Page** — Origin badges use centralised `supplierConstants` for consistent English labels
- **Admin Layout** — Added Types & Services nav item; merged imports from both branches

## [待发布] - 2025-03-28

### 新增功能
- **OAuth 登录** - Google 和 Facebook 第三方登录
  - Passport.js 集成
  - 自动关联已有账号
  - 头像下载存储
  - 状态: 设计完成，待实现（仅配置文件和依赖已就绪）

### 数据库变更
```sql
-- OAuth 字段 (待执行)
ALTER TABLE designers ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE designers ADD COLUMN facebook_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE designers ADD COLUMN avatar_url VARCHAR(500) NULL;
ALTER TABLE designers ADD COLUMN oauth_provider ENUM('google', 'facebook', NULL) NULL;
```

---

## [已发布] - 2025-03-27

### 功能完善
- **爬虫脚本增强** - 项目图片爬取优化
  - 增加图片数量限制
  - 保留原有目录结构

---

## [已发布] - 2025-03-26

### 新增功能
- **SEO 优化** - 路由级别 meta 标签
- **Robots.txt 和 Sitemap**
- **访客 IP 统计** - 多提供商全球 IP 地理定位回退
- **管理员功能** - 访客 IP 统计和地理位置映射

---

## 历史功能

### 认证系统
- 邮箱注册/登录
- 邮箱验证
- 密码重置
- 登录速率限制
- 账户锁定保护

### 设计师后台
- 仪表盘统计
- 个人资料编辑
- 项目上传/编辑/删除
- 图片管理

### 管理员系统
- 设计师审核
- 软删除功能
- 统计分析

---

**更新规则**：每次添加或修改功能后，在此文档顶部记录变更内容。
