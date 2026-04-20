# Admin 数据分析合并 + 操作记录

日期: 2026-04-20

## 技术选型

图表库: Recharts（React 声明式 API，支持柱状图/折线图/饼图/面积图/堆叠图）

## 改动范围

### 合并: 4 页 → 1 页「数据分析」

把 AdminDashboardPage、AdminAnalyticsPage、AdminStatsPage、AdminVisitorsPage 合并为一个页面，内含两个 tab。

---

### Tab 1 — 注册数据

#### 1.1 顶部汇总卡片（3 张）

每张卡片:
- 主数字（大字号）
- 环比变化（绿色↑ / 红色↓ + 百分比，如 ↑ 23.5%）
- 对比区间自动跟随时间筛选（选 7 天则对比上一个 7 天）

| 卡片 | 数据 |
|------|------|
| 新增业主 | users WHERE role='homeowner' 的注册数 |
| 新增装企 | users WHERE role='company' 的注册数 |
| 新增询盘 | design_inquiries 的提交数 |

#### 1.2 时间范围选择器

右上角: 7天 / 30天 / 90天 切换按钮组，影响所有卡片和图表

#### 1.3 每日注册趋势图（Recharts BarChart）

- X 轴: 日期
- Y 轴: 数量
- 三色分组柱状图: 业主（蓝）/ 装企（金 #B8864A）/ 询盘（灰）
- Tooltip: hover 显示具体人名列表（如 "Ahmed, Li Ming, ...）
- Legend: 底部图例，可点击切换显示/隐藏某一类
- 支持切换: 柱状图 ↔ 面积图（右上角小 toggle）

#### 1.4 注册来源分布（Recharts PieChart）

- 饼图: 按 signup_source 分类
  - for-companies-landing（装企落地页）
  - google-oauth（Google 登录）
  - join-page（/join 页面）
  - direct（直接注册）
  - company-lead-backfill（leads 自动回填）
- 显示百分比和绝对数
- 点击某块可筛选下方表格

#### 1.5 装企类型分布（Recharts PieChart）

- 饼图: 按 company_type 分类
  - design_studio（设计工作室）
  - renovation_company（装修公司）
  - general_contractor（总承包商）
  - mep_contractor（机电承包商）
  - maintenance_company（维护公司）
  - specialty_trade（专业工种）
  - landscaping（园林景观）
  - furnishing（家具软装）
- 显示百分比和绝对数
- 数据源: company_profiles 表

#### 1.6 近 14 天明细表

| 日期 | 新增业主 | 新增装企 | 询盘数 | 环比 |
|------|---------|---------|--------|------|
| 4/20 | 3       | 1       | 5      | ↑12% |

每行点击可展开查看具体注册人列表。

---

### Tab 2 — 访客数据

#### 2.1 顶部汇总卡片（6 张，两行排列）

每张带环比变化:

| 卡片 | 数据 |
|------|------|
| 总事件数 | analytics_events 总数 |
| 独立 IP | visitor_logs 去重 |
| 页面浏览 | pageview 事件数 |
| Apply 点击 | apply_click 事件数 |
| WhatsApp 点击 | whatsapp_click 事件数 |
| 联系表单提交 | contact_submit 事件数 |

#### 2.2 每日访问趋势图（Recharts ComposedChart）

- 柱状图: 每日页面浏览量
- 折线叠加: 独立访客数（带圆点标记）
- 双 Y 轴: 左=浏览量，右=访客数
- Tooltip: 日期 + 浏览量 + 访客数
- 时间范围跟随顶部选择器

#### 2.3 热门装企访问量（Recharts BarChart 水平）

- Top 10 装企，水平柱状图
- 每条显示: 装企名 + 访问量 + 城市分布小标签
- 点击跳转到该装企详情

#### 2.4 热门页面排行（表格）

| 排名 | 页面 | 浏览量 | 访客数 |
|------|------|--------|--------|
| 1    | /companies | 1,234 | 567 |

#### 2.5 访客 IP 列表（分页表格）

| IP | 国家/城市 | 最后访问 |
|----|----------|---------|
| 185.x.x.x | UAE / Dubai | 2h ago |

分页 50 条/页。

#### 2.6 权重配置（折叠面板，默认收起）

保持现有功能: base_profile_score / per_project_score / signed_score，可编辑+保存+触发重算。

---

### 新增: 「操作记录」独立页面

#### 3.1 顶部汇总卡片（4 张）

| 卡片 | 数据 |
|------|------|
| 今日操作 | 当天 activity_log 总数 |
| 活跃装企 | 当天有操作的装企数 |
| 活跃业主 | 当天有操作的业主数 |
| 管理操作 | 当天 admin 操作数 |

