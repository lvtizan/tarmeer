# 12 — 数据库与自动迁移

## 数据库配置

| 项目 | 值 |
|------|-----|
| 类型 | MySQL 8.0 |
| 托管 | Aliyun RDS (Dubai Region) |
| 主机 | `rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com` |
| 数据库名 | `tarmeer` |
| 字符集 | `utf8mb4` |
| 连接方式 | `mysql2` 连接池 |

---

## 表结构总览

### 核心业务表

| 表名 | 行数级别 | 说明 |
|------|----------|------|
| `users` | 百级 | 统一用户表（homeowner + company） |
| `uae_companies` | 87 | 爬虫抓取的目录公司 |
| `company_profiles` | 十级 | 注册公司 profile |
| `projects` | 百级 | 设计项目（portfolio） |
| `designers` | 百级 | Legacy 设计师表（linked to users） |

### 交互表

| 表名 | 增长 | 说明 |
|------|------|------|
| `design_inquiries` | 日增 | 设计询盘（核心业务） |
| `company_leads` | 日增 | 公司注册线索 |
| `contacts` | 低频 | 联系表单 |
| `complaints` | 低频 | DMCA/版权投诉 |
| `company_applications` | 低频 | 公司角色申请 |
| `notifications` | 日增 | 应用内通知 |

### 分析表

| 表名 | 增长 | 说明 |
|------|------|------|
| `page_views` | 高频 | 页面浏览记录 |
| `click_events` | 中频 | 点击事件（phone/whatsapp/email） |
| `designer_stats` | 日级 | 每日聚合统计 |
| `visitor_logs` | 高频 | 访客日志 |
| `analytics_events` | 高频 | 自定义分析事件 |
| `visitor_ip_geo_cache` | 中频 | IP 地理位置缓存（30天TTL） |

### 系统表

| 表名 | 说明 |
|------|------|
| `admin_users` | Admin 账号（独立于 users） |
| `admin_audit_log` | Admin 操作审计日志 |
| `admin_last_seen` | Admin 最后查看时间 |
| `notification_emails` | 通知邮箱接收人列表 |
| `weight_config` | 公司权重评分配置 |

---

## 关键表详细结构

### users

```sql
id              BIGINT AUTO_INCREMENT PRIMARY KEY
email           VARCHAR(255) UNIQUE NOT NULL
password        VARCHAR(255)           -- bcrypt hash, NULL for OAuth users
full_name       VARCHAR(100)
phone           VARCHAR(20)
avatar_url      VARCHAR(500)
role            VARCHAR(20)            -- homeowner / company
active_role     VARCHAR(20)            -- 当前视图模式
google_id       VARCHAR(255)           -- Google OAuth ID
facebook_id     VARCHAR(255)           -- Facebook OAuth ID
email_verified  TINYINT(1) DEFAULT 0
permissions     JSON                   -- 用户级权限
deleted_at      DATETIME NULL          -- 软删除
deleted_by_admin_id  BIGINT NULL
delete_reason   VARCHAR(500)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### design_inquiries

```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
name                VARCHAR(100)
phone               VARCHAR(20) NOT NULL
city                VARCHAR(50)
area_range          VARCHAR(20) NOT NULL
message             TEXT
company_id          INT NULL               -- FK → company_profiles
source_company_name VARCHAR(200)           -- 来源公司名（文本）
source_company_slug VARCHAR(200)           -- 来源公司 slug
status              ENUM('new','contacted','resolved','archived') DEFAULT 'new'
admin_notes         TEXT

-- CRM 同步
crm_synced_at       DATETIME NULL
crm_sync_status     ENUM('pending','synced','failed') DEFAULT 'pending'
crm_lead_id         VARCHAR(64) NULL
crm_action          VARCHAR(32) NULL       -- created/updated/linked/duplicate
crm_last_error      TEXT NULL              -- JSON 错误详情
crm_sync_attempts   INT DEFAULT 0

-- 软删除
deleted_at          DATETIME NULL
deleted_by          INT NULL
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### uae_companies

