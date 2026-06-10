# 国家归属（AE/VN）用例走查

> 可执行版本：`node scripts/harness/country-walkthrough.mjs`
> 前提：本地后端 3002（`server/.env` DB_HOST=localhost）+ 本地 MySQL `tarmeer` 库。
> 注册接口有限流，连续跑两次会 429，重启后端即可重置。

## 归属规则总表

| 数据 | 归属机制 |
|------|---------|
| users / designers | phone 前缀（`+84`/`084` = vn），无 phone 默认 ae |
| company_profiles | 创建时按 users.phone 前缀写 `country` |
| supplier_profiles | 注册时按 phone 前缀写 `country` |
| design_inquiries | company_id → company_profiles.country；无公司时按 phone 前缀兜底 |
| complaints | `company_slug LIKE 'vn-%'` OR slug ∈ VN company_profiles |
| company_interviews | saveDraft/reSubmit 时由 company_ref（profile/uae）推导 `country` |
| visitor_logs / analytics_events | `page_path LIKE '/companies/vn-%'` 推断 |

## 用例（11 个，全部自动化）

| # | 用例 | 预期 |
|---|------|------|
| UC1 | VN 业主注册（+84） | admin users?country=vn 可见，ae 不可见 |
| UC2 | AE 业主注册（+971） | admin users?country=ae 可见，vn 不可见 |
| UC3 | VN 公司注册（+84 → company profile） | company_profiles.country='vn' |
| UC4 | AE 公司注册（+971） | company_profiles.country='ae' |
| UC5 | VN 首页 Banner 询盘（city=Hồ Chí Minh，无 company_id） | 201 且落 VN 桶（曾因 VALID_CITIES 缺 VN 城市被 400） |
| UC6 | AE 首页 Banner 询盘（city=Dubai） | 201 且落 AE 桶 |
| UC7 | VN 公司询盘（company_id 指向 VN 公司） | 落 VN 桶，AE 不可见 |
| UC8 | 投诉 vn- 前缀目录公司 | complaints?country=vn 可见 |
| UC9 | 投诉注册的 VN 公司（slug 无 vn- 前缀） | 落 VN 桶（按 company_profiles.country 兜底） |
| UC10 | VN 供应商注册（+84） | supplier_profiles.country='vn' |
| UC11 | 实地调研关联 VN 公司并提交 | company_interviews.country='vn' |
| UC12 | VN 视图新增外勤人员 | admin_users.country='vn'，仅 VN 视图可见 |

## 边界情况说明

- 业主注册不填手机号 → 无法识别国家，归 AE（机制限制，phone 是唯一判定依据）
- 实地调研不关联任何公司（手填公司名）→ country 保持默认 'ae'
- 询盘 city 校验白名单在 `inquiryController.VALID_CITIES`，**前端城市下拉加选项必须同步**
- 同一 IP 同时访问 AE 和 VN 公司页 → 访客列表在两个国家视图都出现（按访问记录拆分计数）

## 历史数据回填（部署生产后需一次性执行）

修复只影响新数据，生产库存量错误数据需回填：

```sql
-- VN 实地调研（关联了 VN 公司但 country 还是 ae 的）
UPDATE company_interviews ci
JOIN company_profiles cp ON ci.company_ref_source='profile' AND ci.company_ref_id=cp.id
SET ci.country=cp.country WHERE cp.country <> ci.country;
UPDATE company_interviews ci
JOIN uae_companies uc ON ci.company_ref_source='uae' AND ci.company_ref_id=uc.id
SET ci.country=uc.country WHERE uc.country <> ci.country;

-- VN 供应商（+84 手机号但 country=ae 的）
UPDATE supplier_profiles SET country='vn'
WHERE (contact_phone LIKE '+84%' OR contact_phone LIKE '084%') AND country <> 'vn';

-- 外勤人员：auto-migrate 给 admin_users 补 country 列后默认全部 'ae'，
-- 属于越南团队的人员需手动改派（按实际邮箱替换）：
-- UPDATE admin_users SET country='vn' WHERE email IN ('xxx@qq.com') AND role='field_staff';
```