#### 3.2 操作类型分布图（Recharts PieChart）

按 action 分类: 创建 / 编辑 / 删除 / 审批 / 登录
显示最近 7 天的分布

#### 3.3 每日操作趋势图（Recharts AreaChart）

- 面积图: 按角色堆叠（Admin / 装企 / 业主三层）
- 直观看每天谁在活跃

#### 3.4 操作记录列表

筛选栏:
- 日期范围选择器
- 角色筛选: 全部 / Admin / 装企 / 业主
- 操作类型: 全部 / 创建 / 编辑 / 删除 / 审批 / 登录
- 搜索框: 按操作人名字或目标名字搜索

列表项样式:
```
┌──────────────────────────────────────────────────────────┐
│ 🟢 Zhang Design Studio [装企]          2026-04-20 14:30 │
│    上传了 5 个项目                    Dubai, UAE (IP)    │
│    ├── Modern Villa Design        [查看]                │
│    ├── Luxury Apartment           [查看]                │
│    └── ... 展开更多                                     │
├──────────────────────────────────────────────────────────┤
│ 🔴 Admin: Yiming [管理员]             2026-04-20 13:15 │
│    删除了装企 "Test Company"          Beijing, CN (IP)   │
│    原因: 测试数据清理                                    │
├──────────────────────────────────────────────────────────┤
│ ⚪ Ahmed [业主]                       2026-04-20 12:00 │
│    提交了询盘给 Al Barari Design       Dubai, UAE (IP)   │
│    [查看询盘]                                           │
└──────────────────────────────────────────────────────────┘
```

颜色规则:
- 🟢 绿色: 创建、审批
- 🔴 红色: 删除、拒绝
- 🟡 黄色: 编辑、更新
- ⚪ 灰色: 登录、查看

聚合规则:
- 同一用户 + 同一天 + 同一操作类型 → 合并为一条
- 显示"上传了 N 个项目"，可展开查看每个项目名 + 链接
- 展开区域带缩进和连接线

分页: 每页 30 条，支持翻页
导出: 右上角 CSV 导出按钮

#### 3.5 追踪的操作类型

| 角色 | 操作 | action 值 | target_type |
|------|------|-----------|-------------|
| Admin | 审批装企 | approve | company_profile |
| Admin | 拒绝装企 | reject | company_profile |
| Admin | 删除用户 | delete | user |
| Admin | 删除装企 | delete | company_profile |
| Admin | 编辑权限 | update | admin_permission |
| Admin | 绑定目录公司 | bind | uae_company |
| 装企 | 上传项目 | create | project |
| 装企 | 编辑项目 | update | project |
| 装企 | 删除项目 | delete | project |
| 装企 | 编辑公司资料 | update | company_profile |
| 装企 | 上传 logo | update | company_logo |
| 业主 | 提交询盘 | create | inquiry |
| 业主 | 编辑资料 | update | homeowner_profile |
| 全部 | 登录 | login | session |
| 全部 | 注册 | register | user |

---

### 侧边栏调整

- 「数据分析」替换原 Analytics 入口（icon: Activity）
- 删除 Stats Report（BarChart2）入口
- 删除 Visitors 入口
- 新增「操作记录」入口（icon: ClipboardList）
- 全局「公司」→「装企」

### 不动的页面

用户（业主）、装企列表、询盘列表、帮助中心、导入、投诉、管理员管理

---

## 数据库

新建 activity_log 表:

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_name VARCHAR(100),
  user_role VARCHAR(20),        -- admin / company / homeowner
  action VARCHAR(50) NOT NULL,  -- create / update / delete / approve / reject / login / register
  target_type VARCHAR(50),      -- project / company_profile / inquiry / user / session
  target_id INT,
  target_name VARCHAR(200),     -- 项目名/公司名，方便展示
  description TEXT,             -- 可读描述
  ip VARCHAR(45),
  country VARCHAR(50),
  city VARCHAR(50),
  metadata JSON,                -- 扩展字段（如项目图片数、编辑了哪些字段）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_user_role (user_role),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_target_type (target_type)
)
```

保留 90 天数据，查询时 WHERE created_at > NOW() - INTERVAL 90 DAY。

---

## 补充设计

- 所有图表响应式: 移动端自动缩放，卡片从 3 列变 1 列
- 图表加载态: 骨架屏 shimmer 效果
- 空状态: 无数据时显示插图 + "暂无数据"
- 深色模式: 图表颜色适配（预留，当前不实现）

## 已知 bug

- 装企列表页顶部搜索装企名字没有返回数据（需排查）
