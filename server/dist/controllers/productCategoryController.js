"use strict";
// 产品分类（两级：大类 parent_value=NULL / 子类 parent_value=大类value）。
// 供应商产品归类用；后台运营在供应商列表页「产品分类」弹层里增删改+启停+拖拽。
// 单表自引用（product_categories.parent_value）——比供应商那套 groups+categories 双表更简单。
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProductCategories = listProductCategories;
exports.createProductCategory = createProductCategory;
exports.updateProductCategory = updateProductCategory;
exports.toggleProductCategory = toggleProductCategory;
exports.deleteProductCategory = deleteProductCategory;
exports.reorderProductCategories = reorderProductCategories;

const pool = require("../config/database").default;

// GET /admin/enums/product-categories — 全部（大类+子类），前端按 parent_value 分组
async function listProductCategories(req, res) {
  try {
    const [rows] = await pool.execute('SELECT value, label, parent_value, sort_order, is_enabled FROM product_categories ORDER BY sort_order, label');
    res.json({ categories: rows });
  } catch (error) {
    console.error('listProductCategories error:', error);
    res.status(500).json({ error: 'Failed to load product categories.' });
  }
}

// POST /admin/enums/product-categories { value, label, parent_value? }
async function createProductCategory(req, res) {
  try {
    const { value, label, parent_value } = req.body;
    if (!value?.trim() || !label?.trim()) return res.status(400).json({ error: 'value and label are required.' });
    const cleanValue = value.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 60);
    const cleanLabel = label.trim().slice(0, 120);
    const parent = parent_value ? String(parent_value).trim() : null;
    const [existing] = await pool.execute('SELECT value FROM product_categories WHERE value = ?', [cleanValue]);
    if (existing.length > 0) return res.status(200).json({ value: cleanValue, existed: true });
    // 校验父级存在且本身是大类（parent_value 为空）
    if (parent) {
      const [p] = await pool.execute('SELECT value, parent_value FROM product_categories WHERE value = ?', [parent]);
      if (p.length === 0 || p[0].parent_value) return res.status(400).json({ error: 'Invalid parent category.' });
    }
    const [maxRows] = await pool.execute('SELECT MAX(sort_order) AS m FROM product_categories WHERE parent_value <=> ?', [parent]);
    const nextOrd = (maxRows[0]?.m ?? -1) + 1;
    await pool.execute('INSERT INTO product_categories (value, label, parent_value, sort_order, is_enabled) VALUES (?, ?, ?, ?, 1)', [cleanValue, cleanLabel, parent, nextOrd]);
    res.status(201).json({ value: cleanValue, label: cleanLabel, parent_value: parent });
  } catch (error) {
    console.error('createProductCategory error:', error);
    res.status(500).json({ error: 'Failed to create product category.' });
  }
}

// PUT /admin/enums/product-categories/:value { label?, parent_value? }
async function updateProductCategory(req, res) {
  try {
    const value = decodeURIComponent(req.params.value);
    const { label, parent_value } = req.body;
    const sets = [];
    const params = [];
    if (label?.trim()) { sets.push('label = ?'); params.push(label.trim().slice(0, 120)); }
    if ('parent_value' in req.body) {
      const parent = parent_value ? String(parent_value).trim() : null;
      if (parent === value) return res.status(400).json({ error: 'Category cannot be its own parent.' });
      if (parent) {
        // 父级必须存在且本身是大类(parent_value 为空)——防挂到不存在的父级或造三级
        const [p] = await pool.execute('SELECT parent_value FROM product_categories WHERE value = ?', [parent]);
        if (p.length === 0 || p[0].parent_value) return res.status(400).json({ error: 'Invalid parent category (must be an existing top-level category).' });
        // 本行若已有子类，不能再挂到别人下面(否则三级)
        const [kids] = await pool.execute('SELECT 1 FROM product_categories WHERE parent_value = ? LIMIT 1', [value]);
        if (kids.length > 0) return res.status(400).json({ error: 'This category has sub-categories; move or delete them first.' });
      }
      sets.push('parent_value = ?'); params.push(parent);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(value);
    await pool.execute(`UPDATE product_categories SET ${sets.join(', ')} WHERE value = ?`, params);
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateProductCategory error:', error);
    res.status(500).json({ error: 'Failed to update product category.' });
  }
}

// PUT /admin/enums/product-categories/:value/toggle
async function toggleProductCategory(req, res) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute('UPDATE product_categories SET is_enabled = 1 - is_enabled WHERE value = ?', [value]);
    res.json({ message: 'Toggled.' });
  } catch (error) {
    console.error('toggleProductCategory error:', error);
    res.status(500).json({ error: 'Failed to toggle product category.' });
  }
}

// DELETE /admin/enums/product-categories/:value — 删大类时，其子类降为大类(parent_value=NULL)，不级联删数据。
// 事务保证"孤儿提升"和"删除"要么都成、要么都不成。
async function deleteProductCategory(req, res) {
  const conn = await pool.getConnection();
  try {
    const value = decodeURIComponent(req.params.value);
    await conn.beginTransaction();
    await conn.execute('UPDATE product_categories SET parent_value = NULL WHERE parent_value = ?', [value]);
    await conn.execute('DELETE FROM product_categories WHERE value = ?', [value]);
    await conn.commit();
    res.json({ message: 'Deleted.' });
  } catch (error) {
    await conn.rollback();
    console.error('deleteProductCategory error:', error);
    res.status(500).json({ error: 'Failed to delete product category.' });
  } finally {
    conn.release();
  }
}

// PUT /admin/enums/product-categories/reorder { values: [...] } — 同一层级传一组 value，按序写 sort_order
async function reorderProductCategories(req, res) {
  try {
    const { values } = req.body;
    if (!Array.isArray(values) || values.length === 0) return res.status(400).json({ error: 'values array is required.' });
    for (let i = 0; i < values.length; i++) {
      await pool.execute('UPDATE product_categories SET sort_order = ? WHERE value = ?', [i, values[i]]);
    }
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderProductCategories error:', error);
    res.status(500).json({ error: 'Failed to reorder product categories.' });
  }
}
