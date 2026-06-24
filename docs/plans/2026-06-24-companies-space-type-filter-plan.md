# 公司空间类型(别墅)筛选 + 金牌置顶 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AE 站「找公司」点击空间类型(别墅等)时，把有该能力的公司(含别名/大小写写法)全部筛出，并将金牌(`is_signed`)公司置顶。

**Architecture:** 统一走规范 `?space=<key>` 参数。前端新增 `companyHasSpaceType` 别名匹配层(对齐后端 `SPACE_L2_MAP`)，`CompaniesClient` 新增空间类型筛选区 + state + 金牌稳定排序。后端 `site.js` 导航链接改 `space=`，生产 `system_config` 同步更新。VN 不动(specialties 填充率 0/80)。

**Tech Stack:** Next.js(App Router, 前端客户端筛选)、TypeScript、Express(后端 dist JS)、MySQL system_config、Node 25 原生 TS 测试。

设计文档：`docs/plans/2026-06-24-companies-space-type-filter-design.md`

---

## File Structure

- `src/lib/serviceCategories.ts` — 新增 `SPACE_TYPE_MAP` / `SPACE_TYPE_LABELS` / `SPACE_TYPE_KEYS` / `companyHasSpaceType()`（与 `companyHasService` 并列的匹配层）
- `scripts/harness/space-type-test.mjs` — `companyHasSpaceType` 纯函数行为用例（新建）
- `server/dist/routes/site.js` — AE `DEFAULT_SPACE_TYPES` 链接改 `space=`（VN 不动）
- `src/components/companies/CompaniesClient.tsx` — `selectedSpaceTypes` state、URL 同步、筛选区 UI、筛选条件、active chips、clearAll、hasActiveFilters、金牌稳定排序

---

## Task 1: 空间类型匹配层 + 纯函数用例

**Files:**
- Modify: `src/lib/serviceCategories.ts`（在文件末尾、`companyHasService` 之后追加）
- Test: `scripts/harness/space-type-test.mjs`（新建）

- [ ] **Step 1: 写失败用例**

新建 `scripts/harness/space-type-test.mjs`：

```js
#!/usr/bin/env node
/**
 * space-type-test.mjs — 空间类型匹配层行为用例
 * 用法: node scripts/harness/space-type-test.mjs
 * 覆盖: companyHasSpaceType 大小写/别名/子串/空数组/未知key
 */
import { companyHasSpaceType, SPACE_TYPE_KEYS, SPACE_TYPE_LABELS } from '../../src/lib/serviceCategories.ts';

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${label} — got ${got}, want ${want}`); fail++; }
}

console.log('companyHasSpaceType:');
eq('villa 命中 "Villa"',            companyHasSpaceType(['Villa'], 'villa'), true);
eq('villa 命中 "Luxury Villa"',     companyHasSpaceType(['Luxury Villa'], 'villa'), true);
eq('villa 命中小写 "townhouse"',    companyHasSpaceType(['townhouse'], 'villa'), true);
eq('villa 不命中 Apartment/Office', companyHasSpaceType(['Apartment', 'Office'], 'villa'), false);
eq('villa 空数组不命中',            companyHasSpaceType([], 'villa'), false);
eq('commercial 命中 "Retail"',      companyHasSpaceType(['Retail'], 'commercial'), true);
eq('commercial 命中 "Commercial"',  companyHasSpaceType(['Commercial'], 'commercial'), true);
eq('outdoor 命中 "Garden"',         companyHasSpaceType(['Garden'], 'outdoor'), true);
eq('apartment 命中 "Penthouse"',    companyHasSpaceType(['Penthouse'], 'apartment'), true);
eq('public 命中 "School"',          companyHasSpaceType(['School'], 'public'), true);
eq('未知 key 不命中',               companyHasSpaceType(['Villa'], 'spaceship'), false);

console.log('常量:');
eq('SPACE_TYPE_KEYS 有 5 个',       SPACE_TYPE_KEYS.length, 5);
eq('villa 有 label',                SPACE_TYPE_LABELS.villa, 'Villa');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 跑用例确认失败**

Run: `node scripts/harness/space-type-test.mjs`
Expected: 报错 `does not provide an export named 'companyHasSpaceType'`（函数还没写）

- [ ] **Step 3: 实现匹配层**

在 `src/lib/serviceCategories.ts` 末尾追加：

