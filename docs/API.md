# Tarmeer 4.0 API 文档

## 基础信息

- **Base URL**: `http://localhost:3001/api`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

---

## 认证接口

### POST /auth/register
注册新设计师

**请求体**:
```json
{
  "email": "designer@example.com",
  "password": "password123",
  "full_name": "张三",
  "phone": "+971501234567",
  "city": "Dubai"
}
```

**响应**:
```json
{
  "message": "注册成功！请检查您的邮箱并验证邮箱地址",
  "email": "designer@example.com"
}
```

---

### POST /auth/verify-email
验证邮箱

**请求体**:
```json
{
  "token": "verification_token_here"
}
```

**响应**:
```json
{
  "message": "邮箱验证成功！",
  "token": "jwt_token_here",
  "designer": { ... }
}
```

---

### POST /auth/login
登录

**请求体**:
```json
{
  "email": "designer@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "token": "jwt_token_here",
  "designer": { ... }
}
```

---

## 设计师接口

### GET /designers
获取设计师列表

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认10）
- `approved`: 是否已审核（true/false）

**响应**:
```json
{
  "designers": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

### GET /designers/:id
获取设计师详情

**响应**:
```json
{
  "designer": { ... },
  "projects": [ ... ]
}
```

---

### PUT /designers/:id
更新设计师信息（需要认证）

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "full_name": "张三",
  "phone": "+971501234567",
  "city": "Dubai",
  "address": "详细地址",
  "bio": "个人简介",
  "avatar_url": "https://...",
  "style": "现代简约",
  "expertise": ["住宅设计", "商业空间"]
}
```

---

## 项目接口

### POST /projects
创建项目（需要认证）

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "title": "现代简约住宅",
  "description": "项目描述",
  "style": "现代简约",
  "location": "Dubai Marina",
  "area": "200 sqm",
  "year": 2024,
  "cost": "500,000 AED",
  "images": ["url1", "url2"],
  "tags": ["住宅", "现代"]
}
```

---

### GET /projects
获取项目列表

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认10）
- `designer_id`: 设计师ID
- `status`: 状态（draft/published/archived）

---

### GET /projects/:id
获取项目详情

---

### PUT /projects/:id
更新项目（需要认证）

---

### DELETE /projects/:id
删除项目（需要认证）

---

## 联系表单接口

### POST /contact
提交联系表单

**请求体**:
```json
{
  "name": "客户姓名",
  "email": "client@example.com",
  "phone": "+971501234567",
  "type": "inquiry",
  "message": "咨询内容",
  "designer_id": 1,
  "project_id": 1
}
```

**type 类型**:
- `inquiry`: 咨询
- `quote`: 报价
- `partnership`: 合作

---

## 错误响应

所有接口错误响应格式：
```json
{
  "error": "错误信息"
}
```

---

## 邮件通知

以下操作会发送邮件通知到 lvyiming@kp99.cn：

1. 设计师注册
2. 项目提交
3. 联系表单提交

---

## 速率限制

- 注册：每个 IP 每小时最多 5 次
- 验证邮件：每个邮箱每小时最多 3 次
- 联系表单：每个 IP 每小时最多 10 次
