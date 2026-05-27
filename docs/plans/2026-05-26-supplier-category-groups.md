# Supplier Category Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 供应商分类从平铺列表升级为两级结构（大类 + 子分类），Admin UI 复用 ServicesTab 双栏布局，Navbar 桌面/移动端按大类分组展示，移动端间距加宽。

**Architecture:** 新增 `supplier_category_groups` 表存储大类，`supplier_categories` 加 `group_value` 外键列。后端新增大类 CRUD API；公开 API 改为返回分组结构。前端 Admin 端复用 ServicesTab 双栏，Navbar 两端均按大类渲染。

**Tech Stack:** MySQL, TypeScript/Express (backend), React/Tailwind (frontend), existing AdminSelect + showConfirm + showToast components.

---

## 现有文件速查

| 文件 | 用途 |
|------|------|
| `server/src/lib/autoMigrate.ts` | 建表 + seed |
| `server/src/controllers/enumAdminController.ts` | 供应商分类 CRUD（line 305–412）+ 公开 API（line 402） |
| `server/src/routes/admin.ts` | 管理端路由（line 478–483） |
| `server/src/app.ts` | 公开路由挂载（line 425） |
| `src/pages/admin/AdminEnumsPage.tsx` | SupplierCategoriesTab（line 610–842） |
| `src/components/Navbar.tsx` | Desktop dropdown（line 339–397）+ Mobile（line 632–697） |

---

## Task 1: DB — 建表 + 加列 + Seed

**Files:**
- Modify: `server/src/lib/autoMigrate.ts`

### Step 1: 在 `TABLES` 数组（line 311 附近）`supplier_categories` 条目后面插入新表定义

在 `supplier_categories` 的 `}` 后追加：

```typescript
  {
    name: 'supplier_category_groups',
    sql: `CREATE TABLE IF NOT EXISTS supplier_category_groups (
      value VARCHAR(50) NOT NULL PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  },
```

### Step 2: 在 autoMigrate 主函数末尾（"7d. Seed supplier_categories" 之前）加 column migration + seed

在 `// 7d. Seed supplier_categories` 块前插入：

```typescript
    // 7c-2. Add group_value to supplier_categories
    try {
      await pool.execute(`
        ALTER TABLE supplier_categories
        ADD COLUMN IF NOT EXISTS group_value VARCHAR(50) NULL
      `);
      changes++;
      console.log(`${TAG} Added group_value to supplier_categories`);
    } catch { /* already exists */ }

    // 7c-3. Seed supplier_category_groups
    try {
      await pool.execute(`
        INSERT INTO supplier_category_groups (value, label, sort_order, is_enabled) VALUES
          ('decoration_materials', '装饰材料', 0, 1),
          ('furniture_group',      '家具',     1, 1)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
      `);
    } catch { /* ignore */ }
```

### Step 3: 修改 "7d. Seed supplier_categories" 块，替换为 30 个新分类 + 保留旧分类（打 group_value）

将现有 `INSERT INTO supplier_categories ...` 替换为：