```ts
/**
 * 空间类型 → specialties 旧值映射。跨运行时复刻后端 server/dist/lib/publicCompaniesQuery.js
 * 的 SPACE_L2_MAP；任一侧改动须同步另一侧。
 */
export const SPACE_TYPE_MAP: Record<string, string[]> = {
  villa: ['Villa', 'Luxury Villa', 'Townhouse'],
  apartment: ['Apartment', 'Penthouse', 'Studio'],
  commercial: ['Retail', 'Office', 'Restaurant', 'Hotel', 'Hospitality', 'Showroom', 'Mall', 'Commercial'],
  public: ['School', 'Education', 'Healthcare', 'Hospital', 'Club', 'Factory', 'ADU', 'Mixed-Use'],
  outdoor: ['Garden', 'Terrace', 'Pool', 'Fence', 'Driveway', 'Landscape'],
};

export const SPACE_TYPE_KEYS = ['villa', 'apartment', 'commercial', 'public', 'outdoor'] as const;

export const SPACE_TYPE_LABELS: Record<string, string> = {
  villa: 'Villa',
  apartment: 'Apartment',
  commercial: 'Commercial',
  public: 'Public / Institutional',
  outdoor: 'Outdoor / Landscape',
};

/** 公司 specialties 是否覆盖某空间类型（大小写不敏感 + 别名 + 关键词子串）。 */
export function companyHasSpaceType(specialties: string[], spaceKey: string): boolean {
  const key = spaceKey.toLowerCase();
  const tags = SPACE_TYPE_MAP[key];
  if (!tags) return false;
  const lc = specialties.map((s) => s.toLowerCase());
  return lc.some((sp) =>
    sp.includes(key) || tags.some((t) => {
      const tl = t.toLowerCase();
      return sp === tl || sp.includes(tl);
    })
  );
}
```

- [ ] **Step 4: 跑用例确认通过**

Run: `node scripts/harness/space-type-test.mjs`
Expected: `13 passed, 0 failed`（退出码 0）；可能出现 `MODULE_TYPELESS_PACKAGE_JSON` warning，无害。

- [ ] **Step 5: 提交**

```bash
git add src/lib/serviceCategories.ts scripts/harness/space-type-test.mjs
git commit -m "feat(companies): 新增 companyHasSpaceType 空间类型别名匹配层 + 用例"
```

---

## Task 2: 后端导航链接改 space= (AE)

**Files:**
- Modify: `server/dist/routes/site.js:37-43`（仅 `DEFAULT_SPACE_TYPES.ae`，VN 不动）

- [ ] **Step 1: 改 AE 默认链接**

把 `server/dist/routes/site.js` 中 `DEFAULT_SPACE_TYPES.ae` 数组（当前 37-43 行）替换为：

```js
    ae: [
        { key: 'Villa', to: '/companies?space=villa' },
        { key: 'Apartment', to: '/companies?space=apartment' },
        { key: 'Commercial', to: '/companies?space=commercial' },
        { key: 'Public / Institutional', to: '/companies?space=public' },
        { key: 'Outdoor / Landscape', to: '/companies?space=outdoor' },
    ],
```

`vn` 数组保持不变。

- [ ] **Step 2: 语法自检**

Run: `node --check server/dist/routes/site.js`
Expected: 无输出（退出码 0）

- [ ] **Step 3: 提交**

```bash
git add server/dist/routes/site.js
git commit -m "feat(site): AE 找公司导航改用 space= 规范参数(修 Public/Outdoor 错配)"
```

> 注：生产 `system_config.space_types_ae` 行需在部署阶段单独 UPDATE（见 Task 6），改代码默认值对已种行不生效。

---

## Task 3: 前端 — space state + URL 同步 + 筛选条件

**Files:**
- Modify: `src/components/companies/CompaniesClient.tsx`（import 行 11；state ~209；useEffect ~225；filteredCompanies ~251；clearAll ~275；hasActiveFilters ~284）

- [ ] **Step 1: 扩展 import**

把第 11 行：

```ts
import { companyHasService } from '@/lib/serviceCategories';
```

改为：

```ts
import { companyHasService, companyHasSpaceType, SPACE_TYPE_KEYS, SPACE_TYPE_LABELS } from '@/lib/serviceCategories';
```

- [ ] **Step 2: 新增 selectedSpaceTypes state**

在 `selectedStyles` 的 `useState`(当前 209-212 行) 之后插入：

```tsx
  const [selectedSpaceTypes, setSelectedSpaceTypes] = useState<string[]>(() => {
    const s = searchParams.get('space');
    return s ? [s] : [];
  });
```

