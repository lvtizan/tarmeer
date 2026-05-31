'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';
import { useAdminT } from '@/hooks/useAdminLang';
import { SERVICE_CATEGORIES } from '@/lib/serviceCategories';
import AdminSelect from '@/components/ui/AdminSelect';

interface ServiceCategory {
  name: string;
  sort_order: number;
  is_enabled: number;
}

interface CompanyType {
  slug: string;
  label: string;
  sort_order: number;
  active: number;
}

interface CompanyService {
  name: string;
  sort_order: number;
  active: number;
  category: string | null;
}

interface SupplierCategory {
  value: string;
  label: string;
  sort_order: number;
  is_enabled: number;
}

const ALL_CATEGORIES = [...SERVICE_CATEGORIES.map((c) => c.name)];

const inputCls = 'h-[36px] px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-[14px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white';

function ServiceRow({
  svc, idx, dragging, over, allCats,
  onDragStart, onDragEnter, onDragEnd,
  onToggle, onRename, onChangeCategory, onDelete,
}: {
  svc: CompanyService; idx: number; dragging: boolean; over: boolean; allCats: string[];
  onDragStart: () => void; onDragEnter: () => void; onDragEnd: () => void;
  onToggle: () => void; onRename: (name: string) => void;
  onChangeCategory: (cat: string | null) => void; onDelete: () => void;
}) {
  const catOptions = [
    { value: '', label: '— 未分类 —' },
    ...allCats.map((c) => ({ value: c, label: c })),
  ];
  return (
    <div
      draggable
      onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors select-none ${dragging ? 'opacity-40' : ''} ${over ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : 'hover:bg-stone-50'}`}
    >
      <span className="cursor-grab text-stone-300 hover:text-stone-400 text-[18px] leading-none shrink-0" title="拖动排序">⠿</span>
      <span className="text-xs text-stone-300 w-4 shrink-0">{idx + 1}</span>
      <input
        className={`${inputCls} flex-1 min-w-0`}
        defaultValue={svc.name}
        onBlur={(e) => onRename(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <div className="shrink-0 w-40">
        <AdminSelect size="sm" value={svc.category ?? ''} onChange={(v) => onChangeCategory(v || null)} options={catOptions} />
      </div>
      <button onClick={onToggle} className={`shrink-0 inline-flex items-center justify-center text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${svc.active ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
        {svc.active ? '停用' : '启用'}
      </button>
      <button onClick={onDelete} className="shrink-0 inline-flex items-center justify-center text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
    </div>
  );
}

function ServicesTab({ services, loading, onReload }: { services: CompanyService[]; loading: boolean; onReload: () => void; }) {
  const { t } = useAdminT();
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [newServiceName, setNewServiceName] = useState('');
  const [addingService, setAddingService] = useState(false);
  const dragIndex = useRef<number>(-1);
  const overIndex = useRef<number>(-1);
  const [draggingIdx, setDraggingIdx] = useState<number>(-1);
  const [overIdx, setOverIdx] = useState<number>(-1);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const catDragIndex = useRef<number>(-1);
  const catOverIndex = useRef<number>(-1);
  const [catDraggingIdx, setCatDraggingIdx] = useState<number>(-1);
  const [catOverIdx, setCatOverIdx] = useState<number>(-1);
  const autoRegistered = useRef<Set<string>>(new Set());
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const newCatInputRef = useRef<HTMLInputElement>(null);
  const catSubmittingRef = useRef(false);

  const loadCats = useCallback(async () => {
    try {
      const d = await adminApi.request('/enums/service-categories');
      setCategories(d.categories || []);
    } catch {}
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);

  const dbCatNames = categories.map((c) => c.name);
  const extraCats = useMemo(() => Array.from(new Set(
    services.map((s) => s.category).filter(Boolean) as string[]
  )).filter((c) => !dbCatNames.includes(c)), [services, dbCatNames.join(',')]);

  const allCats = [...dbCatNames, ...extraCats, ...ALL_CATEGORIES.filter((c) => !dbCatNames.includes(c) && !extraCats.includes(c))].filter(Boolean);
  const orphans = services.filter((s) => !s.category);

  useEffect(() => {
    const unregistered = extraCats.filter((c) => !autoRegistered.current.has(c));
    if (unregistered.length === 0) return;
    unregistered.forEach((c) => autoRegistered.current.add(c));
    const maxOrder = categories.length;
    Promise.all(
      unregistered.map((cat, i) =>
        adminApi.request('/enums/service-categories', { method: 'POST', body: JSON.stringify({ name: cat, sort_order: maxOrder + i }) }).catch(() => {})
      )
    ).then(() => loadCats());
  }, [extraCats.join(','), categories.length]);

  useEffect(() => {
    if (!selectedCat && allCats.length > 0) setSelectedCat(allCats[0]);
  }, [allCats.length]);

  const catServices = selectedCat === '__orphans__' ? orphans : services.filter((s) => s.category === selectedCat);

  function handleDragStart(idx: number) { dragIndex.current = idx; setDraggingIdx(idx); }
  function handleDragEnter(idx: number) { overIndex.current = idx; setOverIdx(idx); }
  async function handleDragEnd() {
    const from = dragIndex.current; const to = overIndex.current;
    setDraggingIdx(-1); setOverIdx(-1); dragIndex.current = -1; overIndex.current = -1;
    if (from === to || from < 0 || to < 0) return;
    const reordered = [...catServices];
    const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved);
    try {
      await adminApi.request('/enums/company-services/reorder', { method: 'PUT', body: JSON.stringify({ names: reordered.map((s) => s.name) }) });
      onReload();
    } catch { showToast('排序保存失败', 'error'); }
  }

  async function addService() {
    if (!newServiceName.trim()) return;
    setAddingService(true);
    try {
      await adminApi.request('/enums/company-services', { method: 'POST', body: JSON.stringify({ name: newServiceName.trim(), category: selectedCat !== '__orphans__' ? selectedCat : undefined, sort_order: catServices.length }) });
      setNewServiceName(''); showToast('已添加', 'success'); onReload(); loadCats();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : '添加失败', 'error'); } finally { setAddingService(false); }
  }

  async function toggleActive(svc: CompanyService) {
    try { await adminApi.request(`/enums/company-services/${encodeURIComponent(svc.name)}`, { method: 'PUT', body: JSON.stringify({ active: svc.active ? 0 : 1 }) }); onReload(); } catch { showToast('更新失败', 'error'); }
  }

  async function rename(svc: CompanyService, name: string) {
    if (!name.trim() || name === svc.name) return;
    try { await adminApi.request(`/enums/company-services/${encodeURIComponent(svc.name)}`, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) }); showToast('已更新', 'success'); onReload(); } catch { showToast('更新失败', 'error'); }
  }

  async function changeCategory(svc: CompanyService, cat: string | null) {
    if (cat === (svc.category ?? null)) return;
    try { await adminApi.request(`/enums/company-services/${encodeURIComponent(svc.name)}`, { method: 'PUT', body: JSON.stringify({ category: cat }) }); showToast('已更新分类', 'success'); onReload(); } catch { showToast('更新分类失败', 'error'); }
  }

  function deleteSvc(name: string) {
    showConfirm({ title: `删除服务类型「${name}」`, message: '该服务类型删除后，已关联此类型的公司服务数据将变为未分类。', requireText: '我已清楚知道删除服务类型对网站造成的影响', confirmLabel: '确认删除', onConfirm: async () => {
      try { await adminApi.request(`/enums/company-services/${encodeURIComponent(name)}`, { method: 'DELETE' }); showToast('已删除', 'success'); onReload(); } catch (e: unknown) { showToast(e instanceof Error ? e.message : '删除失败', 'error'); }
    } });
  }

  async function commitCatRename(oldName: string, newName: string) {
    if (!newName.trim() || newName.trim() === oldName) return;
    try {
      await adminApi.request(`/enums/service-categories/${encodeURIComponent(oldName)}/rename`, { method: 'PUT', body: JSON.stringify({ newName: newName.trim() }) });
      if (selectedCat === oldName) setSelectedCat(newName.trim());
      setCategories((prev) => prev.map((c) => c.name === oldName ? { ...c, name: newName.trim() } : c));
      showToast('分类已重命名', 'success'); onReload();
    } catch { showToast('重命名失败', 'error'); }
  }

  function deleteCategory(cat: ServiceCategory) {
    showConfirm({ title: `删除分类「${cat.name}」`, message: '该分类下的所有子服务不会被删除，但会变为未分类。', requireText: '我已知道删除对系统的影响', confirmLabel: '确认删除', onConfirm: async () => {
      try {
        await adminApi.request(`/enums/service-categories/${encodeURIComponent(cat.name)}`, { method: 'DELETE' });
        setCategories((prev) => prev.filter((c) => c.name !== cat.name));
        if (selectedCat === cat.name) setSelectedCat(allCats.filter((c) => c !== cat.name)[0] || '');
        showToast('已删除', 'success');
      } catch { showToast('删除失败', 'error'); }
    } });
  }

  function handleCatDragStart(idx: number) { catDragIndex.current = idx; setCatDraggingIdx(idx); }
  function handleCatDragEnter(idx: number) { catOverIndex.current = idx; setCatOverIdx(idx); }
  async function handleCatDragEnd() {
    const from = catDragIndex.current; const to = catOverIndex.current;
    setCatDraggingIdx(-1); setCatOverIdx(-1); catDragIndex.current = -1; catOverIndex.current = -1;
    if (from === to || from < 0 || to < 0) return;
    const reordered = [...categories]; const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved);
    setCategories(reordered);
    try { await adminApi.request('/enums/service-categories/reorder', { method: 'PUT', body: JSON.stringify({ names: reordered.map((c) => c.name) }) }); } catch { showToast('排序保存失败', 'error'); }
  }

  async function toggleCategory(cat: ServiceCategory) {
    try { await adminApi.request(`/enums/service-categories/${encodeURIComponent(cat.name)}/toggle`, { method: 'PUT' }); setCategories((prev) => prev.map((c) => c.name === cat.name ? { ...c, is_enabled: c.is_enabled ? 0 : 1 } : c)); } catch { showToast('更新失败', 'error'); }
  }

  async function commitNewCategory() {
    if (catSubmittingRef.current) return;
    const name = newCategoryName.trim();
    if (!name) { setAddingCategory(false); setNewCategoryName(''); return; }
    catSubmittingRef.current = true;
    try {
      await adminApi.request('/enums/service-categories', { method: 'POST', body: JSON.stringify({ name, sort_order: categories.length }) });
      await loadCats(); setSelectedCat(name); showToast('分类已创建', 'success');
    } catch { showToast('创建失败', 'error'); } finally { catSubmittingRef.current = false; setAddingCategory(false); setNewCategoryName(''); }
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">加载中…</div>;

  return (
    <div className="flex gap-4 items-start min-h-[500px]">
      <div className="w-[420px] shrink-0 bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">分类（拖动排序）</p>
          <button onClick={() => { setAddingCategory(true); setNewCategoryName(''); setTimeout(() => newCatInputRef.current?.focus(), 50); }} className="text-xs text-[#b8864a] hover:text-[#a07040] font-medium transition-colors">+ 新增</button>
        </div>
        <div className="p-2 space-y-0.5">
          {allCats.map((cat, catIdx) => {
            const count = services.filter((s) => s.category === cat).length;
            const activeCount = services.filter((s) => s.category === cat && s.active).length;
            const isSelected = selectedCat === cat;
            const catMeta = categories.find((c) => c.name === cat);
            const isEnabled = catMeta ? !!catMeta.is_enabled : true;
            const isDragging = catDraggingIdx === catIdx;
            const isOver = catOverIdx === catIdx && catDraggingIdx !== catIdx;
            return (
              <div key={cat} draggable={!!catMeta}
                onDragStart={() => catMeta && handleCatDragStart(catIdx)} onDragEnter={() => catMeta && handleCatDragEnter(catIdx)}
                onDragEnd={handleCatDragEnd} onDragOver={(e) => e.preventDefault()} onClick={() => setSelectedCat(cat)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors select-none ${isSelected ? 'bg-[#b8864a]/8' : 'hover:bg-stone-50'} ${isDragging ? 'opacity-40' : ''} ${isOver ? 'bg-amber-50 ring-1 ring-[#B8864A]/30' : ''}`}
              >
                <span className={`cursor-grab text-[18px] leading-none shrink-0 ${catMeta ? 'text-stone-300 hover:text-stone-400' : 'invisible'}`} title="拖动排序">⠿</span>
                <input key={cat} className={`${inputCls} flex-1 min-w-0 cursor-pointer focus:cursor-text ${!isEnabled ? 'opacity-50' : ''}`} defaultValue={cat}
                  onClick={(e) => e.stopPropagation()} onBlur={(e) => commitCatRename(cat, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { (e.target as HTMLInputElement).value = cat; (e.target as HTMLInputElement).blur(); } }}
                />
                <span className={`text-[11px] shrink-0 tabular-nums ${isSelected ? 'text-[#b8864a]/70' : 'text-stone-400'}`}>{activeCount}/{count}</span>
                {catMeta ? (
                  <button onClick={(e) => { e.stopPropagation(); toggleCategory(catMeta); }} title={isEnabled ? '停用' : '启用'}
                    className={`shrink-0 inline-flex items-center justify-center text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${isEnabled ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {isEnabled ? '停用' : '启用'}
                  </button>
                ) : <span className="w-[42px] shrink-0" />}
                {catMeta ? (
                  <button onClick={(e) => { e.stopPropagation(); deleteCategory(catMeta); }} className="shrink-0 inline-flex items-center justify-center text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
                ) : <span className="w-[28px] shrink-0" />}
              </div>
            );
          })}
          {orphans.length > 0 && (
            <button onClick={() => setSelectedCat('__orphans__')} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm transition-colors ${selectedCat === '__orphans__' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-amber-600 hover:bg-amber-50'}`}>
              <span>其他（未分类）</span><span className="text-[11px] shrink-0 ml-1">{orphans.length}</span>
            </button>
          )}
          {addingCategory && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <input ref={newCatInputRef} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitNewCategory(); if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName(''); } }}
                onBlur={commitNewCategory} placeholder="分类名称…"
                className="flex-1 min-w-0 h-8 px-3 text-sm rounded-xl border border-[#b8864a]/40 bg-white focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#2c2c2c]">{selectedCat === '__orphans__' ? '其他（未分类）' : selectedCat}</h3>
            <p className="text-xs text-stone-400 mt-0.5">{catServices.length} 项 · {catServices.filter((s) => s.active).length} 启用 · 拖动 ⠿ 调整顺序</p>
          </div>
          <div className="flex items-center gap-2">
            <input className={`${inputCls} flex-1 min-w-0`} placeholder="新服务名称…" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addService()} />
            <button onClick={addService} disabled={addingService || !newServiceName.trim()} className="btn-primary inline-flex items-center justify-center h-[36px] px-4 text-sm disabled:opacity-40">{t('Add', '添加')}</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-2">
          {catServices.length === 0 ? (
            <p className="px-3 py-6 text-sm text-stone-400 text-center">暂无服务，点击右上方添加</p>
          ) : (
            <div className="space-y-0.5">
              {catServices.map((svc, idx) => (
                <ServiceRow key={svc.name} svc={svc} idx={idx} dragging={draggingIdx === idx} over={overIdx === idx && draggingIdx !== idx} allCats={allCats}
                  onDragStart={() => handleDragStart(idx)} onDragEnter={() => handleDragEnter(idx)} onDragEnd={handleDragEnd}
                  onToggle={() => toggleActive(svc)} onRename={(name) => rename(svc, name)} onChangeCategory={(cat) => changeCategory(svc, cat)} onDelete={() => deleteSvc(svc.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierCategoriesTab() {
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

export default function AdminEnumsPage() {
  const { t } = useAdminT();
  const [tab, setTab] = useState<'types' | 'services' | 'supplier_categories'>('types');
  const [types, setTypes] = useState<CompanyType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [addingType, setAddingType] = useState(false);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  const loadTypes = useCallback(async () => {
    setTypesLoading(true);
    try { const data = await adminApi.request('/enums/company-types'); setTypes(data.types); } catch { showToast('加载类型失败', 'error'); } finally { setTypesLoading(false); }
  }, []);

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    try { const data = await adminApi.request('/enums/company-services'); setServices(data.services); } catch { showToast('加载服务失败', 'error'); } finally { setServicesLoading(false); }
  }, []);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { loadServices(); }, [loadServices]);

  async function addType() {
    if (!newTypeSlug.trim() || !newTypeLabel.trim()) return;
    setAddingType(true);
    try { await adminApi.request('/enums/company-types', { method: 'POST', body: JSON.stringify({ slug: newTypeSlug.trim(), label: newTypeLabel.trim() }) }); setNewTypeSlug(''); setNewTypeLabel(''); showToast('类型已添加', 'success'); loadTypes(); } catch (e: unknown) { showToast(e instanceof Error ? e.message : '添加失败', 'error'); } finally { setAddingType(false); }
  }

  async function toggleTypeActive(type: CompanyType) {
    try { await adminApi.request(`/enums/company-types/${type.slug}`, { method: 'PUT', body: JSON.stringify({ active: type.active ? 0 : 1 }) }); setTypes((prev) => prev.map((tp) => tp.slug === type.slug ? { ...tp, active: tp.active ? 0 : 1 } : tp)); } catch { showToast('更新失败', 'error'); }
  }

  async function updateTypeLabel(type: CompanyType, label: string) {
    if (!label.trim() || label === type.label) return;
    try { await adminApi.request(`/enums/company-types/${type.slug}`, { method: 'PUT', body: JSON.stringify({ label: label.trim() }) }); setTypes((prev) => prev.map((tp) => tp.slug === type.slug ? { ...tp, label: label.trim() } : tp)); } catch { showToast('更新失败', 'error'); }
  }

  function deleteType(slug: string) {
    showConfirm({ title: `删除公司类型「${slug}」`, message: '该公司类型删除后，已使用此类型的公司数据将受到影响，筛选器中的类型将消失。此操作不可恢复。', requireText: '我已清楚知道删除公司类型对网站造成的影响', confirmLabel: '确认删除', onConfirm: async () => {
      try { await adminApi.request(`/enums/company-types/${slug}`, { method: 'DELETE' }); setTypes((prev) => prev.filter((tp) => tp.slug !== slug)); } catch (e: unknown) { showToast(e instanceof Error ? e.message : '删除失败', 'error'); }
    } });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-[#2c2c2c] mb-1">公司类型 & 服务管理</h1>
      <p className="text-sm text-stone-500 mb-5">管理公司注册时可选的类型和服务分类。</p>

      <div className="flex gap-1 mb-5 border-b border-stone-200">
        {(['types', 'services', 'supplier_categories'] as const).map((key) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === key ? 'bg-white border border-b-white border-stone-200 text-[#b8864a] -mb-px' : 'text-stone-500 hover:text-stone-700'}`}>
            {key === 'types' ? `公司类型 (${types.length})` : key === 'services' ? `服务分类 (${services.length})` : '供应商分类'}
          </button>
        ))}
      </div>

      {tab === 'types' && (
        <div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
            <p className="text-sm font-medium text-stone-500 mb-3">添加新类型</p>
            <div className="flex gap-2 flex-wrap">
              <input className={`${inputCls} w-40`} placeholder="slug (如 new_trade)" value={newTypeSlug} onChange={(e) => setNewTypeSlug(e.target.value)} />
              <input className={`${inputCls} w-52`} placeholder="英文名称" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} />
              <button onClick={addType} disabled={addingType || !newTypeSlug.trim() || !newTypeLabel.trim()} className="btn-primary inline-flex items-center justify-center h-[36px] px-4 text-sm disabled:opacity-40">{t('Add', '添加')}</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {typesLoading ? <div className="p-8 text-center text-stone-400 text-sm">加载中…</div> : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-stone-500 font-medium">Slug</th>
                    <th className="text-left px-4 py-2.5 text-stone-500 font-medium">英文名称</th>
                    <th className="text-left px-4 py-2.5 text-stone-500 font-medium w-20">启用</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.slug} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                      <td className="px-4 py-2.5 font-mono text-xs text-stone-500">{type.slug}</td>
                      <td className="px-4 py-2.5">
                        <input className={`${inputCls} w-full`} defaultValue={type.label} onBlur={(e) => updateTypeLabel(type, e.target.value)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleTypeActive(type)} className={`inline-flex items-center justify-center text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${type.active ? 'bg-stone-100 text-stone-400 hover:bg-stone-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {type.active ? '停用' : '启用'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => deleteType(type.slug)} className="inline-flex items-center justify-center text-xs text-red-400 hover:text-red-600 transition-colors">删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'services' && <ServicesTab services={services} loading={servicesLoading} onReload={loadServices} />}
      {tab === 'supplier_categories' && <SupplierCategoriesTab />}
    </div>
  );
}
