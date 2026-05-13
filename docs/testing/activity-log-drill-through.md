# Activity Log Drill-Through Links — Test Cases

## Feature
操作记录页面中的公司名、用户名、对象名可点击，点击后跳转到对应详情页，并携带"返回操作记录"的来源状态。

## Test Cases

### 1. 目录装企条目可点 (target_type = 'company' or 'uae_company')
- 操作记录中出现 target_type = 'company' 或 'uae_company' 的条目
- 期望：target_name 渲染为金色 Link
- 点击后跳转到 `/admin/companies/:target_id`
- 详情页顶部显示"返回操作记录"按钮

### 2. 注册装企条目可点 (target_type = 'company_profile')
- 操作记录中出现 target_type = 'company_profile' 的条目
- 期望：target_name 渲染为金色 Link
- 点击后跳转到 `/admin/profile-companies/:target_id`
- 详情页顶部显示"返回操作记录"按钮

### 3. 用户条目可点 (target_type = 'user')
- 操作记录中出现 target_type = 'user' 的条目
- 期望：target_name 渲染为金色 Link
- 点击后跳转到 `/admin/users/:target_id`
- 详情页顶部显示"返回操作记录"按钮

### 4. 操作人（装企/业主）可点
- 条目的 user_id 非空，user_role = 'company' 或 'homeowner'
- 期望：用户名渲染为金色 Link
- 点击后跳转到 `/admin/users/:user_id`
- 用户详情页顶部显示"返回操作记录"按钮

### 5. 管理员操作人点击 → 时间轴
- 条目的 user_role = 'admin'
- 期望：用户名渲染为 Link，但点击时 preventDefault，触发 onUserClick 跳转到时间轴视图

### 6. 无 target_id 条目不显示链接
- 条目 target_id 为 null（如 login、register 事件）
- 期望：description 以普通文本显示，无 Link

### 7. inquiry 类型不显示实体链接
- target_type = 'inquiry'
- 期望：显示 metadata 摘要（公司、提交人、城市等），不显示 Link

### 8. 展开子条目时每条也可点
- 多条相同用户+操作聚合后展开
- 期望：每条展开的 EntryDetail 中 target_name 也是可点 Link，携带相同 state

### 9. 无 target_name 但 target_id 存在
- target_name 为 null，target_id 有值
- 期望：Link 显示 `#${target_id}` 作为 fallback 文字

### 10. state 传递正确
- 从操作记录点击装企/用户跳转到详情页
- 详情页 `useLocation().state` = `{ from: '/admin/activity-log', fromLabel: '操作记录' }`
- 点击"返回操作记录"跳回到 `/admin/activity-log`

## Edge Cases
- target_type 为未知类型（如 'session'、'homeowner_profile'）→ getTargetPath 返回 null → 不显示链接
- 匿名访客（user_id 为 null）→ 不显示用户 Link，显示访客标签
- description 字符串中不包含 target_name 子串 → descNode 回退到纯文本 description
