# 06 — 询盘与 CRM 系统

## 系统全景

```
用户提交询盘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端处理流程                               │
│                                                                   │
│  ① 手机号校验 → ② 自动去重 → ③ INSERT → ④ 邮件通知 → ⑤ CRM推送  │
│     (同步)       (同步)       (同步)      (异步)       (异步)     │
└─────────────────────────────────────────────────────────────────┘
    │                                             │
    ▼                                             ▼
  用户看到成功提示                           CRM 异步处理
  （不受 CRM 影响）                     pending → synced / failed
```

---

## 一、前端询盘表单

### 三个入口

| 组件 | 位置 | 特点 |
|------|------|------|
| `Banner.tsx` | 首页顶部 | 面积 + 手机号（最精简） |
| `InquiryForm.tsx` | 公司详情页侧边栏 | 姓名 + 手机 + 城市 + 面积 + 留言 |
| `ServiceInquiryCard.tsx` | 服务页 + 公司页 | 支持 minimal/full 模式、inline/card 布局 |

### GCC 手机号选择器

三个表单统一使用 GCC 国家码下拉 + 纯数字输入：

```typescript
const GCC_PHONE_OPTIONS = [
  { label: 'UAE',     code: '+971', maxDigits: 9 },
  { label: 'KSA',     code: '+966', maxDigits: 9 },
  { label: 'Qatar',   code: '+974', maxDigits: 8 },
  { label: 'Kuwait',  code: '+965', maxDigits: 8 },
  { label: 'Oman',    code: '+968', maxDigits: 8 },
  { label: 'Bahrain', code: '+973', maxDigits: 8 },
];
```

**输入限制**：
- `inputMode="numeric"` — 手机弹数字键盘
- `onChange` 正则过滤非数字：`value.replace(/\D/g, '').slice(0, maxDigits)`
- `maxLength` 硬限制

### 垃圾号码检测（前端）

```typescript
const isSpamPhone = phoneDigits.length > 0 && /(.)\1{4,}/.test(phoneDigits);
// 5+ 连续相同数字 → 红色边框 + 错误提示 + 禁用提交
```

---

## 二、后端验证

**文件**: `server/src/controllers/inquiryController.ts`

### 校验链

```
POST /api/inquiries
  ├── 1. 必填校验: phone + area_range
  ├── 2. 位数校验: 纯数字 10-15 位
  ├── 3. 垃圾号检测: 后 9 位含 5+ 连续相同数字 → 400
  ├── 4. 城市校验: city ∈ VALID_CITIES
  ├── 5. 面积校验: area_range ∈ VALID_AREA_RANGES
  └── 通过 → 继续处理
```

### 自动去重

```typescript
// 提交新 inquiry 前，soft-delete 同手机号的旧记录
const normalizedPhone = phone.replace(/\D/g, '');
if (normalizedPhone.length >= 7) {
  await pool.execute(
    `UPDATE design_inquiries
     SET deleted_at = NOW(),
         admin_notes = CONCAT(IFNULL(admin_notes,''), ' [auto-dedup]')
     WHERE REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','')
           LIKE ?
       AND deleted_at IS NULL`,
    [`%${normalizedPhone.slice(-9)}`]
  );
}
```

**去重策略**：取手机号后 9 位匹配（忽略国家码差异），旧记录 soft-delete 而非物理删除，admin_notes 标注 `[auto-dedup]`。

---

## 三、CRM 异步同步

### 文件: `server/src/lib/crmPush.ts`

### 配置

| 环境变量 | 说明 |
|----------|------|
| `CRM_INBOUND_URL` | CRM API 地址 |
| `CRM_API_KEY` | API 密钥（x-api-key header） |
| `CRM_TENANT_ID` | 租户 ID |
| `CRM_TRAFFIC_CHANNEL_ID` | 流量渠道 ID（可选） |

**任一缺失 → 静默跳过，inquiry 状态停留在 pending。**

### 推送流程

