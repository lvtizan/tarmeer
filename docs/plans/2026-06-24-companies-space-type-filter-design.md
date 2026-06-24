# 公司空间类型筛选（别墅）+ 金牌置顶 — 设计文档

日期：2026-06-24
分支：hind
范围：AE 站（VN 不动，见下）

## 背景 / 问题

网站顶部「找公司」导航点击「别墅 / Villa」时，有能力做别墅的金牌装企（`is_signed`）**一家都筛不出来**，更谈不上置顶展示。

### 根因（已核实）

链路（AE）：

1. 导航「Villa」→ `/companies?style=Villa`（`server/dist/routes/site.js:38`）
2. `/companies` 页把全部公司（最多 300）拉到前端，**纯客户端筛选**（`src/components/companies/CompaniesClient.tsx:263`）：
   ```js
   selectedStyles.some((s) => company.styles.includes(s)) // 大小写敏感精确匹配 "Villa"
   ```
3. `company.styles` 来自 DB `specialties` 字段，是**自由文本逗号分隔**值（导入示例 `'Villa, Residential, Commercial, Hospitality'`，见 `server/dist/services/companyImportService.js:31`）

**根因**：前端做大小写敏感的精确字符串匹配。specialties 里写成 `Luxury Villa` / `Townhouse` / `villa`（小写）/ 别的写法的公司全部被筛掉。

对比：后端 `server/dist/lib/publicCompaniesQuery.js` 早有正确的 `SPACE_L2_MAP` 分组（villa→`['Villa','Luxury Villa','Townhouse']`），但该后端路径**这个页面没用到**（页面是前端筛选），前端缺等价的匹配层。

此外 `/site/space-types` 接口 **DB 优先**（`site.js:57`）：生产 `system_config.space_types_ae` 早已种入旧的 `style=` 链接，只改代码默认值对生产不生效。

## 需求口径（已与用户确认）

- **能力判定来源**：specialties 空间标签（Villa/Luxury Villa/Townhouse，大小写+别名归一）
- **金牌定义**：`is_signed`（列表卡 Gold 徽章）
- **排序**：金牌且有能力的**强制置顶**，组内再按现有 weight_score
- **空间类型筛选区**：固定显示全部 5 个空间类型
- **VN**：本次不动（数据核实：VN 80 家公司 specialties 填充率 0/80，切 `space=` 会筛出 0 家；让 VN 生效的前置是先补 VN specialties 数据，属另一任务）

## 方案 B（已选）

概念干净：导航与筛选统一走规范的 `?space=<key>` 参数，前端新增独立「空间类型」筛选区，匹配走专用别名层。

### 1. 匹配层（`src/lib/serviceCategories.ts`，单一逻辑源）

```ts
// 跨运行时复刻后端 publicCompaniesQuery.js 的 SPACE_L2_MAP；两边改动须同步（加注释互指）
export const SPACE_TYPE_MAP: Record<string, string[]> = {
  villa:      ['Villa', 'Luxury Villa', 'Townhouse'],
  apartment:  ['Apartment', 'Penthouse', 'Studio'],
  commercial: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall', 'Commercial'],
  public:     ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  outdoor:    ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
};
export const SPACE_TYPE_LABELS: Record<string, string> = {
  villa: 'Villa', apartment: 'Apartment', commercial: 'Commercial',
  public: 'Public / Institutional', outdoor: 'Outdoor / Landscape',
};
export const SPACE_TYPE_KEYS = ['villa','apartment','commercial','public','outdoor'] as const;

// 大小写不敏感 + 别名 + 关键词子串匹配
export function companyHasSpaceType(specialties: string[], spaceKey: string): boolean {
  const key = spaceKey.toLowerCase();
  const tags = SPACE_TYPE_MAP[key];
  if (!tags) return false;
  const lc = specialties.map((s) => s.toLowerCase());
  return lc.some((sp) => sp.includes(key) || tags.some((t) => {
    const tl = t.toLowerCase();
    return sp === tl || sp.includes(tl);
  }));
}
```