```typescript
    // 7d. Seed supplier_categories — 30 new + keep existing 10 as ungrouped
    try {
      // 新建 30 个分类（带 group_value）
      await pool.execute(`
        INSERT INTO supplier_categories (value, label, sort_order, is_enabled, group_value) VALUES
          ('tiles',           '瓷砖',                  1,  1, 'decoration_materials'),
          ('stone_materials', '石材',                  2,  1, 'decoration_materials'),
          ('sanitary_ware',   '洁具',                  3,  1, 'decoration_materials'),
          ('whole_house',     '全屋定制',              4,  1, 'decoration_materials'),
          ('system_windows',  '系统门窗',              5,  1, 'decoration_materials'),
          ('entry_doors',     '入户门',                6,  1, 'decoration_materials'),
          ('garage_doors',    '车库门',                7,  1, 'decoration_materials'),
          ('interior_doors',  '室内门',                8,  1, 'decoration_materials'),
          ('wood_flooring',   '木地板',                9,  1, 'decoration_materials'),
          ('outdoor_deco',    '户外装饰新材料',        10, 1, 'decoration_materials'),
          ('indoor_deco',     '室内装饰新材料',        11, 1, 'decoration_materials'),
          ('soft_furnishing', '软装',                  12, 1, 'decoration_materials'),
          ('hardware_items',  '五金',                  13, 1, 'decoration_materials'),
          ('paint_coatings',  '油漆涂料',              14, 1, 'decoration_materials'),
          ('stairs',          '楼梯、扶手',            15, 1, 'decoration_materials'),
          ('lighting_new',    '灯具',                  16, 1, 'decoration_materials'),
          ('smart_home',      '智能家居',              17, 1, 'decoration_materials'),
          ('italian_minimal',  '意式极简家具',         1,  1, 'furniture_group'),
          ('italian_luxury',   '意式轻奢家具',         2,  1, 'furniture_group'),
          ('modern_functional','现代功能家具',         3,  1, 'furniture_group'),
          ('european_style',   '欧式家具',             4,  1, 'furniture_group'),
          ('american_style',   '美式家具',             5,  1, 'furniture_group'),
          ('french_style',     '法式家具',             6,  1, 'furniture_group'),
          ('wabi_sabi',        '侘寂风家具',           7,  1, 'furniture_group'),
          ('childrens_furn',   '儿童家具',             8,  1, 'furniture_group'),
          ('outdoor_furn',     '户外家具',             9,  1, 'furniture_group'),
          ('office_furn',      '办公家具',             10, 1, 'furniture_group'),
          ('hotel_furn',       '酒店家具',             11, 1, 'furniture_group'),
          ('beds',             '床',                   12, 1, 'furniture_group'),
          ('bedding',          '床上用品',             13, 1, 'furniture_group')
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          sort_order = VALUES(sort_order),
          group_value = IF(group_value IS NULL, VALUES(group_value), group_value)
      `);
      // 旧 10 个保留，group_value 保持 NULL（待分配）
      // 仅更新 sort_order，不改 group_value
      await pool.execute(`
        INSERT INTO supplier_categories (value, label, sort_order, is_enabled) VALUES
          ('furniture',  'Furniture',              1, 1),
          ('stone',      'Tile & Stone',            2, 1),
          ('lighting',   'Lighting',               3, 1),
          ('plants',     'Plants & Landscaping',   4, 1),
          ('flooring',   'Flooring',               5, 1),
          ('kitchen',    'Kitchen & Bath',         6, 1),
          ('curtains',   'Curtains & Textiles',    7, 1),
          ('paint',      'Paint & Coatings',       8, 1),
          ('hardware',   'Doors & Windows',        9, 1),
          ('other',      'Other',                 10, 1)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
      `);
    } catch { /* ignore */ }
```

### Step 4: 编译验证

```bash
cd server && npx tsc --noEmit --skipLibCheck
```
期望：0 errors

### Step 5: 重启后端验证建表

```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2 && mysql -u root tarmeer -e "DESCRIBE supplier_category_groups; SELECT COUNT(*) as groups FROM supplier_category_groups; SELECT COUNT(*) as cats FROM supplier_categories;"
```
期望：groups=2, cats=40（旧10+新30）

---

## Task 2: 后端 — 大类 CRUD + 修改现有 API

**Files:**
- Modify: `server/src/controllers/enumAdminController.ts`

### Step 1: 在文件末尾（`getPublicSupplierCategories` 之前）插入大类 CRUD 函数

```typescript
// ── Admin: supplier category groups ─────────────────────────────────────────

export async function listSupplierCategoryGroups(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT value, label, sort_order, is_enabled FROM supplier_category_groups ORDER BY sort_order, label'
    );
    res.json({ groups: rows });
  } catch (error) {
    console.error('listSupplierCategoryGroups error:', error);
    res.status(500).json({ error: 'Failed to load supplier category groups.' });
  }
}

export async function createSupplierCategoryGroup(req: any, res: any) {
  try {
    const { value, label } = req.body;
    if (!value?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'value and label are required.' });
    }
    const cleanValue = value.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 50);
    const cleanLabel = label.trim().slice(0, 100);
    const [existing] = await pool.execute('SELECT value FROM supplier_category_groups WHERE value = ?', [cleanValue]);
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: 'Group already exists.' });
    }
    const [allRows] = await pool.execute('SELECT MAX(sort_order) AS maxOrd FROM supplier_category_groups');
    const maxOrd = (allRows as any[])[0]?.maxOrd ?? -1;
    await pool.execute(
      'INSERT INTO supplier_category_groups (value, label, sort_order, is_enabled) VALUES (?, ?, ?, 1)',
      [cleanValue, cleanLabel, maxOrd + 1]
    );
    res.status(201).json({ value: cleanValue, label: cleanLabel });
  } catch (error) {
    console.error('createSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to create supplier category group.' });
  }
}

export async function updateSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'label is required.' });
    await pool.execute(
      'UPDATE supplier_category_groups SET label = ? WHERE value = ?',
      [label.trim().slice(0, 100), value]
    );
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to update supplier category group.' });
  }
}

export async function reorderSupplierCategoryGroups(req: any, res: any) {
  try {
    const { values } = req.body;
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: 'values array is required.' });
    }
    for (let i = 0; i < values.length; i++) {
      await pool.execute('UPDATE supplier_category_groups SET sort_order = ? WHERE value = ?', [i, values[i]]);
    }
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderSupplierCategoryGroups error:', error);
    res.status(500).json({ error: 'Failed to reorder supplier category groups.' });
  }
}

export async function toggleSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute('UPDATE supplier_category_groups SET is_enabled = 1 - is_enabled WHERE value = ?', [value]);
    res.json({ message: 'Toggled.' });
  } catch (error) {
    console.error('toggleSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to toggle supplier category group.' });
  }
}

export async function deleteSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    // 该大类下的子分类变为待分配（group_value = NULL）
    await pool.execute('UPDATE supplier_categories SET group_value = NULL WHERE group_value = ?', [value]);
    await pool.execute('DELETE FROM supplier_category_groups WHERE value = ?', [value]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to delete supplier category group.' });
  }
}
```

