'use client';

// 产品分类管理（两级：大类 parent_value=null / 子类挂大类下）。增删改 + 启停 + 同层拖拽排序。
// 后端 /admin/enums/product-categories（单表自引用）。供应商列表页「产品分类」弹层用它。

import { useState, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';

interface PCat { value: string; label: string; label_zh: string | null; parent_value: string | null; sort_order: number; is_enabled: number; }

const inputCls =
  'h-[34px] px-3 rounded-lg border border-stone-200 bg-white text-[14px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]';

export default function ProductCategoriesManager() {
  const [cats, setCats] = useState<PCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ value: '', label: '', label_zh: '' });
  const [newChild, setNewChild] = useState<Record<string, { value: string; label: string; label_zh: string }>>({});
  const dragFrom = useRef<string>('');
  const dragOver = useRef<string>(''); // 拖入的目标(onDragEnter 记录)；onDragEnd 触发在源上，必须从这里取目标
  const [dragKey, setDragKey] = useState('');

  async function load() {
    setLoading(true);
    try { const d = await adminApi.request('/enums/product-categories'); setCats(d.categories || []); }
    catch { showToast('加载失败', 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const groups = cats.filter((c) => !c.parent_value).sort((a, b) => a.sort_order - b.sort_order);
  const childrenOf = (g: string) => cats.filter((c) => c.parent_value === g).sort((a, b) => a.sort_order - b.sort_order);

  async function addGroup() {
    const value = newGroup.value.trim(); const label = newGroup.label.trim(); const label_zh = newGroup.label_zh.trim();
    if (!value || !label) { showToast('请填写 key 和显示名称', 'error'); return; }
    try { const r = await adminApi.request('/enums/product-categories', { method: 'POST', body: JSON.stringify({ value, label, label_zh }) }); if (r?.existed) { showToast(`key「${value}」已存在`, 'error'); return; } setNewGroup({ value: '', label: '', label_zh: '' }); await load(); showToast('大类已添加', 'success'); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : '添加失败', 'error'); }
  }
  async function addChild(parent: string) {
    const nc = newChild[parent] || { value: '', label: '', label_zh: '' };
    const value = nc.value.trim(); const label = nc.label.trim(); const label_zh = nc.label_zh.trim();
    if (!value || !label) { showToast('请填写子类 key 和显示名称', 'error'); return; }
    try { const r = await adminApi.request('/enums/product-categories', { method: 'POST', body: JSON.stringify({ value, label, label_zh, parent_value: parent }) }); if (r?.existed) { showToast(`key「${value}」已存在`, 'error'); return; } setNewChild((p) => ({ ...p, [parent]: { value: '', label: '', label_zh: '' } })); await load(); showToast('子类已添加', 'success'); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : '添加失败', 'error'); }
  }
  async function updateLabel(value: string, label: string, orig: string) {
    if (!label.trim() || label.trim() === orig) return;
    try { await adminApi.request(`/enums/product-categories/${encodeURIComponent(value)}`, { method: 'PUT', body: JSON.stringify({ label: label.trim() }) }); setCats((p) => p.map((c) => c.value === value ? { ...c, label: label.trim() } : c)); }
    catch { showToast('更新失败', 'error'); }
  }
  async function updateLabelZh(value: string, label_zh: string, orig: string | null) {
    if (label_zh.trim() === (orig || '')) return;
    try { await adminApi.request(`/enums/product-categories/${encodeURIComponent(value)}`, { method: 'PUT', body: JSON.stringify({ label_zh: label_zh.trim() }) }); setCats((p) => p.map((c) => c.value === value ? { ...c, label_zh: label_zh.trim() || null } : c)); }
    catch { showToast('更新失败', 'error'); }
  }
  async function toggle(value: string) {
    try { await adminApi.request(`/enums/product-categories/${encodeURIComponent(value)}/toggle`, { method: 'PUT' }); setCats((p) => p.map((c) => c.value === value ? { ...c, is_enabled: c.is_enabled ? 0 : 1 } : c)); }
    catch { showToast('更新失败', 'error'); }
  }
  function del(cat: PCat) {
    const isGroup = !cat.parent_value;
    showConfirm({
      title: `删除${isGroup ? '大类' : '子类'} "${cat.label}"`,
      message: isGroup ? '删除大类后，其下子类会变成独立大类（不删数据）。产品分类中的该项将消失。' : '删除后，产品分类下拉中的该子类将消失。',
      requireText: '我已清楚知道删除对网站的影响', confirmLabel: '确认删除',
      onConfirm: async () => {
        try { await adminApi.request(`/enums/product-categories/${encodeURIComponent(cat.value)}`, { method: 'DELETE' }); await load(); showToast('已删除', 'success'); }
        catch { showToast('删除失败', 'error'); }
      },
    });
  }
  // 同层拖拽排序：拖动项与目标项须同一 parent（同为大类，或同一大类下的子类）。
  // onDragEnd 触发在拖动源上，故目标从 dragOver ref 取（onDragEnter 记录），不能用事件所在行。
  async function onDrop() {
    const from = dragFrom.current; const toVal = dragOver.current;
    dragFrom.current = ''; dragOver.current = ''; setDragKey('');
    if (!from || !toVal || from === toVal) return;
    const src = cats.find((c) => c.value === from);
    const tgt = cats.find((c) => c.value === toVal);
    if (!src || !tgt || (src.parent_value || null) !== (tgt.parent_value || null)) return; // 跨层不处理
    const sibs = cats.filter((c) => (c.parent_value || null) === (src.parent_value || null)).sort((a, b) => a.sort_order - b.sort_order);
    const fromIdx = sibs.findIndex((c) => c.value === from);
    const toIdx = sibs.findIndex((c) => c.value === toVal);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...sibs]; const [m] = reordered.splice(fromIdx, 1); reordered.splice(toIdx, 0, m);
    setCats((prev) => prev.map((c) => { const i = reordered.findIndex((r) => r.value === c.value); return i >= 0 ? { ...c, sort_order: i } : c; }));
    try { await adminApi.request('/enums/product-categories/reorder', { method: 'PUT', body: JSON.stringify({ values: reordered.map((c) => c.value) }) }); }
    catch { showToast('排序保存失败', 'error'); }
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">加载中…</div>;

  const toggleBtn = (c: PCat) => (
    <button onClick={() => toggle(c.value)} className={`inline-flex items-center justify-center text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${c.is_enabled ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
      {c.is_enabled ? '停用' : '启用'}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* 新增大类 */}
      <div className="flex gap-2 flex-wrap items-center rounded-xl border border-stone-200 bg-white p-3">
        <span className="text-sm font-medium text-stone-500 mr-1">新增大类</span>
        <input className={`${inputCls} w-36`} placeholder="key (如 appliances)" value={newGroup.value} onChange={(e) => setNewGroup((p) => ({ ...p, value: e.target.value }))} />
        <input className={`${inputCls} w-48`} placeholder="显示名 (如 Appliances)" value={newGroup.label} onChange={(e) => setNewGroup((p) => ({ ...p, label: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); }} />
        <input className={`${inputCls} w-28`} placeholder="中文 (可选)" value={newGroup.label_zh} onChange={(e) => setNewGroup((p) => ({ ...p, label_zh: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); }} />
        <button onClick={addGroup} disabled={!newGroup.value.trim() || !newGroup.label.trim()} className="btn-primary inline-flex items-center justify-center h-[34px] px-4 text-sm disabled:opacity-40">添加</button>
      </div>

      {groups.map((g) => (
        <div key={g.value} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {/* 大类头 */}
          <div draggable onDragStart={() => { dragFrom.current = g.value; }} onDragEnter={() => { dragOver.current = g.value; setDragKey(g.value); }} onDragEnd={onDrop} onDragOver={(e) => e.preventDefault()}
            className={`flex items-center gap-2 px-3 py-2.5 bg-stone-50 border-b border-stone-200 select-none ${dragKey === g.value ? 'ring-1 ring-[#B8864A]/40' : ''}`}>
            <span className="cursor-grab text-stone-300 text-[18px] leading-none" title="拖动排序大类">⠿</span>
            <span className="font-mono text-xs text-stone-400 w-40 shrink-0">{g.value}</span>
            <input className={`${inputCls} flex-1 font-medium`} defaultValue={g.label} onBlur={(e) => updateLabel(g.value, e.target.value, g.label)} />
            <input className={`${inputCls} w-24 shrink-0 !text-stone-500`} defaultValue={g.label_zh || ''} placeholder="中文" title="中文对照(可编辑,仅参考)" onBlur={(e) => updateLabelZh(g.value, e.target.value, g.label_zh)} />
            {toggleBtn(g)}
            <button onClick={() => del(g)} className="text-xs text-red-400 hover:text-red-600 px-1">删除</button>
          </div>
          {/* 子类 */}
          <div className="p-2 space-y-1">
            {childrenOf(g.value).map((c) => (
              <div key={c.value} draggable onDragStart={() => { dragFrom.current = c.value; }} onDragEnter={() => { dragOver.current = c.value; setDragKey(c.value); }} onDragEnd={onDrop} onDragOver={(e) => e.preventDefault()}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg select-none ${dragKey === c.value ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : 'hover:bg-stone-50'}`}>
                <span className="cursor-grab text-stone-300 text-[16px] leading-none" title="拖动排序子类">⠿</span>
                <span className="font-mono text-xs text-stone-400 w-40 shrink-0">{c.value}</span>
                <input className={`${inputCls} flex-1`} defaultValue={c.label} onBlur={(e) => updateLabel(c.value, e.target.value, c.label)} />
                <input className={`${inputCls} w-24 shrink-0 !text-stone-500`} defaultValue={c.label_zh || ''} placeholder="中文" title="中文对照(可编辑,仅参考)" onBlur={(e) => updateLabelZh(c.value, e.target.value, c.label_zh)} />
                {toggleBtn(c)}
                <button onClick={() => del(c)} className="text-xs text-red-400 hover:text-red-600 px-1">删除</button>
              </div>
            ))}
            {/* 新增子类 */}
            <div className="flex gap-2 items-center px-2 pt-1">
              <input className={`${inputCls} w-32`} placeholder="子类 key" value={newChild[g.value]?.value || ''} onChange={(e) => setNewChild((p) => ({ ...p, [g.value]: { ...(p[g.value] || { value: '', label: '', label_zh: '' }), value: e.target.value } }))} />
              <input className={`${inputCls} w-44`} placeholder="显示名" value={newChild[g.value]?.label || ''} onChange={(e) => setNewChild((p) => ({ ...p, [g.value]: { ...(p[g.value] || { value: '', label: '', label_zh: '' }), label: e.target.value } }))} onKeyDown={(e) => { if (e.key === 'Enter') addChild(g.value); }} />
              <input className={`${inputCls} w-24`} placeholder="中文" value={newChild[g.value]?.label_zh || ''} onChange={(e) => setNewChild((p) => ({ ...p, [g.value]: { ...(p[g.value] || { value: '', label: '', label_zh: '' }), label_zh: e.target.value } }))} onKeyDown={(e) => { if (e.key === 'Enter') addChild(g.value); }} />
              <button onClick={() => addChild(g.value)} className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium">+ 加子类</button>
            </div>
          </div>
        </div>
      ))}
      {groups.length === 0 && <div className="py-10 text-center text-stone-400 text-sm">还没有大类，先在上方新增一个。</div>}
    </div>
  );
}