```
submitInquiry()
  ├── INSERT INTO design_inquiries → 返回 201 给用户
  ├── setImmediate(() => {                    ← 异步，不阻塞响应
  │     notifyNewInquiry(...)                 ← 邮件通知
  │   })
  └── pushLeadToCRM({...}).catch(() => {})   ← fire-and-forget
        ├── POST {CRM_INBOUND_URL}
        │   headers: { x-api-key, Content-Type: application/json }
        │   body: { source, tenantId, externalId, name, phone, ... }
        │   timeout: 5 秒 (AbortSignal.timeout)
        │
        ├── 成功: HTTP 2xx + body.code === 0
        │   └── markSynced(inquiryId, leadId, action)
        │       UPDATE crm_sync_status='synced', crm_lead_id, crm_action
        │
        └── 失败: HTTP 非 2xx / body.code !== 0 / 网络错误
            └── markFailed(inquiryId, errorPayload)
                UPDATE crm_sync_status='failed', crm_last_error=JSON
```

### 双重校验

CRM 可能返回 HTTP 200 但 `code !== 0`（业务级失败）。必须同时满足：
1. `response.ok` (HTTP 2xx)
2. `data.code === 0`

才标记为 synced。

### DB 字段

```sql
ALTER TABLE design_inquiries ADD COLUMN
  crm_synced_at      DATETIME NULL,
  crm_sync_status    ENUM('pending','synced','failed') DEFAULT 'pending',
  crm_lead_id        VARCHAR(64) NULL,    -- CRM 返回的 Lead UUID
  crm_action         VARCHAR(32) NULL,    -- created/updated/linked/duplicate
  crm_last_error     TEXT NULL,           -- JSON 错误详情
  crm_sync_attempts  INT DEFAULT 0;       -- 推送尝试次数
```

### CRM Action 含义

| Action | 含义 | Admin 显示 |
|--------|------|-----------|
| `created` | 新 lead 创建 | 绿色 badge |
| `updated` | 已有 lead 更新 | 绿色 badge |
| `linked` | 合并到已有 lead | 黄色警告 badge + "merged → check lead" |
| `duplicate` | 重复 lead | 绿色 badge |

`linked` 状态特别标黄——表示 CRM 把这条 inquiry 合并到了一个已有的 lead 里，运营团队可能不会注意到。

### Admin 手动重试

**后端**: `POST /api/admin/inquiries/:id/resend-crm`

```
Admin 点击 "Resend" 按钮
  ├── 查询 inquiry 记录
  ├── 构建 LeadPayload
  ├── await pushLeadToCRM(lead)  ← 这里是 await，非 fire-and-forget
  ├── 重新查询更新后的 inquiry
  └── 返回 { success: true/false, leadId, action, inquiry }
```

**前端** (`AdminInquiriesPage.tsx`): CRM 列显示 synced/failed/pending badge + Resend/Send now 按钮。

---

## 四、Admin Inquiry 管理

### 功能列表

| 功能 | 说明 |
|------|------|
| 列表查看 | 分页 + 状态筛选 + 搜索（姓名/手机/公司） |
| 状态流转 | new → contacted → resolved → archived |
| Admin 备注 | 每条 inquiry 可添加 admin_notes |
| CRM 状态 | synced(绿)/failed(红)/pending(灰) + Resend 按钮 |
| Excel 导出 | 一键导出为 .xlsx |
| 批量软删除 | 选中 → 输入删除原因 → soft delete + 审计日志 |
| 批量恢复 | 回收站视图 → 选中 → 恢复 |
| 审计日志 | 每次删除记录 admin_id + reason + 完整数据快照 |

### Soft Delete 审计

```typescript
// 删除前保存完整数据快照
const [snapshot] = await pool.execute(
  `SELECT * FROM design_inquiries WHERE id IN (?) AND deleted_at IS NULL`,
  [ids]
);

// Soft delete
await pool.execute(
  `UPDATE design_inquiries SET deleted_at = NOW(), deleted_by = ? WHERE id IN (?)`,
  [adminId, ...activeIds]
);

// 写入审计日志
await pool.execute(
  `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
   VALUES (?, ?, 'delete_inquiry', 'inquiry', ?, ?, ?)`,
  [adminId, adminName, JSON.stringify(activeIds), reason, JSON.stringify({ snapshot })]
);
```

即使误删也能从 `admin_audit_log.metadata` 中恢复原始数据。