### Step 2: 修改 `listSupplierCategories`（line 305）加上 group_value

将 SELECT 改为：
```typescript
      'SELECT value, label, sort_order, is_enabled, group_value FROM supplier_categories ORDER BY sort_order, label'
```

### Step 3: 修改 `updateSupplierCategory`（line 342）支持 group_value 更新

将函数体改为：
```typescript
export async function updateSupplierCategory(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    const { label, group_value } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    if (label?.trim()) { sets.push('label = ?'); params.push(label.trim().slice(0, 100)); }
    if ('group_value' in req.body) { sets.push('group_value = ?'); params.push(group_value || null); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(value);
    await pool.execute(`UPDATE supplier_categories SET ${sets.join(', ')} WHERE value = ?`, params);
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateSupplierCategory error:', error);
    res.status(500).json({ error: 'Failed to update supplier category.' });
  }
}
```

### Step 4: 修改 `createSupplierCategory`（line 317）支持 group_value

在解构中加 `group_value`，INSERT 时带上：
```typescript
    const { value, label, group_value } = req.body;
    // ...（其他不变）
    await pool.execute(
      'INSERT INTO supplier_categories (value, label, sort_order, is_enabled, group_value) VALUES (?, ?, ?, 1, ?)',
      [cleanValue, cleanLabel, maxOrd + 1, group_value || null]
    );
```

### Step 5: 修改公开 API `getPublicSupplierCategories`（line 402）返回分组结构

```typescript
export async function getPublicSupplierCategories(req: any, res: any) {
  try {
    const [groupRows] = await pool.execute(
      'SELECT value, label FROM supplier_category_groups WHERE is_enabled = 1 ORDER BY sort_order, label'
    );
    const [catRows] = await pool.execute(
      'SELECT value, label, group_value FROM supplier_categories WHERE is_enabled = 1 ORDER BY sort_order, label'
    );
    const cats = catRows as { value: string; label: string; group_value: string | null }[];
    const groups = (groupRows as { value: string; label: string }[]).map(g => ({
      ...g,
      categories: cats.filter(c => c.group_value === g.value),
    }));
    const ungrouped = cats.filter(c => !c.group_value);
    res.json({ groups, ungrouped });
  } catch (error) {
    console.error('getPublicSupplierCategories error:', error);
    res.status(500).json({ error: 'Failed to load supplier categories.' });
  }
}
```

### Step 6: 编译验证

```bash
cd server && npx tsc --noEmit --skipLibCheck
```
期望：0 errors

---

## Task 3: 后端路由注册

**Files:**
- Modify: `server/src/routes/admin.ts`

### Step 1: 在 import 行（line 87 附近）加新函数导入

在现有 `enumAdminController` import 里加：
```typescript
import {
  // ...现有函数...
  listSupplierCategoryGroups, createSupplierCategoryGroup, updateSupplierCategoryGroup,
  reorderSupplierCategoryGroups, toggleSupplierCategoryGroup, deleteSupplierCategoryGroup,
} from '../controllers/enumAdminController';
```

### Step 2: 在 line 483（`deleteSupplierCategory` 路由）之后追加大类路由

```typescript
// Supplier category groups
router.get('/enums/supplier-category-groups', listSupplierCategoryGroups);
router.post('/enums/supplier-category-groups', requireAdmin, createSupplierCategoryGroup);
router.put('/enums/supplier-category-groups/reorder', requireAdmin, reorderSupplierCategoryGroups);
router.put('/enums/supplier-category-groups/:value/toggle', requireAdmin, toggleSupplierCategoryGroup);
router.put('/enums/supplier-category-groups/:value', requireAdmin, updateSupplierCategoryGroup);
router.delete('/enums/supplier-category-groups/:value', requireAdmin, deleteSupplierCategoryGroup);
```

