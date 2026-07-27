'use client';

// 供应商分类管理（增删改 + 启停 + 拖拽排序）。
// 抽成共享组件：enums 页「供应商分类」tab 用它，供应商列表页头部入口也用它（弹层）。
// 管的是 supplier_categories 表；这些分类驱动公开站的供应商筛选/导航。

import { useState, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';

interface SupplierCategory {
  value: string;
  label: string;
  sort_order: number;
  is_enabled: number;
}

const inputCls =
  'h-[36px] px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-[14px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white';

export default function SupplierCategoriesManager() {
  const [cats, setCats] = useState<SupplierCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingValue, setAddingValue] = useState('');
  const [addingLabel, setAddingLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const addValueRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef(-1);
  const overIndex = useRef(-1);
  const [draggingIdx, setDraggingIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);

  async function load() {
    setLoading(true);
    try { const data = await adminApi.request('/enums/supplier-categories'); setCats(data.categories || []); } catch { showToast('加载失败', 'error'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function updateLabel(cat: SupplierCategory, newLabel: string) {
    if (!newLabel.trim() || newLabel.trim() === cat.label) return;
    try { await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}`, { method: 'PUT', body: JSON.stringify({ label: newLabel.trim() }) }); setCats((prev) => prev.map((c) => c.value === cat.value ? { ...c, label: newLabel.trim() } : c)); } catch { showToast('更新失败', 'error'); }
  }

  async function toggle(cat: SupplierCategory) {
    try { await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}/toggle`, { method: 'PUT' }); setCats((prev) => prev.map((c) => c.value === cat.value ? { ...c, is_enabled: c.is_enabled ? 0 : 1 } : c)); } catch { showToast('更新失败', 'error'); }
  }

  function deleteCat(cat: SupplierCategory) {
    showConfirm({ title: `删除供应商分类 "${cat.label}"`, message: '该分类删除后，网站导航和筛选器中的分类将消失。', requireText: '我已清楚知道删除分类对网站造成的影响', confirmLabel: '确认删除', onConfirm: async () => {
      try { await adminApi.request(`/enums/supplier-categories/${encodeURIComponent(cat.value)}`, { method: 'DELETE' }); setCats((prev) => prev.filter((c) => c.value !== cat.value)); showToast('已删除', 'success'); } catch { showToast('删除失败', 'error'); }
    } });
  }

  async function addCat() {
    if (adding) return;
    const v = addingValue.trim().toLowerCase().replace(/\s+/g, '_');
    const l = addingLabel.trim();
    if (!v || !l) { showToast('请填写 value 和显示名称', 'error'); return; }
    setAdding(true);
    try { await adminApi.request('/enums/supplier-categories', { method: 'POST', body: JSON.stringify({ value: v, label: l }) }); setAddingValue(''); setAddingLabel(''); setShowAddForm(false); showToast('分类已添加', 'success'); await load(); } catch (e: unknown) { showToast(e instanceof Error ? e.message : '添加失败', 'error'); } finally { setAdding(false); }
  }

  function handleDragStart(idx: number) { dragIndex.current = idx; setDraggingIdx(idx); }
  function handleDragEnter(idx: number) { overIndex.current = idx; setOverIdx(idx); }
  async function handleDragEnd() {
    const from = dragIndex.current; const to = overIndex.current;
    setDraggingIdx(-1); setOverIdx(-1); dragIndex.current = -1; overIndex.current = -1;
    if (from === to || from < 0 || to < 0) return;
    const reordered = [...cats]; const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved); setCats(reordered);
    try { await adminApi.request('/enums/supplier-categories/reorder', { method: 'PUT', body: JSON.stringify({ values: reordered.map((c) => c.value) }) }); } catch { showToast('排序保存失败', 'error'); }
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">加载中…</div>;

  return (
    <div>
      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-stone-500">供应商分类列表（拖动排序，点击名称编辑）</p>
          <button onClick={() => { setShowAddForm(true); setTimeout(() => addValueRef.current?.focus(), 50); }} className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium transition-colors">+ 新增分类</button>
        </div>
        {showAddForm && (
          <div className="flex gap-2 flex-wrap mb-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
            <input ref={addValueRef} className={`${inputCls} w-36`} placeholder="key (如 tiles)" value={addingValue} onChange={(e) => setAddingValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setShowAddForm(false); setAddingValue(''); setAddingLabel(''); } }} />
            <input className={`${inputCls} w-48`} placeholder="显示名称 (如 Tiles & Stone)" value={addingLabel} onChange={(e) => setAddingLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') { setShowAddForm(false); setAddingValue(''); setAddingLabel(''); } }} />
            <button onClick={addCat} disabled={adding || !addingValue.trim() || !addingLabel.trim()} className="btn-primary inline-flex items-center justify-center h-[36px] px-4 text-sm disabled:opacity-40">添加</button>
            <button onClick={() => { setShowAddForm(false); setAddingValue(''); setAddingLabel(''); }} className="h-[36px] px-3 text-sm text-stone-500 hover:text-stone-700 transition-colors">取消</button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-2.5 text-stone-500 font-medium w-36">Key (URL 参数)</th>
              <th className="text-left px-4 py-2.5 text-stone-500 font-medium">显示名称</th>
              <th className="text-left px-4 py-2.5 text-stone-500 font-medium w-20">启用</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {cats.map((cat, idx) => (
              <tr key={cat.value} draggable onDragStart={() => handleDragStart(idx)} onDragEnter={() => handleDragEnter(idx)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}
                className={`border-b border-stone-100 last:border-0 select-none ${draggingIdx === idx ? 'opacity-40' : ''} ${overIdx === idx && draggingIdx !== idx ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : 'hover:bg-stone-50/50'}`}>
                <td className="pl-3"><span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none" title="拖动排序">⠿</span></td>
                <td className="px-4 py-2.5 font-mono text-xs text-stone-500">{cat.value}</td>
                <td className="px-4 py-2.5">
                  <input className={`${inputCls} w-full`} defaultValue={cat.label} onBlur={(e) => updateLabel(cat, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => toggle(cat)} className={`inline-flex items-center justify-center text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${cat.is_enabled ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {cat.is_enabled ? '停用' : '启用'}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => deleteCat(cat)} className="inline-flex items-center justify-center text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
