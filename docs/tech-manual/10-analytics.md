# 10 — 分析追踪系统

## 架构

```
前端事件采集                    后端处理                      Admin 查看
  │                              │                              │
  ├── useVisitorTracking()       ├── statsController.ts         ├── AdminAnalyticsPage
  ├── useAnalyticsTracking()     ├── visitorAdminController.ts  └── AdminDashboardPage
  └── 批量上报 /api/stats/batch  └── analyticsAdminController.ts
```

---

## 一、页面浏览追踪

### 前端

```typescript
// hooks/useAnalyticsTracking.ts
// 每次路由变化自动上报 page_view
POST /api/stats/page-view
{
  entity_type: 'designer' | 'project',
  entity_id: number,
  referrer: document.referrer,
}
```

### 后端

**表**: `page_views`

```sql
id              INT AUTO_INCREMENT
entity_type     ENUM('designer', 'project')
entity_id       INT
viewer_ip       VARCHAR(45)
viewer_fingerprint  VARCHAR(64)
referrer        VARCHAR(500)
user_agent      VARCHAR(500)
created_at      TIMESTAMP
```

### 每日汇总

**表**: `designer_stats`

```sql
designer_id     INT
date            DATE
profile_views   INT DEFAULT 0
project_views   INT DEFAULT 0
phone_clicks    INT DEFAULT 0
whatsapp_clicks INT DEFAULT 0
contact_clicks  INT DEFAULT 0
PRIMARY KEY (designer_id, date)
```

---

## 二、点击事件追踪

```typescript
POST /api/stats/click
{
  designer_id: number,
  click_type: 'phone' | 'whatsapp' | 'email' | 'contact_form',
}
```

**表**: `click_events`

```sql
id              INT AUTO_INCREMENT
designer_id     INT
click_type      ENUM('phone', 'whatsapp', 'email', 'contact_form')
viewer_ip       VARCHAR(45)
user_agent      VARCHAR(500)
created_at      TIMESTAMP
```

---

## 三、访客追踪

### 前端

```typescript
// hooks/useVisitorTracking.ts
// 页面加载时上报访客信息
POST /api/stats/visitor
{
  page_path: '/companies/archlon',
  referrer: 'https://google.com',
}
```

### 后端

**表**: `visitor_logs`

```sql
id              INT AUTO_INCREMENT
viewer_ip       VARCHAR(45)
location_label  VARCHAR(200)    -- 自动解析: "Dubai, AE"
page_path       VARCHAR(500)
referrer        VARCHAR(500)
user_agent      VARCHAR(500)
created_at      TIMESTAMP
```

---

## 四、自定义事件

```typescript
POST /api/stats/event
{
  event_name: 'inquiry_form_open',  // 最长 64 字符
  payload: { source: 'company_detail', company_id: 5 },
}

// 批量上报（性能优化）
POST /api/stats/batch
{
  events: [ ... ]  // 最多 100 条/批
}
```

**表**: `analytics_events`

```sql
id              INT AUTO_INCREMENT
event_name      VARCHAR(64)
payload         JSON
ip              VARCHAR(45)
location_label  VARCHAR(200)
referrer        VARCHAR(500)
user_agent      VARCHAR(500)
created_at      TIMESTAMP
```

---

## 五、IP 地理定位

**文件**: `server/src/lib/ipLocation.ts`

### IP 获取优先级

1. `cf-connecting-ip` (Cloudflare)
2. `x-real-ip` (Nginx)
3. `x-forwarded-for` (代理)
4. `req.ip` (直连)

### 三级 Fallback 提供商

```
1. ipapi.co (免费, 1000次/天)
   ↓ 失败
2. ipwho.is (免费, 无限制)
   ↓ 失败
3. ipinfo.io (需 IPINFO_TOKEN, 50K次/月)
```

### 缓存

**表**: `visitor_ip_geo_cache`

```sql
ip              VARCHAR(45) PRIMARY KEY
location_label  VARCHAR(200)    -- "Dubai, AE"
country_code    VARCHAR(5)
city_name       VARCHAR(100)
cached_at       TIMESTAMP
-- TTL: 30 天
```

查询时先查缓存，命中直接返回，未命中才调外部 API。