### Step 3: 编译 + 重启验证路由

```bash
cd server && npx tsc --noEmit --skipLibCheck && \
  lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2 && curl -s http://localhost:3002/api/public/supplier-categories | python3 -m json.tool | head -30
```
期望：`{ "groups": [ {"value":"decoration_materials","label":"装饰材料","categories":[...]}, ... ], "ungrouped": [...] }`

---

## Task 4: Admin UI — SupplierCategoriesTab 重写

**Files:**
- Modify: `src/pages/admin/AdminEnumsPage.tsx`（`SupplierCategoriesTab` function, line 619–842）

完整替换 `SupplierCategoriesTab` function，保留 `interface SupplierCategory`，新增 `interface SupplierGroup`：

```typescript
interface SupplierGroup {
  value: string;
  label: string;
  sort_order: number;
  is_enabled: number;
}

interface SupplierCategory {
  value: string;
  label: string;
  sort_order: number;
  is_enabled: number;
  group_value: string | null;
}

function SupplierCategoriesTab() {
  const [groups, setGroups] = useState<SupplierGroup[]>([]);
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // ── Add group state ──
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupValue, setNewGroupValue] = useState('');
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const newGroupRef = useRef<HTMLInputElement>(null);
  const groupSubmittingRef = useRef(false);

  // ── Add category state ──
  const [newCatValue, setNewCatValue] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  // ── Drag (categories) ──
  const dragIdx = useRef(-1);
  const overIdx = useRef(-1);
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [overDragIdx, setOverDragIdx] = useState(-1);

  // ── Drag (groups) ──
  const gDragIdx = useRef(-1);
  const gOverIdx = useRef(-1);
  const [gDraggingIdx, setGDraggingIdx] = useState(-1);
  const [gOverIdx2, setGOverIdx2] = useState(-1);

  async function loadAll() {
    setLoading(true);
    try {
      const [gData, cData] = await Promise.all([
        adminApi.request('/enums/supplier-category-groups'),
        adminApi.request('/enums/supplier-categories'),
      ]);
      const loadedGroups: SupplierGroup[] = gData.groups || [];
      setGroups(loadedGroups);
      setCats(cData.categories || []);
      setSelectedGroup(prev => prev ?? (loadedGroups[0]?.value ?? '__ungrouped__'));
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const displayedCats = selectedGroup === '__ungrouped__'
    ? cats.filter(c => !c.group_value)
    : cats.filter(c => c.group_value === selectedGroup);

  // ── Group CRUD ──

  async function commitNewGroup() {
    if (groupSubmittingRef.current) return;
    const v = newGroupValue.trim().toLowerCase().replace(/\s+/g, '_');
    const l = newGroupLabel.trim();
    if (!v || !l) { setAddingGroup(false); setNewGroupValue(''); setNewGroupLabel(''); return; }
    groupSubmittingRef.current = true;
    try {
      await adminApi.request('/enums/supplier-category-groups', {
        method: 'POST',
        body: JSON.stringify({ value: v, label: l }),
      });
      showToast('大类已创建', 'success');
      await loadAll();
      setSelectedGroup(v);
    } catch (e: any) {
      showToast(e.message || '创建失败', 'error');
    } finally {
      groupSubmittingRef.current = false;
      setAddingGroup(false);
      setNewGroupValue('');
      setNewGroupLabel('');
    }
  }

  async function renameGroup(group: SupplierGroup, newLabel: string) {
    if (!newLabel.trim() || newLabel.trim() === group.label) return;
    try {
      await adminApi.request(`/enums/supplier-category-groups/${encodeURIComponent(group.value)}`, {
        method: 'PUT',
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      setGroups(prev => prev.map(g => g.value === group.value ? { ...g, label: newLabel.trim() } : g));
      showToast('已重命名', 'success');
    } catch { showToast('重命名失败', 'error'); }
  }

  async function toggleGroup(group: SupplierGroup) {
    try {
      await adminApi.request(`/enums/supplier-category-groups/${encodeURIComponent(group.value)}/toggle`, { method: 'PUT' });
      setGroups(prev => prev.map(g => g.value === group.value ? { ...g, is_enabled: g.is_enabled ? 0 : 1 } : g));
    } catch { showToast('更新失败', 'error'); }
  }

  function deleteGroup(group: SupplierGroup) {
    showConfirm({
      title: `删除大类「${group.label}」`,
      message: '该大类下的所有子分类将变为"待分配"状态，不会被删除。此操作不可恢复。',
      requireText: '我已知道删除对系统的影响',
      confirmLabel: '确认删除',
      onConfirm: async () => {
        try {
          await adminApi.request(`/enums/supplier-category-groups/${encodeURIComponent(group.value)}`, { method: 'DELETE' });
          showToast('已删除', 'success');
          setSelectedGroup(groups.filter(g => g.value !== group.value)[0]?.value ?? '__ungrouped__');
          await loadAll();
        } catch { showToast('删除失败', 'error'); }
      },
    });
  }

  // ── Group drag ──
  function handleGDragStart(idx: number) { gDragIdx.current = idx; setGDraggingIdx(idx); }
  function handleGDragEnter(idx: number) { gOverIdx.current = idx; setGOverIdx2(idx); }
  async function handleGDragEnd() {
    const from = gDragIdx.current, to = gOverIdx.current;
    setGDraggingIdx(-1); setGOverIdx2(-1);
    gDragIdx.current = -1; gOverIdx.current = -1;
    if (from === to || from < 0 || to < 0) return;
    const reordered = [...groups];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setGroups(reordered);
    try {
      await adminApi.request('/enums/supplier-category-groups/reorder', {
        method: 'PUT',
        body: JSON.stringify({ values: reordered.map(g => g.value) }),
      });
    } catch { showToast('排序保存失败', 'error'); }
  }

  // ── Category CRUD ──

  async function addCat() {
    if (addingCat || !selectedGroup || selectedGroup === '__ungrouped__') return;
    const v = newCatValue.trim().toLowerCase().replace(/\s+/g, '_');
    const l = newCatLabel.trim();
    if (!v || !l) { showToast('请填写 key 和名称', 'error'); return; }
    setAddingCat(true);
    try {
      await adminApi.request('/enums/supplier-categories', {
        method: 'POST',
        body: JSON.stringify({ value: v, label: l, group_value: selectedGroup }),
      });
      setNewCatValue(''); setNewCatLabel(''); setShowAddCat(false);
      showToast('分类已添加', 'success');
      await loadAll();
    } catch (e: any) {
      showToast(e.message || '添加失败', 'error');
    } finally {
      setAddingCat(false);
    }
  }

  async function updateCatLabel(cat: SupplierCategory, newLabel: string) {
    if (!newLabel.trim() || newLabel.trim() === cat.label) return;
    try {
      await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}`, {
        method: 'PUT',
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      setCats(prev => prev.map(c => c.value === cat.value ? { ...c, label: newLabel.trim() } : c));
    } catch { showToast('更新失败', 'error'); }
  }

  async function moveCatGroup(cat: SupplierCategory, newGroup: string) {
    const group_value = newGroup === '__ungrouped__' ? null : newGroup;
    if (group_value === (cat.group_value ?? null)) return;
    try {
      await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}`, {
        method: 'PUT',
        body: JSON.stringify({ group_value }),
      });
      setCats(prev => prev.map(c => c.value === cat.value ? { ...c, group_value } : c));
      showToast('已移动', 'success');
    } catch { showToast('移动失败', 'error'); }
  }

  async function toggleCat(cat: SupplierCategory) {
    try {
      await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}/toggle`, { method: 'PUT' });
      setCats(prev => prev.map(c => c.value === cat.value ? { ...c, is_enabled: c.is_enabled ? 0 : 1 } : c));
    } catch { showToast('更新失败', 'error'); }
  }

  function deleteCat(cat: SupplierCategory) {
    showConfirm({
      title: `删除分类「${cat.label}」`,
      message: '该分类删除后，已使用此分类的供应商筛选将受影响。此操作不可恢复。',
      requireText: '我已清楚知道删除分类对网站造成的影响',
      confirmLabel: '确认删除',
      onConfirm: async () => {
        try {
          await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}`, { method: 'DELETE' });
          setCats(prev => prev.filter(c => c.value !== cat.value));
          showToast('已删除', 'success');
        } catch { showToast('删除失败', 'error'); }
      },
    });
  }

  // ── Category drag ──
  function handleDragStart(idx: number) { dragIdx.current = idx; setDraggingIdx(idx); }
  function handleDragEnter(idx: number) { overIdx.current = idx; setOverDragIdx(idx); }
  async function handleDragEnd() {
    const from = dragIdx.current, to = overIdx.current;
    setDraggingIdx(-1); setOverDragIdx(-1);
    dragIdx.current = -1; overIdx.current = -1;
    if (from === to || from < 0 || to < 0) return;
    const reordered = [...displayedCats];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // 更新本地 state
    setCats(prev => {
      const others = prev.filter(c => !reordered.find(r => r.value === c.value));
      return [...reordered, ...others];
    });
    try {
      await adminApi.request('/enums/supplier-categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ values: reordered.map(c => c.value) }),
      });
    } catch { showToast('排序保存失败', 'error'); }
  }

  const groupOptions = [
    { value: '__ungrouped__', label: '— 待分配 —' },
    ...groups.map(g => ({ value: g.value, label: g.label })),
  ];

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">加载中…</div>;

  const ungroupedCount = cats.filter(c => !c.group_value).length;

  return (
    <div className="flex gap-4 items-start min-h-[500px]">
      {/* ── Left: groups ── */}
      <div className="w-[260px] shrink-0 bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">大类（拖动排序）</p>
          <button
            onClick={() => { setAddingGroup(true); setNewGroupValue(''); setNewGroupLabel(''); setTimeout(() => newGroupRef.current?.focus(), 50); }}
            className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium transition-colors"
          >
            + 新增
          </button>
        </div>
        <div className="p-2 space-y-0.5">
          {groups.map((g, gi) => {
            const count = cats.filter(c => c.group_value === g.value).length;
            const isSelected = selectedGroup === g.value;
            const isDragging = gDraggingIdx === gi;
            const isOver = gOverIdx2 === gi && gDraggingIdx !== gi;
            return (
              <div
                key={g.value}
                draggable
                onDragStart={() => handleGDragStart(gi)}
                onDragEnter={() => handleGDragEnter(gi)}
                onDragEnd={handleGDragEnd}
                onDragOver={e => e.preventDefault()}
                onClick={() => setSelectedGroup(g.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors select-none ${isSelected ? 'bg-[#b8864a]/8' : 'hover:bg-stone-50'} ${isDragging ? 'opacity-40' : ''} ${isOver ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : ''}`}
              >
                <span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none shrink-0">⠿</span>
                <input
                  key={g.value}
                  className={`${inputCls} flex-1 min-w-0 cursor-pointer focus:cursor-text ${!g.is_enabled ? 'opacity-50' : ''}`}
                  defaultValue={g.label}
                  onClick={e => e.stopPropagation()}
                  onBlur={e => renameGroup(g, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { (e.target as HTMLInputElement).value = g.label; (e.target as HTMLInputElement).blur(); }
                  }}
                />
                <span className={`text-[11px] shrink-0 tabular-nums ${isSelected ? 'text-[#b8864a]/70' : 'text-stone-400'}`}>{count}</span>
                <button
                  onClick={e => { e.stopPropagation(); toggleGroup(g); }}
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${g.is_enabled ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {g.is_enabled ? '停用' : '启用'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteGroup(g); }}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            );
          })}
          {/* 待分配 bucket */}
          {ungroupedCount > 0 && (
            <button
              onClick={() => setSelectedGroup('__ungrouped__')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${selectedGroup === '__ungrouped__' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-amber-600 hover:bg-amber-50'} text-sm`}
            >
              <span>待分配</span>
              <span className="text-[11px]">{ungroupedCount}</span>
            </button>
          )}
          {addingGroup && (
            <div className="flex flex-col gap-1.5 px-2 py-1">
              <input
                ref={newGroupRef}
                value={newGroupValue}
                onChange={e => setNewGroupValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('newGroupLabelInput') as HTMLInputElement)?.focus(); if (e.key === 'Escape') { setAddingGroup(false); } }}
                placeholder="key (如 outdoor)"
                className="flex-1 h-8 px-3 text-sm rounded-xl border border-[#b8864a]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
              />
              <input
                id="newGroupLabelInput"
                value={newGroupLabel}
                onChange={e => setNewGroupLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitNewGroup(); if (e.key === 'Escape') { setAddingGroup(false); } }}
                onBlur={commitNewGroup}
                placeholder="大类名称…"
                className="flex-1 h-8 px-3 text-sm rounded-xl border border-[#b8864a]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Right: categories in selected group ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#2c2c2c]">
              {selectedGroup === '__ungrouped__' ? '待分配' : (groups.find(g => g.value === selectedGroup)?.label ?? '')}
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {displayedCats.length} 项 · {displayedCats.filter(c => c.is_enabled).length} 启用 · 拖动 ⠿ 调整顺序
            </p>
          </div>
          {selectedGroup !== '__ungrouped__' && (
            <button
              onClick={() => { setShowAddCat(true); }}
              className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium transition-colors"
            >
              + 新增分类
            </button>
          )}
        </div>

        {showAddCat && selectedGroup !== '__ungrouped__' && (
          <div className="flex gap-2 flex-wrap mb-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <input
              className={`${inputCls} w-32`}
              placeholder="key (如 tiles)"
              value={newCatValue}
              onChange={e => setNewCatValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setShowAddCat(false); setNewCatValue(''); setNewCatLabel(''); } }}
            />
            <input
              className={`${inputCls} w-40`}
              placeholder="名称 (如 瓷砖)"
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setShowAddCat(false); setNewCatValue(''); setNewCatLabel(''); } }}
            />
            <button onClick={addCat} disabled={addingCat || !newCatValue.trim() || !newCatLabel.trim()}
              className="btn-primary inline-flex items-center justify-center h-[36px] px-4 text-sm disabled:opacity-40">
              添加
            </button>
            <button onClick={() => { setShowAddCat(false); setNewCatValue(''); setNewCatLabel(''); }}
              className="h-[36px] px-3 text-sm text-stone-500 hover:text-stone-700 transition-colors">
              取消
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 p-2">
          {displayedCats.length === 0 ? (
            <p className="px-3 py-6 text-sm text-stone-400 text-center">暂无分类</p>
          ) : (
            <div className="space-y-0.5">
              {displayedCats.map((cat, idx) => (
                <div
                  key={cat.value}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors select-none ${draggingIdx === idx ? 'opacity-40' : ''} ${overDragIdx === idx && draggingIdx !== idx ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : 'hover:bg-stone-50'}`}
                >
                  <span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none shrink-0">⠿</span>
                  <span className="text-xs text-stone-300 w-4 shrink-0">{idx + 1}</span>
                  <input
                    className={`${inputCls} flex-1 min-w-0`}
                    defaultValue={cat.label}
                    onBlur={e => updateCatLabel(cat, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  {/* Move to group */}
                  <div className="shrink-0 w-36">
                    <AdminSelect
                      size="sm"
                      value={cat.group_value ?? '__ungrouped__'}
                      onChange={v => moveCatGroup(cat, v)}
                      options={groupOptions}
                    />
                  </div>
                  <button
                    onClick={() => toggleCat(cat)}
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${cat.is_enabled ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {cat.is_enabled ? '停用' : '启用'}
                  </button>
                  <button
                    onClick={() => deleteCat(cat)}
                    className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 2: 确保文件顶部有 `useRef` import（已有则跳过）

### Step 3: 编译验证

```bash
cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck
```
期望：0 errors

### Step 4: 本地验证 Admin UI

访问 `http://localhost:5180/admin/enums` → 切到「供应商分类」tab
- 左栏应显示「装饰材料」「家具」+ 「待分配(10)」
- 点「装饰材料」右栏显示 17 个分类
- 拖动排序正常；改名 blur 后生效；停用/删除正常

---

## Task 5: Navbar — 桌面端 Materials 下拉按大类分组

**Files:**
- Modify: `src/components/Navbar.tsx`（line 339–397，桌面 Materials dropdown）

### Step 1: 修改 `supplierNavCategories` state 类型和 fetch 逻辑

当前 state：`useState<{ label: string; value: string }[]>([])`

改为：
```typescript
const [supplierNavGroups, setSupplierNavGroups] = useState<{ value: string; label: string; categories: { label: string; value: string }[] }[]>([]);
const [supplierNavUngrouped, setSupplierNavUngrouped] = useState<{ label: string; value: string }[]>([]);
```

fetch 改为解析新结构：
```typescript
fetch(`${API_BASE}/public/supplier-categories`)
  .then(r => r.json())
  .then(data => {
    setSupplierNavGroups(data.groups || []);
    setSupplierNavUngrouped(data.ungrouped || []);
  })
  .catch(() => {});
```

### Step 2: 替换桌面 Materials 下拉内容（line 358–386）

将 `grid grid-cols-2 gap-8` 内容替换为按大类分列：
```tsx
<div className="p-6 flex gap-8 min-w-max">
  {supplierNavGroups.filter(g => g.categories.length > 0).map(g => (
    <div key={g.value}>
      <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{g.label}</h3>
      <ul className="space-y-2">
        {g.categories.map(item => {
          const to = `/materials?category=${encodeURIComponent(item.value)}`;
          return (
            <li key={item.value}>
              <Link
                to={to}
                onClick={() => { setMaterialsDropdownOpen(false); handleClick(to); }}
                className="text-sm text-stone-600 hover:text-[#b8864a] transition"
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  ))}
</div>
```

### Step 3: 更新移动端 `materialsSearch` 过滤逻辑（line 667–684）

`supplierNavCategories` 已不存在，改用新 state。搜索时平铺所有分类：
```tsx
const allNavCats = [
  ...supplierNavGroups.flatMap(g => g.categories),
  ...supplierNavUngrouped,
];
const q = materialsSearch.toLowerCase();
const filtered = materialsSearch.trim()
  ? allNavCats.filter(item => item.label.toLowerCase().includes(q))
  : null; // null = 未搜索，显示分组视图
```

### Step 4: 替换移动端 Materials 展开内容（line 649–695）

```tsx
{materialsDropdownOpen && (
  <div className="mt-3 pl-2">
    {/* Search */}
    <div className="mb-3 relative">
      <input
        type="text"
        value={materialsSearch}
        onChange={e => setMaterialsSearch(e.target.value)}
        placeholder="Search category…"
        className="w-full h-9 pl-3 pr-8 rounded-lg border border-stone-200 bg-stone-50 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
      />
      {materialsSearch && (
        <button onClick={() => setMaterialsSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    {(() => {
      const allNavCats = [
        ...supplierNavGroups.flatMap(g => g.categories),
        ...supplierNavUngrouped,
      ];
      const q = materialsSearch.toLowerCase();

      if (materialsSearch.trim()) {
        // 搜索模式：平铺 2 列
        const filtered = allNavCats.filter(item => item.label.toLowerCase().includes(q));
        return filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4">
            {filtered.map(item => {
              const to = `/materials?category=${encodeURIComponent(item.value)}`;
              return (
                <Link key={item.value} to={to}
                  onClick={() => { handleClick(to); setMaterialsSearch(''); }}
                  className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1.5">
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : <p className="text-sm text-stone-400 py-2">No results</p>;
      }

      // 非搜索模式：按大类分组，间距疏松
      return (
        <div className="space-y-4">
          {supplierNavGroups.filter(g => g.categories.length > 0).map(g => (
            <div key={g.value}>
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">{g.label}</p>
              <div className="grid grid-cols-2 gap-x-4">
                {g.categories.map(item => {
                  const to = `/materials?category=${encodeURIComponent(item.value)}`;
                  return (
                    <Link key={item.value} to={to}
                      onClick={() => { handleClick(to); setMaterialsSearch(''); }}
                      className="text-sm text-stone-600 hover:text-[#b8864a] transition py-1.5">
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    })()}

    <div className="border-t border-stone-200 mt-3 pt-2">
      <Link to="/materials" onClick={() => handleClick('/materials')}
        className="text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition block py-1">
        All Suppliers →
      </Link>
    </div>
  </div>
)}
```

### Step 5: 删除不再使用的 `supplierNavCategories` state（如果还在）

搜索 `supplierNavCategories` 确认无残留引用，删除 state 声明。

### Step 6: 编译验证

```bash
cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck
```
期望：0 errors

### Step 7: 本地验证 Navbar

- 桌面端：hover Materials → 下拉显示「装饰材料」「家具」两列，各有子分类
- 移动端：展开 Materials → 分组标题 + 2 列，间距明显比之前宽松
- 移动端搜索：输入关键词 → 退化为平铺 2 列

---

## Task 6: Harness 测试

**Files:**
- Modify: `scripts/harness/test-supplier-system.mjs`（或新建）

### Step 1: 在 harness 里添加分组 API 测试用例

```javascript
// 测试公开分组 API
const r1 = await fetch('http://localhost:3099/api/public/supplier-categories');
const d1 = await r1.json();
assert(Array.isArray(d1.groups), 'groups should be array');
assert(d1.groups.length >= 2, 'should have at least 2 groups');
assert(d1.groups[0].categories.length > 0, 'first group should have categories');

// 测试 admin 大类 list（需要 token）
const r2 = await adminFetch('GET', '/enums/supplier-category-groups');
assert(r2.groups.length >= 2, 'admin should see groups');

// 测试无 token → 401
const r3 = await fetch('http://localhost:3099/api/admin/enums/supplier-category-groups');
assert(r3.status === 401, 'should require auth');
```

### Step 2: 运行 harness

```bash
PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js > /tmp/tarmeer-api-3099.log 2>&1 &
sleep 2 && node scripts/harness/test-supplier-system.mjs
```
期望：所有 PASS

---

## 完成后验证清单

- [ ] `supplier_category_groups` 表已建，有 2 行
- [ ] `supplier_categories` 有 40 行（30 新 + 10 旧待分配）
- [ ] `GET /api/public/supplier-categories` 返回 `{ groups, ungrouped }` 结构
- [ ] Admin `/admin/enums` 供应商分类 tab：左栏显示大类，右栏显示子分类
- [ ] 桌面 Navbar Materials 下拉按大类分两列
- [ ] 移动端 Materials 展开：分组标题 + 2 列，`py-1.5` 间距（比原来 `py-0.5` 宽松）
- [ ] 搜索时退化为平铺 2 列（现有行为保留）
- [ ] tsc 0 errors
- [ ] harness PASS
