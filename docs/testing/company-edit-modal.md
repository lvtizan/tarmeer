# Test Cases: Company Edit Modal Redesign

**Feature**: CompanyEditModal — 宽度拉大、Company Type 多选、Services 分类 Tab

## TC-1: 弹层尺寸与圆角

**前置**: 进入 `/admin/companies`，点进任一公司，点「编辑」

**验证点**:
- 弹层宽度约为屏幕宽度的 50%（最小 640px，最大 900px）
- 弹层四角圆角（rounded-2xl = 20px）
- 遮罩点击关闭弹层
- ✕ 按钮点击关闭弹层

---

## TC-2: Company Type 多选

**前置**: 打开编辑弹层（注册装企，type=profile）

**验证点**:
1. Company Type 点击后展开下拉，每个选项有复选框
2. 勾选多个类型 → 触发按钮显示 "Renovation & Fit-out, Design Studio"（逗号拼接）
3. 再次点击已选项 → 取消勾选，从显示列表移除
4. 点击下拉列表外部 → 下拉自动收起
5. 保存后重新打开编辑 → 多选类型仍保留（持久化验证）

---

## TC-3: Company Type 数据来源动态

**验证点**:
- Company Type 选项来自 `/api/admin/enums/company-types`，非硬编码
- 在「类型与服务」管理页新增一个类型 → 重新打开编辑弹层 → 新类型出现在下拉中
- 在「类型与服务」管理页禁用一个类型（active=0） → 重新打开编辑弹层 → 该类型不出现

---

## TC-4: Services 分类 Tab

**前置**: 打开编辑弹层

**验证点**:
1. Services 区域顶部显示分类 Tab（来自 `/api/admin/enums/service-categories`）
2. 默认选中第一个 Tab，显示该分类下的服务标签
3. 点击其他 Tab → 切换显示对应分类的服务，已选中的 Tab 高亮（金色背景）
4. 某 Tab 下有已选服务 → Tab 右侧出现数字徽章（如 "Interior ③"）
5. 服务标签点击切换选中/取消，选中为金色背景

---

## TC-5: Services 数据来源动态

**验证点**:
- 服务项来自 `/api/admin/enums/company-services`，按 `category` 字段分组
- 在「类型与服务」管理页新增一个服务并分配类别 → 重新打开编辑弹层 → 新服务出现在对应 Tab

---

## TC-6: 表单元素高度统一

**验证点**:
- 所有 `<input>` 高度为 36px（h-9）
- 所有下拉（AdminSelect、Company Type multi-select）高度为 36px（h-9）
- 视觉上各行元素对齐，无高低不平

---

## TC-7: 保存功能正常

**验证点**:
1. 修改 Company Name → Save Changes → 刷新页面 → 修改已保存
2. 多选 2 种 Company Type → Save → 重新打开 → 两种类型均已选中
3. 切换 Tab 选中服务 → Save → 重新打开 → 所选服务仍在
4. 无权限 token → PUT → 401 / 403

---

## TC-8: 边界情况

- Company Type 为空数组 → 显示占位文字 "Select types…"
- 某分类下无服务（空 category 分配） → 显示 "No services in this category"
- 数据加载中 → 显示 "Loading…"
