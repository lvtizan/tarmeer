# Service Linkage & Login Showcase 测试用例

## 覆盖功能

1. **全站服务名称联动** — `company_services` 表驱动；`GET /api/company/services` 从 DB 返回
2. **登录页展示图** — `GET /api/site/showcase-images` + 后台管理 + 静默优化
3. **CompaniesPage URL 参数预选** — `?service=X` 自动勾选侧栏筛选项

---

## TC-01: `/api/company/services` 返回 DB 数据

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | `GET /api/company/services` | 200 OK |
| 2 | 检查 `services` 数组 | 数组非空，长度 ≥ 13 |
| 3 | 检查内容 | 包含 "Renovation"、"Construction"、"Interior Design" |
| 4 | 检查无硬编码 | 返回条目数 > 13（即来自 DB，不是旧硬编码的 13 条） |

---

## TC-02: 管理员服务枚举 CRUD

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | `GET /api/admin/enums/company-services`（无 token） | 200，返回 `{ services: [...] }` |
| 2 | 每条数据结构 | 含 `name`、`sort_order`、`active` 字段 |
| 3 | `POST /api/admin/enums/company-services`（无 token） | 401 或 403 |
| 4 | `PUT /api/admin/enums/company-services/X`（无 token） | 401 或 403 |
| 5 | `DELETE /api/admin/enums/company-services/X`（无 token） | 401 或 403 |

---

## TC-03: 展示图 API

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | `GET /api/site/showcase-images` | 200，返回 `{ images: [...] }` |
| 2 | 检查 images 类型 | 数组（可为空） |
| 3 | `POST /api/admin/showcase-images/optimize`（无 token） | 401 或 403 |
| 4 | `PUT /api/admin/system-config`（无 token） | 401 或 403 |

---

## TC-04: 服务缓存失效

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 调用 `GET /api/company/services`，记录当前列表 | 成功 |
| 2 | 以 admin token 新增服务：`POST /api/admin/enums/company-services` `{ name: "TEST_SVC_HARNESS" }` | 201 |
| 3 | 再次调用 `GET /api/company/services` | 新条目出现（缓存已失效） |
| 4 | 清理：`DELETE /api/admin/enums/company-services/TEST_SVC_HARNESS` | 200 或 204 |
| 5 | 再次调用 `GET /api/company/services` | 新条目消失 |

---

## TC-05: 路由权限矩阵

| 端点 | 无 token | 有效 admin token |
|------|----------|-----------------|
| `GET /api/company/services` | 200 ✅ | 200 ✅ |
| `GET /api/admin/enums/company-services` | 200 ✅（只读公开） | 200 ✅ |
| `POST /api/admin/enums/company-services` | 401/403 ❌ | 201 ✅ |
| `PUT /api/admin/enums/company-services/:name` | 401/403 ❌ | 200 ✅ |
| `DELETE /api/admin/enums/company-services/:name` | 401/403 ❌ | 200 ✅ |
| `GET /api/site/showcase-images` | 200 ✅ | 200 ✅ |
| `POST /api/admin/showcase-images/optimize` | 401/403 ❌ | 200 ✅ |
| `PUT /api/admin/system-config` | 401/403 ❌ | 200 ✅ |
