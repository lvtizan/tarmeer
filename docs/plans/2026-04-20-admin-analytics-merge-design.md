# Admin 数据分析合并 + 操作记录

日期: 2026-04-20

## 改动范围

### 合并: 4 页 → 1 页「数据分析」

把 AdminDashboardPage、AdminAnalyticsPage、AdminStatsPage、AdminVisitorsPage 合并为一个页面，内含两个 tab。

**Tab 1 — 注册数据**
- 汇总卡片: 新增业主数、新增装企数、新增询盘数（7/30/90 天切换）
- 每日注册趋势图: 按天分组柱状图（业主/装企/询盘三色），hover 显示具体人名
- 近 14 天明细表

**Tab 2 — 访客数据**
- 汇总卡片: 总事件数、独立 IP、页面浏览、Apply 点击、WhatsApp 点击、联系提交
- 每日访问趋势图
- 热门装企访问量（Top 10 + 城市分布）
- 热门页面排行
- 访客 IP 列表（分页）
- 权重配置（保持原位，放底部）

### 新增: 「操作记录」独立页面

全角色操作追踪:

Admin: 审批/拒绝装企、删除用户/装企、编辑权限、绑定目录公司
装企: 上传项目（记录项目名）、编辑项目、删除项目、编辑资料、上传 logo
业主: 提交询盘、编辑资料

每条记录: 时间、操作人（姓名+角色标签）、描述（如"上传了项目 Modern Villa Design"）、IP、国家/城市、可点击链接

聚合: 同一用户同一天同类操作合并（如"Zhang Design Studio 上传了 5 个项目"），展开看明细

筛选: 日期范围、角色（全部/Admin/装企/业主）、操作类型（全部/创建/编辑/删除/审批）
分页、支持导出 CSV

### 侧边栏调整

- 「数据分析」替换原 Analytics 入口
- 删除 Stats Report、Visitors 入口
- 新增「操作记录」入口
- 「公司」→「装企」

### 不动的页面

用户（业主）、装企列表、询盘列表、帮助中心、导入、投诉、管理员管理

## 数据库

新建 activity_log 表:

```sql
activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_name VARCHAR(100),
  user_role VARCHAR(20),        -- admin / company / homeowner
  action VARCHAR(50) NOT NULL,  -- create / update / delete / approve / reject
  target_type VARCHAR(50),      -- project / company_profile / inquiry / user
  target_id INT,
  target_name VARCHAR(200),     -- 项目名/公司名，方便展示
  description TEXT,             -- 可读描述
  ip VARCHAR(45),
  country VARCHAR(50),
  city VARCHAR(50),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_target_type (target_type)
)
```

保留 90 天数据，查询时 WHERE created_at > NOW() - INTERVAL 90 DAY。

## 补充设计

- 敏感操作高亮: 删除红色、审批绿色、普通编辑灰色
- 导出 CSV: 操作记录页右上角按钮
- 实时性: 后端写入即时生效

## 已知 bug

- 装企列表页顶部搜索装企名字没有返回数据（需排查）
