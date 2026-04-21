# 业主落地页需求（/for-homeowners）

日期: 2026-04-21
状态: 需求已确认，待排期

## 定位

投放渠道: TikTok、Instagram、Facebook
受众: UAE 本地业主（别墅/公寓/办公室装修需求），英语+阿拉伯语
目标: 留资 → 引导注册。收集装修需求表单，线索销售给装企。
设备: 移动端为主，兼顾 PC

## 转化流程

1. 业主填表留资（5 个字段，一屏表单）
2. 提交成功后引导注册账号
3. 数据写入 homeowner_leads + mirror 到 design_inquiries + CRM 推送
4. 注册后通过 phone 匹配回填 homeowner_profiles

## 表单字段（5 个，一屏完成）

- 手机号（GCC 区号选择器，必填）
- 城市（下拉，必填）
- 物业类型: Villa / Apartment / Office / Retail（下拉，必填）
- 面积 sqm（数字输入，必填）
- 需求: Full Design / Renovation / Kitchen / Bathroom / Painting（多选 tag，必填）

不要姓名字段，手机号够识别。少一个字段少一分阻力。

## 页面结构（4 个区域，移动端不超过 2 屏）

### 区域 1: Hero — 痛点标题 + 表单（首屏）

- 背景: 高质量室内设计图 + 深色遮罩
- 左侧文案（移动端在上）:
  - 标签: FREE · NO COMMITMENT
  - 标题: Get 3 Quotes from Verified Interior Companies
  - 副标题: Tell us about your space. We'll match you with trusted design & build companies in 48 hours — completely free.
  - 3 个勾选: 100+ Verified Companies / Free Quotes / No Obligation
- 右侧表单卡片（移动端在下）:
  - 卡片标题: Get Your Free Quote
  - 5 个字段
  - 按钮: Get Free Quotes →（金色）
  - 小字: Free service · No spam · Response within 48hrs

### 区域 2: 信任锤（窄横条，金色底）

100+ Companies · 2,000+ Projects · 48hr Match · 100% Free

### 区域 3: 三步流程（白底三列）

- Step 1: Describe Your Space（2 minutes to fill）
- Step 2: Get Matched（We find the best 3 for you）
- Step 3: Compare Quotes（Choose your favorite）

每步一个大数字圆圈 + 一句话，不要段落描述。

### 区域 4: 底部 CTA（深色全宽）

- Ready? It takes 2 minutes.
- 按钮滚动回顶部表单
- 小字 footer

## 不放的内容

- 服务详情卡片 → 主站已有
- 作品集预览 → 主站 /portfolio 已有
- FAQ → 放主站底部，不放落地页
- 任何增加阅读负担的内容

## 技术实现要点

- 参考 ForCompaniesPage + CompanySignupForm 结构
- i18n: 英语+阿拉伯语（EN/AR 切换），复用 forCompanies.ts 模式
- 新建 homeowner_leads 表（类似 company_leads）
- 新建 POST /api/homeowner-leads API
- CRM 推送复用现有 pushLeadToCRM
- 注册后 phone 匹配回填（复用 company leads backfill 模式）
- 表单一屏，移动端城市+物业类型同行（两个下拉并排）
