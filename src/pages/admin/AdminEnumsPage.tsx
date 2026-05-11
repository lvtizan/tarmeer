import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { showToast } from '../../components/ui/Toast';
import { useAdminT } from '../../hooks/useAdminLang';
import { SERVICE_CATEGORIES } from '../../lib/serviceCategories';
import AdminSelect from '../../components/ui/AdminSelect';
import { invalidateServiceGroupsCache } from '../../hooks/useServiceGroups';

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

export default function AdminEnumsPage() {
  const { t } = useAdminT();
  const [tab, setTab] = useState<'types' | 'services'>('types');

  // ── Types state ──
  const [types, setTypes] = useState<CompanyType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeOrder, setNewTypeOrder] = useState('');
  const [addingType, setAddingType] = useState(false);

  // ── Services state ──
  const [services, setServices] = useState<CompanyService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceOrder, setNewServiceOrder] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Orphan multi-select + move state ──
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState('');
  const [moving, setMoving] = useState(false);

  const loadTypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const data = await adminApi.request('/enums/company-types');
      setTypes(data.types);
    } catch {
      showToast(t('Failed to load types', '加载类型失败'), 'error');
    } finally {
      setTypesLoading(false);
    }
  }, [t]);

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const data = await adminApi.request('/enums/company-services');
      setServices(data.services);
    } catch {
      showToast(t('Failed to load services', '加载服务失败'), 'error');
    } finally {
      setServicesLoading(false);
    }
  }, [t]);

  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { loadServices(); }, [loadServices]);

  // ── Type actions ──
  async function addType() {
    if (!newTypeSlug.trim() || !newTypeLabel.trim()) return;
    setAddingType(true);
    try {
      await adminApi.request('/enums/company-types', {
        method: 'POST',
        body: JSON.stringify({ slug: newTypeSlug.trim(), label: newTypeLabel.trim(), sort_order: Number(newTypeOrder) || 0 }),
      });
      setNewTypeSlug(''); setNewTypeLabel(''); setNewTypeOrder('');
      showToast(t('Type added', '类型已添加'), 'success');
      loadTypes();
    } catch (e: any) {
      showToast(e.message || t('Failed to add type', '添加失败'), 'error');
    } finally {
      setAddingType(false);
    }
  }

  async function toggleTypeActive(type: CompanyType) {
    try {
      await adminApi.request(`/enums/company-types/${type.slug}`, {
        method: 'PUT',
        body: JSON.stringify({ active: type.active ? 0 : 1 }),
      });
      setTypes((prev) => prev.map((t) => t.slug === type.slug ? { ...t, active: t.active ? 0 : 1 } : t));
      showToast(t('Updated', '已更新'), 'success');
    } catch {
      showToast(t('Update failed', '更新失败'), 'error');
    }
  }

  async function updateTypeLabel(type: CompanyType, label: string) {
    if (!label.trim() || label === type.label) return;
    try {
      await adminApi.request(`/enums/company-types/${type.slug}`, {
        method: 'PUT',
        body: JSON.stringify({ label: label.trim() }),
      });
      setTypes((prev) => prev.map((t) => t.slug === type.slug ? { ...t, label: label.trim() } : t));
      showToast(t('Label updated', '标签已更新'), 'success');
    } catch {
      showToast(t('Update failed', '更新失败'), 'error');
    }
  }

  async function deleteType(slug: string) {
    if (!confirm(t(`Delete type "${slug}"?`, `确定删除类型 "${slug}"？`))) return;
    try {
      await adminApi.request(`/enums/company-types/${slug}`, { method: 'DELETE' });
      setTypes((prev) => prev.filter((t) => t.slug !== slug));
      showToast(t('Deleted', '已删除'), 'success');
    } catch (e: any) {
      showToast(e.message || t('Delete failed', '删除失败'), 'error');
    }
  }

  // ── Service actions ──
  async function addService() {
    if (!newServiceName.trim()) return;
    setAddingService(true);
    try {
      await adminApi.request('/enums/company-services', {
        method: 'POST',
        body: JSON.stringify({ name: newServiceName.trim(), sort_order: Number(newServiceOrder) || 0 }),
      });
      setNewServiceName(''); setNewServiceOrder('');
      showToast(t('Service added', '服务已添加'), 'success');
      loadServices();
    } catch (e: any) {
      showToast(e.message || t('Failed to add service', '添加失败'), 'error');
    } finally {
      setAddingService(false);
    }
  }

  async function toggleServiceActive(svc: CompanyService) {
    try {
      await adminApi.request(`/enums/company-services/${encodeURIComponent(svc.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ active: svc.active ? 0 : 1 }),
      });
      setServices((prev) => prev.map((s) => s.name === svc.name ? { ...s, active: s.active ? 0 : 1 } : s));
      showToast(t('Updated', '已更新'), 'success');
    } catch {
      showToast(t('Update failed', '更新失败'), 'error');
    }
  }

  async function updateServiceName(svc: CompanyService, name: string) {
    if (!name.trim() || name === svc.name) return;
    try {
      await adminApi.request(`/enums/company-services/${encodeURIComponent(svc.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      setServices((prev) => prev.map((s) => s.name === svc.name ? { ...s, name: name.trim() } : s));
      showToast(t('Updated', '已更新'), 'success');
    } catch {
      showToast(t('Update failed', '更新失败'), 'error');
    }
  }

  async function deleteService(name: string) {
    if (!confirm(t(`Delete service "${name}"?`, `确定删除服务 "${name}"？`))) return;
    try {
      await adminApi.request(`/enums/company-services/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setServices((prev) => prev.filter((s) => s.name !== name));
      showToast(t('Deleted', '已删除'), 'success');
    } catch (e: any) {
      showToast(e.message || t('Delete failed', '删除失败'), 'error');
    }
  }

  async function moveOrphans() {
    if (!moveTarget || selectedOrphans.size === 0) return;
    setMoving(true);
    try {
      await adminApi.request('/enums/company-services/batch-categorize', {
        method: 'PUT',
        body: JSON.stringify({ names: Array.from(selectedOrphans), category: moveTarget }),
      });
      // Update local state: set category on moved services
      setServices((prev) =>
        prev.map((s) => selectedOrphans.has(s.name) ? { ...s, category: moveTarget } : s)
      );
      invalidateServiceGroupsCache();
      setSelectedOrphans(new Set());
      setMoveTarget('');
      showToast(
        t(`Moved ${selectedOrphans.size} service(s) to "${moveTarget}"`, `已将 ${selectedOrphans.size} 项移至"${moveTarget}"`),
        'success'
      );
    } catch (e: any) {
      showToast(e.message || t('Move failed', '移动失败'), 'error');
    } finally {
      setMoving(false);
    }
  }

  const inputCls = 'h-[38px] px-3 rounded-xl border border-stone-200 bg-stone-50/80 text-[14px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white';

  return (
    <>
      <Helmet><title>{t('Enum Management', '枚举管理')} — Tarmeer Admin</title></Helmet>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-1">{t('Company Type & Service Management', '公司类型 & 服务管理')}</h1>
        <p className="text-sm text-stone-500 mb-6">{t('Manage the types and services available when companies register.', '管理公司注册时可选的类型和服务分类。')}</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-stone-200">
          {(['types', 'services'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === key
                  ? 'bg-white border border-b-white border-stone-200 text-[#b8864a] -mb-px'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {key === 'types'
                ? t(`Company Types (${types.length})`, `公司类型 (${types.length})`)
                : t(`Services (${services.length})`, `服务分类 (${services.length})`)}
            </button>
          ))}
        </div>

        {/* ── Types Tab ── */}
        {tab === 'types' && (
          <div>
            {/* Add form */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
              <p className="text-sm font-medium text-stone-500 mb-3">{t('Add New Type', '添加新类型')}</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  className={`${inputCls} w-40`}
                  placeholder={t('slug (e.g. new_trade)', 'slug (如 new_trade)')}
                  value={newTypeSlug}
                  onChange={(e) => setNewTypeSlug(e.target.value)}
                />
                <input
                  className={`${inputCls} w-48`}
                  placeholder={t('English label', '英文名称')}
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                />
                <input
                  className={`${inputCls} w-20`}
                  placeholder={t('Order', '排序')}
                  type="number"
                  value={newTypeOrder}
                  onChange={(e) => setNewTypeOrder(e.target.value)}
                />
                <button
                  onClick={addType}
                  disabled={addingType || !newTypeSlug.trim() || !newTypeLabel.trim()}
                  className="btn-primary h-[38px] px-4 text-sm disabled:opacity-40"
                >
                  {t('Add', '添加')}
                </button>
              </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {typesLoading ? (
                <div className="p-8 text-center text-stone-400 text-sm">{t('Loading…', '加载中…')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-stone-500 font-medium w-8">#</th>
                      <th className="text-left px-4 py-2.5 text-stone-500 font-medium">{t('Slug', 'Slug')}</th>
                      <th className="text-left px-4 py-2.5 text-stone-500 font-medium">{t('Label (English)', '英文名称')}</th>
                      <th className="text-left px-4 py-2.5 text-stone-500 font-medium w-24">{t('Active', '启用')}</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((type) => (
                      <tr key={type.slug} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                        <td className="px-4 py-2.5 text-stone-400">{type.sort_order}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-stone-600">{type.slug}</td>
                        <td className="px-4 py-2.5">
                          <input
                            className={`${inputCls} w-full`}
                            defaultValue={type.label}
                            onBlur={(e) => updateTypeLabel(type, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => toggleTypeActive(type)}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                              type.active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {type.active ? t('On', '启用') : t('Off', '停用')}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => deleteType(type.slug)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            {t('Delete', '删除')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Services Tab ── */}
        {tab === 'services' && (
          <div>
            {/* Add form */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
              <p className="text-sm font-medium text-stone-500 mb-3">{t('Add New Service', '添加新服务')}</p>
              <div className="flex gap-2 flex-wrap">
                <select
                  className={`${inputCls} w-52`}
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                >
                  <option value="">{t('Parent Category', '所属大类')}</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <input
                  className={`${inputCls} flex-1 min-w-48`}
                  placeholder={t('Sub-service name (English)', '子服务名称（英文）')}
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addService()}
                />
                <input
                  className={`${inputCls} w-20`}
                  placeholder={t('Order', '排序')}
                  type="number"
                  value={newServiceOrder}
                  onChange={(e) => setNewServiceOrder(e.target.value)}
                />
                <button
                  onClick={addService}
                  disabled={addingService || !newServiceName.trim()}
                  className="btn-primary h-[38px] px-4 text-sm disabled:opacity-40"
                >
                  {t('Add', '添加')}
                </button>
              </div>
            </div>

            {/* Grouped list */}
            {servicesLoading ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 text-sm">{t('Loading…', '加载中…')}</div>
            ) : (() => {
              // Build a lookup: service name → DB record
              const svcMap = new Map(services.map((s) => [s.name, s]));
              // Track which names have been shown (to catch orphans)
              const shownNames = new Set<string>();

              const rows = SERVICE_CATEGORIES.map((cat) => {
                // Services explicitly categorized to this cat in DB
                const dbCatSubs = services
                  .filter((s) => s.category === cat.name)
                  .map((s) => s.name);
                // Hardcoded subs that are in DB
                const hardcodedSubs = cat.subs.filter((sub) => svcMap.has(sub));
                // Merge (DB category takes precedence, then hardcoded)
                const allSubsSet = new Set([...dbCatSubs, ...hardcodedSubs]);
                const allSubs = Array.from(allSubsSet);
                allSubs.forEach((n) => shownNames.add(n));
                return { cat, allSubs };
              });

              // Orphaned services: not in any hardcoded category subs AND no DB category set
              const orphans = services.filter((s) => !shownNames.has(s.name));

              const toggleGroup = (name: string) => {
                setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(name)) next.delete(name); else next.add(name);
                  return next;
                });
              };

              const ServiceRow = ({ svc, idx }: { svc: CompanyService; idx: number }) => (
                <tr key={svc.name} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="px-4 py-2.5 text-stone-400 text-xs w-8">{idx + 1}</td>
                  <td className="px-4 py-2.5 pl-8">
                    <input
                      className={`${inputCls} w-full`}
                      defaultValue={svc.name}
                      onBlur={(e) => updateServiceName(svc, e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2.5 w-24">
                    <button
                      onClick={() => toggleServiceActive(svc)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        svc.active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {svc.active ? t('On', '启用') : t('Off', '停用')}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right w-16">
                    <button
                      onClick={() => deleteService(svc.name)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      {t('Delete', '删除')}
                    </button>
                  </td>
                </tr>
              );

              return (
                <div className="space-y-3">
                  {rows.map(({ cat, allSubs }) => {
                    const isCollapsed = collapsedGroups.has(cat.name);
                    const activeCount = allSubs.filter((n) => svcMap.get(n)?.active).length;
                    return (
                      <div key={cat.name} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                        {/* Category header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(cat.name)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-sm text-stone-800">{cat.name}</span>
                            <span className="text-xs text-stone-400">
                              {allSubs.length} {t('services', '项')} · {activeCount} {t('active', '启用')}
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-stone-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                          />
                        </button>

                        {/* Services under this category */}
                        {!isCollapsed && (
                          <table className="w-full text-sm">
                            <tbody>
                              {allSubs.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-4 py-3 text-xs text-stone-400 italic pl-8">
                                    {t('No services yet — add one above', '暂无子服务，通过上方表单添加')}
                                  </td>
                                </tr>
                              ) : (
                                allSubs.map((name, idx) => {
                                  const svc = svcMap.get(name);
                                  return svc ? <ServiceRow key={name} svc={svc} idx={idx} /> : null;
                                })
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}

                  {/* Orphaned services not in any category */}
                  {orphans.length > 0 && (() => {
                    const allOrphanNames = orphans.map((s) => s.name);
                    const allSelected = allOrphanNames.length > 0 && allOrphanNames.every((n) => selectedOrphans.has(n));
                    const someSelected = selectedOrphans.size > 0;

                    const toggleAll = () => {
                      if (allSelected) {
                        setSelectedOrphans(new Set());
                      } else {
                        setSelectedOrphans(new Set(allOrphanNames));
                      }
                    };

                    const toggleOne = (name: string) => {
                      setSelectedOrphans((prev) => {
                        const next = new Set(prev);
                        if (next.has(name)) next.delete(name); else next.add(name);
                        return next;
                      });
                    };

                    const CATEGORY_OPTIONS = [
                      { value: '', label: t('Select category…', '选择目标分类…') },
                      ...SERVICE_CATEGORIES.map((c) => ({ value: c.name, label: c.name })),
                    ];

                    return (
                      <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-50">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={toggleAll}
                            className="w-4 h-4 rounded accent-[#b8864a] cursor-pointer"
                          />
                          <span className="font-semibold text-sm text-amber-800">{t('Other (unclassified)', '其他（未分类）')}</span>
                          <span className="text-xs text-amber-600">{orphans.length} {t('services', '项')}</span>

                          {someSelected && (
                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-xs text-amber-700">{selectedOrphans.size} {t('selected', '已选')}</span>
                              <AdminSelect
                                size="sm"
                                value={moveTarget}
                                onChange={setMoveTarget}
                                options={CATEGORY_OPTIONS}
                              />
                              <button
                                onClick={moveOrphans}
                                disabled={!moveTarget || moving}
                                className="h-9 px-3 rounded-lg bg-[#b8864a] text-white text-xs font-medium disabled:opacity-40 hover:bg-[#a07540] transition-colors whitespace-nowrap"
                              >
                                {moving ? t('Moving…', '移动中…') : t('Move to category', '归入分类')}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Rows with checkboxes */}
                        <table className="w-full text-sm">
                          <tbody>
                            {orphans.map((svc, idx) => (
                              <tr key={svc.name} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                                <td className="pl-4 py-2.5 w-8">
                                  <input
                                    type="checkbox"
                                    checked={selectedOrphans.has(svc.name)}
                                    onChange={() => toggleOne(svc.name)}
                                    className="w-4 h-4 rounded accent-[#b8864a] cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-stone-400 text-xs w-8">{idx + 1}</td>
                                <td className="px-4 py-2.5 pl-8">
                                  <input
                                    className={`${inputCls} w-full`}
                                    defaultValue={svc.name}
                                    onBlur={(e) => updateServiceName(svc, e.target.value)}
                                  />
                                </td>
                                <td className="px-4 py-2.5 w-24">
                                  <button
                                    onClick={() => toggleServiceActive(svc)}
                                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                                      svc.active
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                    }`}
                                  >
                                    {svc.active ? t('On', '启用') : t('Off', '停用')}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 text-right w-16">
                                  <button
                                    onClick={() => deleteService(svc.name)}
                                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    {t('Delete', '删除')}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
