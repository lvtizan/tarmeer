import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Globe, MapPin, Phone, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { FormInput, FormTextarea, FormLabel, FormTag } from '../form/FormInput';
import AdminSelect from '../ui/AdminSelect';
import { SERVICE_CATEGORIES, SPACE_TYPES, MAX_SERVICE_CATEGORIES, getActiveParents } from '../../lib/serviceCategories';

const GCC_DIAL_CODES = [
  { code: '+971', label: '🇦🇪 UAE (+971)' },
  { code: '+966', label: '🇸🇦 KSA (+966)' },
  { code: '+965', label: '🇰🇼 Kuwait (+965)' },
  { code: '+973', label: '🇧🇭 Bahrain (+973)' },
  { code: '+974', label: '🇶🇦 Qatar (+974)' },
  { code: '+968', label: '🇴🇲 Oman (+968)' },
  { code: '+1',   label: '🇺🇸 US (+1)' },
  { code: '+44',  label: '🇬🇧 UK (+44)' },
  { code: '+91',  label: '🇮🇳 India (+91)' },
  { code: '+20',  label: '🇪🇬 Egypt (+20)' },
  { code: '+92',  label: '🇵🇰 Pakistan (+92)' },
];

function parsePhone(full: string): { dialCode: string; local: string } {
  for (const { code } of GCC_DIAL_CODES) {
    if (full.startsWith(code)) {
      return { dialCode: code, local: full.slice(code.length).trim() };
    }
  }
  return { dialCode: '+971', local: full };
}

/* ── Constants ── */
export const SPECIALTIES = SPACE_TYPES; // backward compat export
export const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
export const TYPE_OPTIONS = [
  { value:'design_studio', label:'Interior Design Studio' },
  { value:'renovation_company', label:'Renovation & Fit-out' },
  { value:'general_contractor', label:'General Contractor' },
  { value:'mep_contractor', label:'MEP Contractor' },
  { value:'maintenance_company', label:'Maintenance Company' },
  { value:'specialty_trade', label:'Specialty Trade' },
  { value:'landscaping', label:'Landscaping & Pools' },
  { value:'furnishing', label:'Furnishing' },
  { value:'fitout_contractor', label:'Fit-Out Contractor' },
  { value:'glass_aluminium', label:'Glass & Aluminium' },
  { value:'waterproofing', label:'Waterproofing' },
  { value:'smart_home', label:'Smart Home & IT' },
  { value:'fire_fighting', label:'Fire Fighting & Safety' },
  { value:'carpentry_joinery', label:'Carpentry & Joinery' },
  { value:'stone_marble', label:'Stone, Marble & Tile' },
  { value:'steel_fabrication', label:'Steel & Metal Works' },
  { value:'cleaning_services', label:'Cleaning Services' },
  { value:'manpower_supply', label:'Manpower Supply' },
  { value:'swimming_pool', label:'Swimming Pool Contractor' },
];

export interface ProfileData {
  company_name: string; description: string; contact_person: string;
  phone: string; website: string; city: string; address: string;
  company_type: string; // legacy, kept for backward compat
  company_types: string[]; // multi-select (max 5)
  trade_license_number: string;
  establishment_year: number | null;
  services: string[]; // selected service subcategories
  specialties: string[]; // space types
  emirates_served: string[];
  status: string; admin_notes?: string;
}

export const EMPTY_PROFILE: ProfileData = {
  company_name:'', description:'', contact_person:'', phone:'', website:'',
  city:'Dubai', address:'',
  company_type:'', company_types:[],
  trade_license_number:'', establishment_year:null,
  services:[], specialties:[], emirates_served:[],
  status:'pending',
};

export function parseProfile(r: any): ProfileData {
  function pj(v: any): string[] {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') try { return JSON.parse(v); } catch { return []; }
    return [];
  }
  const company_types = pj(r.company_types);
  return {
    company_name: r.company_name || '', description: r.description || '',
    contact_person: r.contact_person || '', phone: r.phone || '',
    website: r.website || '', city: r.city || 'Dubai', address: r.address || '',
    company_type: r.company_type || '',
    // If company_types saved, use it; otherwise migrate from single company_type
    company_types: company_types.length > 0 ? company_types : (r.company_type ? [r.company_type] : []),
    trade_license_number: r.trade_license_number || '',
    establishment_year: r.establishment_year || null,
    services: pj(r.services), specialties: pj(r.specialties),
    emirates_served: pj(r.emirates_served),
    status: r.status || 'pending', admin_notes: r.admin_notes,
  };
}

interface Props {
  onSaved?: (profileId: number | null) => void;
}

