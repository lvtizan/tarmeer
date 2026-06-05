# Mall → CRM 装企数据同步接口规格

> 版本：v1.1
> 更新：2026-06-04
> 联系：Mall 后端团队

---

## 概述

Mall 侧在以下两个场景会主动向 CRM 推送装企最新数据：

1. **装企在 Mall 更新公司资料**（名称、联系方式、服务范围等）
2. **字段调研员完成实地问卷采集**，数据通过双重验证（搜索匹配到注册装企 + 拍到带经纬度的水印照片）后自动合并

两种场景均调用同一个接口：`POST /api/integration/mall/partner/sync`

---

## 鉴权

所有 Mall→CRM 请求使用 HMAC-SHA256 签名。

### 请求头

| Header | 说明 |
|--------|------|
| `X-Mall-Timestamp` | Unix 时间戳（秒，10位整数字符串） |
| `X-Mall-Signature` | HMAC-SHA256 十六进制字符串 |
| `Content-Type` | `application/json` |

### 签名算法

```
signature = HMAC-SHA256(secret, timestamp + "\n" + rawBody)
```

- `secret`：双方共享的 `MALL_INTEGRATION_SECRET` 环境变量
- `rawBody`：请求体的原始 JSON 字符串（不能格式化/重排序）
- `timestamp`：与请求头 `X-Mall-Timestamp` 相同的值

### 验签示例（Node.js）

```javascript
const crypto = require('crypto');

function verifyMallRequest(req) {
    const timestamp = req.headers['x-mall-timestamp'];
    const sig = req.headers['x-mall-signature'];
    const rawBody = req.rawBody; // 原始字节，不要用 JSON.stringify(req.body)

    // 防重放：时间戳误差超过 5 分钟拒绝
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    const expected = crypto
        .createHmac('sha256', process.env.MALL_INTEGRATION_SECRET)
        .update(`${timestamp}\n${rawBody}`)
        .digest('hex');

    // 常数时间比较，防时序攻击
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(sig?.length === expected.length ? sig : '', 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}
```

---

## 接口：装企资料同步

### 请求

```
POST /api/integration/mall/partner/sync
```

### 请求体（JSON）

#### 基础字段（每次都有）

| 字段 | 类型 | 说明 |
|------|------|------|
| `tenantId` | string | CRM 租户 ID（provision 时 CRM 侧返回的） |
| `businessName` | string | 公司名称 |
| `businessType` | string? | 主营业务类型（首个公司类型） |
| `city` | string? | 注册城市 |
| `address` | string? | 详细地址 |
| `tradeRegistrationNo` | string? | 营业执照号 |
| `website` | string? | 官网 |
| `description` | string? | 公司简介 |
| `emiratesServed` | string[] | 服务的酋长国列表 |
| `services` | string[] | 提供的服务类型列表 |

#### 问卷采集字段（字段调研后补充，有值才带）

| 字段 | 类型 | 说明 |
|------|------|------|
| `establishmentYear` | number? | 成立年份（整数，如 2012） |
| `officeType` | string? | 办公室类型（如 "Rented Office"） |
| `oneStopService` | string? | 是否提供一站式服务（如 "Yes" / "No"） |
| `hasConstructionPermit` | boolean? | 是否持有建筑许可证 |
| `totalEmployees` | string? | 员工总数区间（如 "10-50"） |
| `pmTeamSize` | string? | 项目管理团队规模 |
| `designTeamSize` | string? | 设计团队规模 |
| `constructionTeam` | string? | 施工团队规模 |
| `ownerNationality` | string[]? | 业主国籍列表 |
| `mainProjectTypes` | string[]? | 主要项目类型列表 |
| `minProjectValue` | string? | 最小项目金额区间 |
| `maxProjectValue` | string? | 最大项目金额区间 |
| `materialSources` | string[]? | 主要材料来源列表 |
| `latestInterviewId` | number? | 最新实地问卷 ID |
| `lastInterviewedAt` | string? | 最新问卷采集时间（ISO 8601） |

> **约定**：字段缺席（undefined/不存在）表示"本次无变化，保持 CRM 侧现有值"。字段值为 `null` 表示"主动清空"。

### 请求体示例

```json
{
    "tenantId": "crm-tenant-abc123",
    "businessName": "Rizwan Glass and Aluminium LLC",
    "businessType": "Fit-out Contractor",
    "city": "Dubai",
    "address": "Al Quoz Industrial Area 3, Dubai",
    "tradeRegistrationNo": "1234567",
    "website": "https://rizwanglass.com",
    "description": "Specialized in glass and aluminium works",
    "emiratesServed": ["Dubai", "Abu Dhabi"],
    "services": ["Glass Works", "Aluminium Fabrication"],
    "establishmentYear": 2010,
    "officeType": "Rented Office",
    "oneStopService": "Yes",
    "hasConstructionPermit": true,
    "totalEmployees": "50-100",
    "pmTeamSize": "5-10",
    "designTeamSize": "3-5",
    "constructionTeam": "20-50",
    "ownerNationality": ["Pakistani", "UAE"],
    "mainProjectTypes": ["Commercial", "Residential"],
    "minProjectValue": "AED 50K - 200K",
    "maxProjectValue": "AED 1M - 5M",
    "materialSources": ["Local Suppliers", "Import from China"],
    "latestInterviewId": 42,
    "lastInterviewedAt": "2026-06-04T08:30:00.000Z"
}
```

### 响应

成功返回 `2xx`，响应体可以为空或任意 JSON。

失败（`4xx` / `5xx`）时，Mall 会自动重试最多 5 次（指数退避：1s / 2s / 4s / 8s / 16s）。

---

## 触发时机

| 场景 | 触发方式 |
|------|---------|
| 装企在 Mall 更新公司资料 | 保存成功后立即推送 |
| 实地问卷提交 + 双重验证通过 | 合并到 `company_profiles` 后立即推送 |

**双重验证条件**（两者同时满足才触发）：
1. 问卷填写时从 Mall 搜索匹配到了已注册装企（`company_ref_source = 'profile'`）
2. 调研员使用水印相机拍照，照片带有 GPS 经纬度（现场到访证明）

---

## 相关接口（已实现）

| 接口 | 说明 |
|------|------|
| `POST /api/integration/mall/partner/provision` | 首次开通 CRM 账户 |
| `POST /api/integration/mall/partner/sync` | 资料同步（本文档） |
| `POST /api/integration/mall/user/password-sync` | 密码变更同步 |
| `POST /api/integration/mall/user/email-sync` | 邮箱变更同步 |
| `POST /api/integration/mall/sso/issue` | 签发 SSO 跳转 token |

---

## 常见问题

**Q：问卷字段 CRM 侧数据库没有怎么办？**
A：CRM 侧自行决定是否存储这些字段。Mall 只保证"有值就推"，CRM 可以按需忽略不需要的字段。

**Q：`lastInterviewedAt` 是什么时区？**
A：ISO 8601 UTC 格式（末尾带 Z）。

**Q：`latestInterviewId` 有什么用？**
A：CRM 可选用于记录来源，或将来向 Mall 请求完整问卷原始数据时作为 key。Mall 暂未开放完整问卷查询接口，如有需要请联系 Mall 团队。