- [ ] **Step 3: URL 同步 useEffect 补 space**

把现有同步 useEffect（当前 225-230 行）改为：

```tsx
  useEffect(() => {
    const svc = searchParams.get('service');
    setSelectedServices(svc ? [svc] : []);
    const sty = searchParams.get('style');
    setSelectedStyles(sty ? [sty] : []);
    const spc = searchParams.get('space');
    setSelectedSpaceTypes(spc ? [spc] : []);
  }, [searchParams]);
```

- [ ] **Step 4: filteredCompanies 加 space 条件 + 依赖**

在 `filteredCompanies` 的 `companies.filter` 内，`selectedStyles` 那行(当前 263 行)之后插入：

```tsx
      if (selectedSpaceTypes.length > 0 && !selectedSpaceTypes.some((st) => companyHasSpaceType(company.styles, st))) return false;
```

并把该 `useMemo` 的依赖数组(当前 273 行)改为：

```tsx
  }, [companies, searchQuery, selectedCity, selectedType, selectedStyles, selectedServices, selectedSpaceTypes, foundedRange]);
```

- [ ] **Step 5: clearAll + hasActiveFilters 纳入 space**

`clearAllFilters`(当前 275-282 行) 内加一行：

```tsx
    setSelectedSpaceTypes([]);
```

`hasActiveFilters` 的 `useMemo`(当前 284-286 行) 改为：

```tsx
  const hasActiveFilters = useMemo(() => {
    return Boolean(searchQuery || selectedCity || selectedType || selectedStyles.length > 0 || selectedServices.length > 0 || selectedSpaceTypes.length > 0 || foundedRange);
  }, [searchQuery, selectedCity, selectedType, selectedStyles, selectedServices, selectedSpaceTypes, foundedRange]);
```

- [ ] **Step 6: 类型检查**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 无 `CompaniesClient.tsx` 相关报错（未使用变量在 UI 接好前可能短暂出现，下一 Task 接 UI；若 tsc 因 unused 报错，可先继续 Task 4 再统一验）

- [ ] **Step 7: 提交**

```bash
git add src/components/companies/CompaniesClient.tsx
git commit -m "feat(companies): 读取 ?space= 参数并按空间类型筛选公司"
```

---

## Task 4: 前端 — 空间类型筛选区 UI + active chips

**Files:**
- Modify: `src/components/companies/CompaniesClient.tsx`（renderFilters City 区之后 ~312；active chips ~491）

- [ ] **Step 1: 侧边栏新增 Space Type 区（固定 5 个）**

在 City 区块的结束 `<hr className="border-stone-100" />`(当前 312 行) 之后、Company Type 区块之前插入：

```tsx
      {/* Space Type */}
      <div>
        <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">{tr.nav.spaceType}</h4>
        <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-1'}>
          {SPACE_TYPE_KEYS.map((key) => (
            <FilterOption
              compact={compact}
              key={key}
              selected={selectedSpaceTypes.includes(key)}
              onClick={() => setSelectedSpaceTypes((prev) =>
                prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
              )}
            >
              {SPACE_TYPE_LABELS[key]}
            </FilterOption>
          ))}
        </div>
      </div>

      <hr className="border-stone-100" />
```

- [ ] **Step 2: active filter chips 加 space**

在 active filters 区，`selectedStyles.map(...)` chips 块(当前 491-493 行) 之前插入：

```tsx
              {selectedSpaceTypes.map((st) => (
                <ActiveFilterChip key={st} label={SPACE_TYPE_LABELS[st] || st} onRemove={() => setSelectedSpaceTypes((prev) => prev.filter((v) => v !== st))} />
              ))}
```

- [ ] **Step 3: 类型检查通过**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 无报错（`tr.nav.spaceType` 已在 Navbar 使用，确属现有 i18n key）

- [ ] **Step 4: 提交**

```bash
git add src/components/companies/CompaniesClient.tsx
git commit -m "feat(companies): 侧边栏新增空间类型筛选区 + active chips"
```

---

## Task 5: 前端 — 金牌(is_signed)置顶排序

**Files:**
- Modify: `src/components/companies/CompaniesClient.tsx`（filteredCompanies useMemo 之后；列表渲染 ~515-525）

- [ ] **Step 1: 新增 sortedCompanies**

在 `filteredCompanies` 的 `useMemo` 结束之后插入：