```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
name_en             VARCHAR(200)
name_ar             VARCHAR(200)
slug                VARCHAR(200) UNIQUE
logo_url            VARCHAR(500)
website             VARCHAR(500)
whatsapp            VARCHAR(20)
city                VARCHAR(50)
services            JSON                   -- 32种服务标签数组，见 VALID_SERVICES in companyProfileDraft.ts
specialties         JSON
portfolio_images    JSON                   -- 分类图片 { category: [...urls] }
portfolio_categories JSON
year_established    VARCHAR(10)
google_rating       DECIMAL(2,1)
google_reviews_count INT

-- 排序与权重
display_order       INT DEFAULT 0
home_display_order  INT DEFAULT 0
list_display_order  INT DEFAULT 0
is_signed           TINYINT(1) DEFAULT 0   -- 签约公司
weight_score        INT DEFAULT 0          -- 权重评分

owner_user_id       BIGINT NULL            -- 绑定到注册用户
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

---

## 自动迁移系统

**文件**: `server/src/lib/autoMigrate.ts`

### 设计原则

| 原则 | 说明 |
|------|------|
| **幂等** | 每条 migration 先检查再执行，重复运行不报错 |
| **只增不删** | 只 CREATE TABLE / ADD COLUMN / ADD INDEX，永不 DROP |
| **非阻断** | 单条失败只 `console.error`，不影响其他 migration 和服务启动 |
| **零依赖** | 不用 Knex / TypeORM / Prisma，纯 SQL + mysql2 |

### 启动流程

```
服务器启动 → app.ts → runAutoMigrate()
  │
  ├── 阶段 0: CREATE TABLE IF NOT EXISTS
  │   ├── admin_audit_log
  │   ├── admin_last_seen
  │   ├── weight_config
  │   └── company_leads
  │
  ├── 阶段 1: ALTER TABLE ADD COLUMN
  │   ├── OAuth 字段: google_id, facebook_id, oauth_provider
  │   ├── 软删除: deleted_at, deleted_by, delete_reason
  │   ├── CRM 同步: crm_synced_at, crm_sync_status, crm_lead_id, crm_action, crm_last_error, crm_sync_attempts
  │   ├── SEO: slug (projects, company_profiles)
  │   ├── 权重: is_signed, weight_score
  │   ├── 标签: tags (JSON)
  │   ├── 排序: display_order, home_display_order, list_display_order
  │   └── 权限: permissions (JSON)
  │
  ├── 阶段 2: MODIFY COLUMN (确保 NULL)
  │   └── designers.password → VARCHAR(255) NULL (OAuth 用户无密码)
  │
  ├── 阶段 3: CREATE INDEX
  │   ├── idx_oauth_google (designers.google_id)
  │   └── idx_oauth_facebook (designers.facebook_id)
  │
  ├── 阶段 4: 数据清理
  │   ├── 为 company_profiles 生成缺失的 slug
  │   └── 为 projects 生成缺失的 slug
  │
  └── 阶段 5: 种子数据
      └── weight_config 默认配置
          ├── base_profile_score = 50
          ├── per_project_score = 10
          └── signed_score = 500
```

### 工具函数

```typescript
columnExists(table, column)     // INFORMATION_SCHEMA.COLUMNS 查询
indexExists(table, indexName)    // INFORMATION_SCHEMA.STATISTICS 查询
isColumnNullable(table, column) // IS_NULLABLE 检查
```

### 新增字段方式

```typescript
// 在 REQUIRED_COLUMNS 数组末尾追加即可
{ table: 'designers', column: 'wechat_id', type: 'VARCHAR(255) NULL' },
```

下次服务重启自动执行。

---

## 数据流图

### 询盘数据流

```
用户提交                      Admin 管理                    CRM
   │                            │                           │
   ▼                            ▼                           │
design_inquiries ──────→ AdminInquiriesPage ──────→ pushLeadToCRM()
   │                    (状态流转/备注/导出)            │
   │                            │                      ▼
   │                    admin_audit_log          CRM 系统
   │                    (删除审计)               (外部)
   │
   ├── notification_emails (邮件通知)
   └── notifications (应用内通知)
```

### 公司数据流

```
爬虫抓取                    用户注册                   Admin 审核
   │                          │                          │
   ▼                          ▼                          ▼
uae_companies          company_profiles           admin_users
(87 家目录公司)        (注册公司)                 (审核/绑定)
   │                          │                          │
   └──────────┬───────────────┘                          │
              ▼                                          │
      publicCompanyController.ts ←───────────────────────┘
      (合并去重 → 统一列表)
              │
              ▼
         CompaniesPage.tsx
         (前端展示)
```