### 2. 后端 `server/dist/routes/site.js`

AE 的 `DEFAULT_SPACE_TYPES` 改为规范 key（顺带修好 Public→`style=Office`、Outdoor→`service=Landscape` 历史错配）：

```js
ae: [
  { key: 'Villa',                  to: '/companies?space=villa' },
  { key: 'Apartment',              to: '/companies?space=apartment' },
  { key: 'Commercial',             to: '/companies?space=commercial' },
  { key: 'Public / Institutional', to: '/companies?space=public' },
  { key: 'Outdoor / Landscape',    to: '/companies?space=outdoor' },
],
// vn: 不动
```

本 worktree 无 server/src、无 tsc → 直接改 dist，部署走 rsync。

### 3. 生产 DB（部署阶段执行）

`/space-types` DB 优先，生产 `space_types_ae` 行已存旧链接，必须更新：

```sql
-- 先备份查看
SELECT config_value FROM system_config WHERE config_key='space_types_ae';
-- 再更新为新的 space= 链接（JSON 同 DEFAULT_SPACE_TYPES.ae）
UPDATE system_config SET config_value='[...]' WHERE config_key='space_types_ae';
```

须 SSH 服务器、用服务器 `.env` 连生产库执行。

### 4. 前端 `CompaniesClient.tsx`

- 新增 `selectedSpaceTypes` state，从 `searchParams.get('space')` 初始化；`useEffect([searchParams])` 同步（与现有 service/style 同步逻辑并列）。
- 侧边栏 `renderFilters` 新增「Space Type」区：**固定渲染 5 个** `SPACE_TYPE_KEYS`，label 取 `SPACE_TYPE_LABELS`。
- `filteredCompanies` 加条件：
  ```js
  if (selectedSpaceTypes.length > 0 &&
      !selectedSpaceTypes.some((st) => companyHasSpaceType(company.styles, st))) return false;
  ```
- Active filter chips、`clearAllFilters`、`hasActiveFilters`、`useMemo` 依赖数组全部纳入 `selectedSpaceTypes`。

### 5. 排序：金牌置顶

当存在 capability 筛选（`selectedSpaceTypes` / `selectedStyles` / `selectedServices` 任一非空）时，对 `filteredCompanies` 做**稳定排序**（JS sort 稳定）：`isSigned` 置顶，其余保持服务端 weight_score 原序。

```js
const sorted = (selectedSpaceTypes.length || selectedStyles.length || selectedServices.length)
  ? [...filtered].sort((a, b) => Number(b.isSigned) - Number(a.isSigned))
  : filtered;
```

无筛选时不动默认排序。

## 错误处理 / 边界

- specialties 为空数组 → `companyHasSpaceType` 返回 false（不误命中）。
- `?space=` 传入未知 key → `SPACE_TYPE_MAP[key]` 为 undefined → 返回 false，不报错。
- 子串匹配防误命中：`office` 在 commercial 标签里，但 specialties 很少出现包含 office 的别墅词，风险低；如发现误命中再收紧为精确等值。

## 测试（AGENTS.md 第六步）

1. `companyHasSpaceType` 纯函数用例：
   - villa 命中 `'Luxury Villa'` / `'townhouse'` / `'Villa'`
   - villa **不**命中 `['Apartment','Office']`
   - 空数组不命中
2. `node scripts/harness/smoke-test.mjs`（tsc + 路由 + 前端可达）全绿
3. 本地 `node_modules/.bin/next build` exit=0
4. 浏览器实测 `/companies?space=villa`：有别墅能力的金牌公司出现且置顶

## 部署影响

前端部署（src/）+ 后端 rsync（`server/dist/routes/site.js`）+ 生产 DB 一条 UPDATE + `pm2 restart tarmeer-api`。

## 不做（YAGNI）

- 不改 VN（数据不支持，需先补 specialties）
- 不把页面改成服务端筛选（保持现有全量+客户端筛选模型，与 style/service 一致）
- 不新建后台 space_types 编辑 UI（本次用 SQL 更新即可）
