import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { adminApi } from '../../lib/adminApi';
import AdminSelect from '../ui/AdminSelect';
import PhoneCountryInput from '../ui/PhoneCountryInput';

interface Props {
  type: 'scraped' | 'profile';
  id: number;
  onClose: () => void;
  onSaved: () => void;
}

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

// ── Multi-select Company Type Dropdown ──────────────────────────────────────
function MultiTypeSelect({
  selected,
  onToggle,
  options,
}: {
  selected: string[];
  onToggle: (slug: string) => void;
  options: { slug: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabels = options.filter(o => selected.includes(o.slug)).map(o => o.label);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full h-9 px-3 rounded-lg border border-stone-200 bg-stone-50/80 text-left cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
      >
        <span className="truncate text-sm text-[#1c1917]">
          {selectedLabels.length === 0
            ? <span className="text-stone-400">Select types…</span>
            : selectedLabels.join(', ')}
        </span>
        <ChevronDown className={`flex-shrink-0 ml-2 w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && dropPos && createPortal(
        <div
          className="fixed z-[9999] bg-white border border-stone-200 rounded-2xl shadow-lg overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: 260 }}
        >
          {options.map(opt => {
            const isOn = selected.includes(opt.slug);
            return (
              <button
                key={opt.slug}
                type="button"
                onClick={() => onToggle(opt.slug)}
                className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm transition hover:bg-stone-50 ${isOn ? 'text-[#b8864a] font-medium' : 'text-[#1c1917]'}`}
              >
                <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition ${isOn ? 'bg-[#b8864a] border-[#b8864a]' : 'border-stone-300'}`}>
                  {isOn && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function CompanyEditModal({ type, id, onClose, onSaved }: Props) {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Enum data from backend
  const [companyTypes, setCompanyTypes] = useState<{ slug: string; label: string }[]>([]);
  const [serviceCategories, setServiceCategories] = useState<{ name: string; is_enabled: boolean }[]>([]);
  const [allServices, setAllServices] = useState<{ name: string; category: string | null; active: boolean }[]>([]);
  const [activeServiceTab, setActiveServiceTab] = useState('');

  // Load enums in parallel
  useEffect(() => {
    Promise.all([
      adminApi.request('/enums/company-types').catch(() => ({ types: [] })),
      adminApi.request('/enums/service-categories').catch(() => ({ categories: [] })),
      adminApi.request('/enums/company-services').catch(() => ({ services: [] })),
    ]).then(([typesRes, catsRes, svcsRes]: any[]) => {
      const types = (typesRes?.types || []).filter((t: any) => t.active !== 0);
      const cats = (catsRes?.categories || []).filter((c: any) => c.is_enabled !== 0);
      const svcs = svcsRes?.services || [];
      setCompanyTypes(types);
      setServiceCategories(cats);
      setAllServices(svcs);
      if (cats.length > 0) setActiveServiceTab(cats[0].name);
    });
  }, []);

  // Load company data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoint = type === 'scraped'
          ? `/companies/${id}/detail`
          : `/roles/companies/${id}/detail`;
        const result = await adminApi.request(endpoint);
        const raw = result.company || result.profile || {};

        // Normalize arrays
        ['services', 'specialties'].forEach(k => {
          if (typeof raw[k] === 'string') {
            try { raw[k] = JSON.parse(raw[k]); } catch { raw[k] = []; }
          }
          if (!Array.isArray(raw[k])) raw[k] = [];
        });

        // Normalize company_type → always array
        if (typeof raw.company_type === 'string') {
          if (raw.company_type.startsWith('[')) {
            try { raw.company_type = JSON.parse(raw.company_type); } catch { raw.company_type = raw.company_type ? [raw.company_type] : []; }
          } else {
            raw.company_type = raw.company_type ? [raw.company_type] : [];
          }
        }
        if (!Array.isArray(raw.company_type)) raw.company_type = [];

        setData(raw);
      } catch (err: any) {
        setError(err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const endpoint = type === 'scraped'
        ? `/companies/${id}/edit`
        : `/roles/companies/${id}/edit`;
      await adminApi.request(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: any) => setData(prev => ({ ...prev, [key]: val }));

  const toggleArrayItem = (key: string, item: string) => {
    const arr: string[] = data[key] || [];
    set(key, arr.includes(item) ? arr.filter((x: string) => x !== item) : [...arr, item]);
  };

  const toggleType = (slug: string) => {
    const current: string[] = data.company_type || [];
    set('company_type', current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug]);
  };

  // Group active services by category
  const servicesByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    allServices
      .filter(s => s.active !== false && (s as any).active !== 0)
      .forEach(s => {
        const cat = s.category || 'Other';
        if (!map[cat]) map[cat] = [];
        map[cat].push(s.name);
      });
    return map;
  }, [allServices]);

  const tabServices = servicesByCategory[activeServiceTab] || [];
  const selectedServices: string[] = data.services || [];

  const inputCls = "w-full h-9 px-3 rounded-lg border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition";
  const labelCls = "block text-xs font-medium text-stone-500 mb-1";

  const isScraped = type === 'scraped';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-stone-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* 50vw width, min 640px, max 900px */}
      <div
        className="bg-white rounded-2xl w-[50vw] min-w-[640px] max-w-[900px] h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">
            Edit {isScraped ? 'Scraped Company' : 'Company Profile'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg transition">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* Row 1: Name + Contact/Name AR */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isScraped ? 'Name (EN)' : 'Company Name'}</label>
              <input className={inputCls} value={data[isScraped ? 'name_en' : 'company_name'] || ''}
                onChange={e => set(isScraped ? 'name_en' : 'company_name', e.target.value)} />
            </div>
            {isScraped ? (
              <div>
                <label className={labelCls}>Name (AR)</label>
                <input className={inputCls} value={data.name_ar || ''} onChange={e => set('name_ar', e.target.value)} />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Contact Person</label>
                <input className={inputCls} value={data.contact_person || ''} onChange={e => set('contact_person', e.target.value)} />
              </div>
            )}
          </div>

          {/* Row 2: Phone + Email/Website */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <PhoneCountryInput value={data.phone || ''} onChange={val => set('phone', val)} size="sm" />
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'Email' : 'Website'}</label>
              <input className={inputCls} value={data[isScraped ? 'email' : 'website'] || ''}
                onChange={e => set(isScraped ? 'email' : 'website', e.target.value)} />
            </div>
          </div>

          {isScraped && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Website</label>
                <input className={inputCls} value={data.website || ''} onChange={e => set('website', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input className={inputCls} value={data.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
              </div>
            </div>
          )}

          {/* Row 3: City + Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>City</label>
              <AdminSelect
                size="sm"
                value={data.city || ''}
                onChange={val => set('city', val)}
                options={[{ value: '', label: 'Select' }, ...EMIRATES.map(c => ({ value: c, label: c }))]}
                className="w-full"
              />
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'Area' : 'Address'}</label>
              <input className={inputCls} value={data[isScraped ? 'area' : 'address'] || ''}
                onChange={e => set(isScraped ? 'area' : 'address', e.target.value)} />
            </div>
          </div>

          {isScraped && (
            <div>
              <label className={labelCls}>Full Address</label>
              <input className={inputCls} value={data.address || ''} onChange={e => set('address', e.target.value)} />
            </div>
          )}

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none"
              rows={5}
              value={data.description || ''}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Row: Est. Year + Trade License */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isScraped ? 'Year Established' : 'Est. Year'}</label>
              <input type="number" className={inputCls}
                value={data[isScraped ? 'year_established' : 'establishment_year'] || ''}
                onChange={e => set(isScraped ? 'year_established' : 'establishment_year', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'License Number' : 'Trade License No.'}</label>
              <input className={inputCls}
                value={data[isScraped ? 'license_number' : 'trade_license_number'] || ''}
                onChange={e => set(isScraped ? 'license_number' : 'trade_license_number', e.target.value)} />
            </div>
          </div>

          {/* Company Type (multi-select) + Status */}
          {!isScraped && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company Type</label>
                <MultiTypeSelect
                  selected={data.company_type || []}
                  onToggle={toggleType}
                  options={companyTypes}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <AdminSelect
                  size="sm"
                  value={data.status || ''}
                  onChange={val => set('status', val)}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {isScraped && (
            <div className="grid grid-cols-3 gap-4">
              {[['Instagram', 'instagram'], ['Facebook', 'facebook'], ['LinkedIn', 'linkedin']].map(([label, key]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input className={inputCls} value={data[key] || ''} onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {/* Services — tabbed by category */}
          {serviceCategories.length > 0 && (
            <div>
              <label className={labelCls}>Services</label>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1 mt-1 mb-3">
                {serviceCategories.map(cat => {
                  const servicesInCat = servicesByCategory[cat.name] || [];
                  const selectedInCat = servicesInCat.filter(s => selectedServices.includes(s)).length;
                  const isActive = activeServiceTab === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setActiveServiceTab(cat.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#b8864a] text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {cat.name}
                      {selectedInCat > 0 && (
                        <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-white/30 text-white' : 'bg-[#b8864a] text-white'
                        }`}>
                          {selectedInCat}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Services for active tab */}
              <div className="flex flex-wrap gap-2 min-h-[48px]">
                {tabServices.length === 0 ? (
                  <span className="text-xs text-stone-400">No services in this category</span>
                ) : (
                  tabServices.map(s => {
                    const on = selectedServices.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleArrayItem('services', s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                          on ? 'bg-[#b8864a] text-white border-[#b8864a]' : 'bg-white border-stone-200 text-stone-700 hover:border-[#b8864a]/60 hover:text-[#b8864a]'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-stone-200 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 h-9 text-sm text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 h-9 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium transition flex items-center gap-1.5"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
