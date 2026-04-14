# 03 — 公司系统

## 架构总览

```
                      ┌─────────────────────────────┐
                      │        公司数据双源           │
                      └─────────────────────────────┘

┌─────────────────┐                     ┌─────────────────┐
│  uae_companies   │                     │ company_profiles │
│  (爬虫目录)      │                     │  (注册公司)       │
│  87 家真实公司   │                     │  用户自行注册     │
│  有 portfolio    │                     │  需审核通过       │
└────────┬────────┘                     └────────┬────────┘
         │                                       │
         └──────────────┬────────────────────────┘
                        ▼
              publicCompanyController.ts
                (合并 + 去重 + 排序)
                        │
                        ▼
                  CompaniesPage.tsx
                   (统一展示)
```

---

## 一、双数据源合并

### 合并规则（可靠性不变量）

1. **目录公司永远排前面**（有 portfolio 图片）
2. **注册公司追加到后面**（可能没有图片）
3. **按公司名去重**（lowercase 匹配）
4. **绑定后合并**：注册公司绑定到目录公司（`owner_user_id`）后合为一条

### 前端实现

**文件**: `src/lib/publicApi.ts`

```typescript
export async function fetchPublicCompanies() {
  const [directoryRes, approvedRes] = await Promise.all([
    fetch('/api/companies'),        // 目录公司
    fetch('/api/public/companies'), // 注册公司
  ]);

  // 目录公司排前面
  const merged = [...directoryCompanies];

  // 注册公司去重后追加
  const directoryNames = new Set(directoryCompanies.map(c => c.name.toLowerCase()));
  for (const company of approvedCompanies) {
    if (!directoryNames.has(company.name.toLowerCase())) {
      merged.push(company);
    }
  }

  return merged;
}
```

---

## 二、权重评分系统

### 评分配置

**表**: `weight_config`

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `base_profile_score` | 50 | 基础资料填完得分 |
| `per_project_score` | 10 | 每个项目得分 |
| `signed_score` | 500 | 签约公司加分 |

### 排序逻辑

```
签约公司 (is_signed=1) 永远排最前
  → weight_score 降序
    → display_order 升序
      → 创建时间降序
```

---

## 三、公司后台

### 路由结构

```
/company
  ├── /dashboard  → CompanyDashboardPage
  ├── /projects   → CompanyProjectsPage
  └── /settings   → SettingsPage
```

### Dashboard 功能

| 板块 | 内容 |
|------|------|
| 公司信息 | 名称、logo、描述、联系方式 |
| 统计概览 | 项目数、浏览量、询盘数 |
| 最近询盘 | 最新 5 条 inquiry |

### 项目管理 (CompanyProjectsPage)

**功能矩阵**：

| 功能 | 说明 |
|------|------|
| 创建项目 | 标题、描述、风格、位置、面积、标签 |
| 图片上传 | 多图拖拽上传 + 排序 + 封面设置 |
| URL 抓取 | 输入 URL → 自动抓取页面图片导入 |
| 编辑项目 | 修改所有字段 + 图片增删改 |
| 删除项目 | 软删除 |
| 项目列表 | 已有项目卡片展示 |

**风格选项**：Modern Contemporary / Modern Islamic / Neo-Classic / Minimalist / Industrial

**标签**：Apartment / Villa / Bathroom / Kitchen / Living / Bedroom / Majlis / Dining / Workspace / Outdoor / Lighting / Storage / Renovation / Materials

**城市**：Dubai / Abu Dhabi / Sharjah / Ajman / Ras Al Khaimah / Fujairah / Umm Al Quwain / Riyadh / Jeddah / Other

---

## 四、项目图片存储

**文件**: `server/src/lib/projectImageStorage.ts`

### 存储流程

```
前端上传（base64 data URL）
  │
  ▼
projectImageStorage.persistProjectImages(images, designerId, projectId)
  ├── 遍历每张图片
  ├── 如果是 base64 data URL:
  │   ├── 提取 MIME 类型和数据
  │   ├── 生成路径: /uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}
  │   ├── 创建目录 (mkdir -p)
  │   ├── 写入文件 (fs.writeFile)
  │   ├── 生成变体 (generateVariants) ← 自动生成 blur/thumb/medium WebP
  │   └── 返回相对路径
  └── 如果是 URL 路径 → 保持不变
```

### 上传限制

**文件**: `src/lib/projectImageUpload.ts`

| 限制 | 值 |
|------|-----|
| 单次上传总 payload | 18 MB |
| 总上传大小 | 50 MB |
| 单张估算 | base64 大小 × 0.75（解码后） |

---

## 五、项目自动发布

当 Admin 审核通过一家公司时，级联操作：

```
Admin approves company_profile
  ├── UPDATE company_profiles SET status = 'approved'
  └── UPDATE projects SET status = 'published'
      WHERE company_profile_id = ? AND status IN ('pending', 'draft')
```

之后该公司新提交的项目也会自动发布（不需要逐个审核）。

反之，如果 Admin 取消审核（bulk unapprove）：
```
  ├── UPDATE company_profiles SET status = 'pending'
  ├── CLEAR home_display_order, list_display_order
  └── UPDATE projects SET status = 'draft'
```

---

## 六、公司合并

**文件**: `server/src/controllers/companyMergeController.ts`

当注册公司与爬虫目录中的公司是同一家时，Admin 可以执行合并：

```
Admin 操作: "绑定公司 A (注册) 到 目录公司 B"
  ├── UPDATE uae_companies SET owner_user_id = ? WHERE id = ?
  ├── 注册公司的 profile 数据补充到目录公司字段
  └── 前端列表中合并显示为一条（目录公司优先）
```

---

## 六、分类归一化

**文件**: `src/lib/categoryNormalize.ts`

爬虫抓取的 180 个原始分类通过关键词启发式映射到 ~10 个显示名：

```typescript
// 输入: "Modern Arabic Bedroom Design", "Kitchen & Dining", "مطبخ"
// 输出: "Bedroom", "Kitchen", "Kitchen"

const CATEGORY_MAP = {
  bedroom: ['bedroom', 'غرفة نوم', 'master bed', ...],
  kitchen: ['kitchen', 'مطبخ', 'dining', ...],
  living: ['living', 'صالة', 'lounge', 'salon', ...],
  bathroom: ['bathroom', 'حمام', 'wc', 'toilet', ...],
  // ... ~10 个分类
};
```