export interface CompanyProfileFormRef {
  save: () => void;
  saving: boolean;
  saveText: string;
}

/* ── Service Category Picker ── */
function ServiceCategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeParents = getActiveParents(selected);

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleSub = (sub: string, parentName: string) => {
    const isSelected = selected.includes(sub);
    if (isSelected) {
      onChange(selected.filter(s => s !== sub));
    } else {
      // Check parent limit
      const isNewParent = !activeParents.includes(parentName);
      if (isNewParent && activeParents.length >= MAX_SERVICE_CATEGORIES) return;
      onChange([...selected, sub]);
    }
  };

  const toggleAllInCategory = (cat: typeof SERVICE_CATEGORIES[0]) => {
    const catSubs = cat.subs;
    const allSelected = catSubs.every(s => selected.includes(s));
    if (allSelected) {
      // Deselect all in this category
      onChange(selected.filter(s => !catSubs.includes(s)));
    } else {
      // Select all — check parent limit first
      const isNewParent = !activeParents.includes(cat.name);
      if (isNewParent && activeParents.length >= MAX_SERVICE_CATEGORIES) return;
      const newSubs = catSubs.filter(s => !selected.includes(s));
      onChange([...selected, ...newSubs]);
    }
  };

  return (
    <div className="space-y-1.5">
      {activeParents.length >= MAX_SERVICE_CATEGORIES && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          Max {MAX_SERVICE_CATEGORIES} categories selected. Deselect from an existing category to add another.
        </p>
      )}
      {SERVICE_CATEGORIES.map(cat => {
        const catSelected = cat.subs.filter(s => selected.includes(s));
        const isOpen = expanded.has(cat.name);
        const isActive = activeParents.includes(cat.name);
        const isLocked = !isActive && activeParents.length >= MAX_SERVICE_CATEGORIES;

        return (
          <div key={cat.name} className={`rounded-xl border transition-colors ${isActive ? 'border-[#b8864a]/40 bg-[#b8864a]/3' : 'border-stone-200 bg-white'} ${isLocked ? 'opacity-50' : ''}`}>
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleExpand(cat.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />}
                <span className={`text-sm font-medium ${isActive ? 'text-[#b8864a]' : 'text-stone-700'}`}>{cat.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {catSelected.length > 0 && (
                  <span className="text-xs bg-[#b8864a] text-white rounded-full px-2 py-0.5">
                    {catSelected.length}/{cat.subs.length}
                  </span>
                )}
                {!isLocked && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleAllInCategory(cat); }}
                    className="text-xs text-stone-400 hover:text-[#b8864a] transition-colors px-1"
                  >
                    {catSelected.length === cat.subs.length ? 'Clear' : 'All'}
                  </button>
                )}
              </div>
            </button>

            {/* Subcategories */}
            {isOpen && (
              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {cat.subs.map(sub => {
                  const active = selected.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      disabled={isLocked && !active}
                      onClick={() => toggleSub(sub, cat.name)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-[#b8864a] text-white border-[#b8864a]'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-[#b8864a]/60'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CompanyProfileForm = forwardRef<CompanyProfileFormRef, Props>(function CompanyProfileForm({ onSaved }, ref) {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('');
  const [tried, setTried] = useState(false);
  const [dialCode, setDialCode] = useState('+971');
  const [localPhone, setLocalPhone] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  const initializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');
  const serialize = useCallback((v: ProfileData) => JSON.stringify(v), []);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/company/profile');
        const d = r.profile || r;
        if (d?.company_name) {
          let next = parseProfile(d);
          if (!next.phone) {
            try {
              const me = await api.get('/auth/me');
              const up = me?.user?.phone || '';
              if (up) next = { ...next, phone: up };
            } catch {
              try {
                const raw = localStorage.getItem('user');
                const lp = raw ? (JSON.parse(raw)?.phone || '') : '';
                if (lp) next = { ...next, phone: lp };
              } catch {}
            }
          }
          setProfile(next);
          if (d.id) setProfileId(Number(d.id));
          lastSavedSnapshotRef.current = serialize(next);
          if (next.phone) {
            const parsed = parsePhone(next.phone);
            setDialCode(parsed.dialCode);
            setLocalPhone(parsed.local);
          }
        } else {
          let pending: any = null;
          try {
            const raw = sessionStorage.getItem('pending_company_profile');
            if (raw) { pending = JSON.parse(raw); sessionStorage.removeItem('pending_company_profile'); }
          } catch { /* ignore */ }
          if (!pending) {
            try {
              const raw2 = sessionStorage.getItem('company_signup_prefill');
              if (raw2) { pending = JSON.parse(raw2); sessionStorage.removeItem('company_signup_prefill'); }
            } catch { /* ignore */ }
          }
          if (pending) {
            const prefilled = {
              ...EMPTY_PROFILE,
              company_name: pending.company_name || '',
              contact_person: pending.contact_person || '',
              phone: pending.phone || '',
              city: pending.city || '',
              company_type: pending.company_type || '',
              company_types: pending.company_type ? [pending.company_type] : [],
              services: pending.services || [],
              establishment_year: pending.establishment_year || '',
            };
            setProfile(prefilled);
            if (prefilled.phone) {
              const parsed = parsePhone(prefilled.phone);
              setDialCode(parsed.dialCode);
              setLocalPhone(parsed.local);
            }
          }
          lastSavedSnapshotRef.current = serialize(EMPTY_PROFILE);
        }
      } catch {
        lastSavedSnapshotRef.current = serialize(EMPTY_PROFILE);
      } finally {
        setLoading(false);
      }
    })();
  }, [serialize]);

  const clearSaveTextLater = useCallback(() => {
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current);
    saveTextTimer.current = setTimeout(() => setSaveText(''), 2500);
  }, []);

  const saveProfile = useCallback(async (manual = false) => {
    const current = profileRef.current;
    const missing = !current.company_name.trim() || !current.contact_person.trim() || !current.phone.trim() || !current.description.trim() || current.services.length === 0;
    if (missing) {
      if (manual) {
        setTried(true);
        setSaveText('Please complete all required fields.');
        clearSaveTextLater();
      }
      return;
    }
    setSaving(true);
    setSaveText('Saving...');
    try {
      const res = await api.post('/auth/company/profile', {
        company_name: current.company_name,
        description: current.description,
        contact_person: current.contact_person,
        phone: current.phone,
        website: current.website,
        city: current.city,
        address: current.address,
        services: current.services.length > 0 ? current.services : ['Interior Design'],
        company_type: current.company_types[0] || current.company_type || '',
        company_types: current.company_types,
        trade_license_number: current.trade_license_number,
        establishment_year: current.establishment_year,
        specialties: current.specialties,
        emirates_served: current.emirates_served,
      });
      const saved = res?.profile || res;
      const newId = saved?.id ? Number(saved.id) : profileId;
      if (saved?.id) setProfileId(Number(saved.id));
      lastSavedSnapshotRef.current = serialize(current);
      setSaveText(manual ? 'Saved' : 'Draft saved');
      clearSaveTextLater();
      onSaved?.(newId);
    } catch (err: any) {
      setSaveText(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [serialize, clearSaveTextLater, profileId, onSaved]);

  // Auto-save debounced 900ms
  useEffect(() => {
    if (loading) return;
    const snap = serialize(profile);
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedSnapshotRef.current = snap;
      return;
    }
    if (snap === lastSavedSnapshotRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveText('Saving...');
    saveTimer.current = setTimeout(() => void saveProfile(false), 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [loading, profile, saveProfile, serialize]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveTextTimer.current) clearTimeout(saveTextTimer.current);
  }, []);

  useImperativeHandle(ref, () => ({
    save: () => void saveProfile(true),
    get saving() { return saving; },
    get saveText() { return saveText; },
  }), [saveProfile, saving, saveText]);

  const set = (f: string, v: any) => setProfile(p => ({ ...p, [f]: v }));
  const toggleTag = (f: 'specialties' | 'emirates_served' | 'company_types', t: string, max?: number) =>
    setProfile(p => {
      const arr = p[f] as string[];
      if (arr.includes(t)) return { ...p, [f]: arr.filter(x => x !== t) };
      if (max && arr.length >= max) return p;
      return { ...p, [f]: [...arr, t] };
    });

  if (loading) return <div className="flex items-center justify-center py-12 text-stone-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-3">
      {/* Basic Info */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-3">Basic Information</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormLabel required>Company Name</FormLabel>
            <FormInput value={profile.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Enter company name" className={tried && !profile.company_name.trim() ? '!border-red-400' : ''} />
            {tried && !profile.company_name.trim() && <p className="mt-1 text-xs text-red-500">Company name is required</p>}
          </div>
          <div>
            <FormLabel required>Contact Person</FormLabel>
            <FormInput value={profile.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" className={tried && !profile.contact_person.trim() ? '!border-red-400' : ''} />
            {tried && !profile.contact_person.trim() && <p className="mt-1 text-xs text-red-500">Contact person is required</p>}
          </div>
          <div>
            <FormLabel required icon={<Phone className="w-3.5 h-3.5" />}>Phone</FormLabel>
            <div className="flex gap-2">
              <AdminSelect
                value={dialCode}
                onChange={code => {
                  setDialCode(code);
                  setProfile(p => ({ ...p, phone: `${code}${localPhone}` }));
                }}
                options={GCC_DIAL_CODES.map(c => ({ value: c.code, label: c.label }))}
                className="shrink-0 w-[170px]"
              />
              <input
                type="tel"
                value={localPhone}
                onChange={e => {
                  const num = e.target.value;
                  setLocalPhone(num);
                  setProfile(p => ({ ...p, phone: `${dialCode}${num}` }));
                }}
                placeholder="50 123 4567"
                className={`h-[50px] flex-1 rounded-2xl border bg-stone-50/80 px-4 text-[15px] text-[#2c2c2c] placeholder:text-stone-400 focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:bg-white ${tried && !profile.phone.trim() ? 'border-red-400' : 'border-stone-200'}`}
              />
            </div>
            {tried && !profile.phone.trim() && <p className="mt-1 text-xs text-red-500">Phone number is required</p>}
          </div>
          <div className="md:col-span-2">
            <FormLabel required>Description</FormLabel>
            <FormTextarea value={profile.description} rows={3} onChange={e => set('description', e.target.value)} placeholder="Tell potential clients about your company, expertise, and what makes you unique..." className={tried && !profile.description.trim() ? '!border-red-400' : ''} />
            {tried && !profile.description.trim() && <p className="mt-1 text-xs text-red-500">Description is required</p>}
          </div>
        </div>
      </section>

      {/* Company Details */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-3">Company Details</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FormLabel icon={<Globe className="w-3.5 h-3.5" />}>Website</FormLabel>
            <FormInput type="url" value={profile.website} onChange={e => set('website', e.target.value)} placeholder="https://yourcompany.com" />
          </div>
          <div>
            <FormLabel icon={<MapPin className="w-3.5 h-3.5" />}>Headquarter City</FormLabel>
            <AdminSelect
              value={profile.city}
              onChange={v => set('city', v)}
              options={EMIRATES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <FormLabel>Address</FormLabel>
            <FormInput value={profile.address} onChange={e => set('address', e.target.value)} placeholder="Street address, area" />
          </div>
          <div>
            <FormLabel>Trade License No.</FormLabel>
            <FormInput value={profile.trade_license_number} onChange={e => set('trade_license_number', e.target.value)} placeholder="DED-12345" />
          </div>
          <div>
            <FormLabel>Established Year</FormLabel>
            <FormInput type="number" value={profile.establishment_year ?? ''} onChange={e => set('establishment_year', e.target.value)} placeholder="2010" />
          </div>
        </div>

        {/* Company Type multiselect */}
        <div className="mt-3">
          <FormLabel>Company Type <span className="text-stone-400 font-normal">(select up to 5)</span></FormLabel>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TYPE_OPTIONS.map(o => (
              <FormTag
                key={o.value}
                label={o.label}
                active={profile.company_types.includes(o.value)}
                onClick={() => toggleTag('company_types', o.value, 5)}
              />
            ))}
          </div>
        </div>

        {/* Emirates Served */}
        <div className="mt-3">
          <FormLabel>Emirates Served</FormLabel>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {EMIRATES.map(e => (
              <FormTag
                key={e}
                label={e}
                active={profile.emirates_served.includes(e)}
                onClick={() => toggleTag('emirates_served', e)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Services & Expertise */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-1">Services & Expertise</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <FormLabel required>Service Categories <span className="text-stone-400 font-normal">(max {MAX_SERVICE_CATEGORIES} categories)</span></FormLabel>
              {profile.services.length > 0 && (
                <span className="text-xs text-stone-400">{profile.services.length} selected</span>
              )}
            </div>
            <div className={tried && profile.services.length === 0 ? 'rounded-2xl border-2 border-dashed border-red-300 p-2' : ''}>
              <ServiceCategoryPicker
                selected={profile.services}
                onChange={v => set('services', v)}
              />
            </div>
            {tried && profile.services.length === 0 && <p className="mt-1 text-xs text-red-500">Select at least one service</p>}
          </div>

          <div>
            <FormLabel>Space Types</FormLabel>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {SPACE_TYPES.map(t => (
                <FormTag key={t} label={t} active={profile.specialties.includes(t)} onClick={() => toggleTag('specialties', t)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {saveText && (
        <p className={`text-xs text-right ${
          saveText === 'Saved' || saveText === 'Draft saved' ? 'text-emerald-600' :
          saveText === 'Saving...' ? 'text-stone-400' : 'text-red-600'
        }`}>{saveText}</p>
      )}
    </div>
  );
});

export default CompanyProfileForm;