```tsx
  // 有能力筛选(space/style/service)激活时，金牌(is_signed)置顶；组内保持服务端 weight_score 原序(稳定排序)
  const sortedCompanies = useMemo(() => {
    const hasCapabilityFilter = selectedSpaceTypes.length > 0 || selectedStyles.length > 0 || selectedServices.length > 0;
    if (!hasCapabilityFilter) return filteredCompanies;
    return [...filteredCompanies].sort((a, b) => Number(b.isSigned) - Number(a.isSigned));
  }, [filteredCompanies, selectedSpaceTypes, selectedStyles, selectedServices]);
```

- [ ] **Step 2: 列表渲染改用 sortedCompanies**

把列表区(当前 515-525 行) 的 `filteredCompanies` 两处引用改为 `sortedCompanies`：

```tsx
            {sortedCompanies.length > 0 ? (
              <div>
                {sortedCompanies.map((company) => (
```

（空状态分支 `clearAllFilters` 等不变）

- [ ] **Step 3: 类型检查**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 无报错

- [ ] **Step 4: 提交**

```bash
git add src/components/companies/CompaniesClient.tsx
git commit -m "feat(companies): capability 筛选时金牌公司置顶展示"
```

---

## Task 6: 验收 + 部署（用户说"部署"后执行）

**Files:** 无代码改动；运行验证 + 生产同步

- [ ] **Step 1: 纯函数用例**

Run: `node scripts/harness/space-type-test.mjs`
Expected: `13 passed, 0 failed`

- [ ] **Step 2: smoke-test（先按 MEMORY.md 启动 3002 + 5180）**

Run: `node scripts/harness/smoke-test.mjs`
Expected: 全绿（tsc 通过 + 路由可达）

- [ ] **Step 3: next build**

Run: `node_modules/.bin/next build`
Expected: exit=0
注意：build 会覆盖 `.next`，跑完须重启 5180 dev server。

- [ ] **Step 4: 浏览器实测**

打开 `http://localhost:5180/companies?space=villa`：
- 断言：有别墅能力(specialties 含 Villa/Luxury Villa/Townhouse)的公司出现
- 断言：金牌(Gold 徽章 = is_signed)公司排在列表最顶部
- 断言：侧边栏 Space Type 区可点选，active chip 正常增删
- 对照：点 Apartment 不应混入纯别墅公司

- [ ] **Step 5: 部署后端 site.js（rsync + 重启）**

```bash
rsync -avz server/dist/routes/site.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/routes/site.js
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

- [ ] **Step 6: 更新生产 system_config.space_types_ae（SQL）**

SSH 到服务器，用服务器 `/tarmeer/tarmeer_api/.env` 连生产库：

```sql
-- 先备份现值
SELECT config_value FROM system_config WHERE config_key='space_types_ae';
-- 更新为新 space= 链接
UPDATE system_config SET config_value='[{"key":"Villa","to":"/companies?space=villa"},{"key":"Apartment","to":"/companies?space=apartment"},{"key":"Commercial","to":"/companies?space=commercial"},{"key":"Public / Institutional","to":"/companies?space=public"},{"key":"Outdoor / Landscape","to":"/companies?space=outdoor"}]' WHERE config_key='space_types_ae';
```

验证：`curl -s --noproxy '*' -H 'x-country: ae' 'https://www.tarmeer.com/api/site/space-types?country=ae'` 应返回 `space=` 链接。

- [ ] **Step 7: 部署前端（git push + 服务器 build）**

按 MEMORY.md 部署流程：`git push origin HEAD:main` → 服务器 `git pull && next build && pm2 restart tarmeer-next`，对比 `.next/BUILD_ID` 确认上线。

- [ ] **Step 8: 生产验证**

打开 `https://www.tarmeer.com/companies?space=villa`，确认有能力公司出现且金牌置顶。

---

## 自检（writing-plans Self-Review）

- **Spec 覆盖**：匹配层(Task1)、后端链接(Task2)、前端 state/筛选(Task3)、UI/chips(Task4)、金牌置顶(Task5)、生产 DB+部署(Task6) — 设计文档每点均有对应任务。✓
- **占位符**：无 TBD/TODO，所有 code step 给出完整代码。✓
- **类型一致**：`companyHasSpaceType` / `SPACE_TYPE_KEYS` / `SPACE_TYPE_LABELS` / `selectedSpaceTypes` / `setSelectedSpaceTypes` / `sortedCompanies` 全程命名一致。✓
- **VN 不动**：Task2 仅改 `ae`，Task6 仅 UPDATE `space_types_ae`。✓
