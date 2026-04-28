import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Globe, MapPin, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { FormInput, FormTextarea, FormSelect, FormLabel, FormTag } from '../form/FormInput';
import AdminSelect from '../ui/AdminSelect';

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
export const SERVICES = [
  'Interior Design','Architecture','Fit-Out','Renovation','Construction','Landscape',
  'Furniture','Joinery','MEP','Project Management','Design & Build','Turnkey Solutions','Maintenance',
  'Glass & Aluminium','Painting & Finishing','Flooring & Tiling','Demolition',
  'Steel & Fabrication','Curtains & Blinds','Cleaning Services','Pools',
  'HVAC & Ducting','Fire Fighting','Smart Home & Automation','Waterproofing',
  'Solar Systems','Epoxy & PU Flooring','Scaffolding','Lighting Installation',
  'Stone & Marble Fixing','Gypsum & Partitions','Deep Cleaning',
];
export const SPECIALTIES = ['Residential','Villa','Commercial','Hospitality','Retail','Office','Education','Healthcare','F&B','Luxury Residential','Mixed-Use'];
export const EMIRATES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
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
  company_type: string; trade_license_number: string;
  establishment_year: number | null; services: string[]; specialties: string[];
  status: string; admin_notes?: string;
}

export const EMPTY_PROFILE: ProfileData = {
  company_name:'', description:'', contact_person:'', phone:'', website:'',
  city:'Dubai', address:'', company_type:'renovation_company',
  trade_license_number:'', establishment_year:null, services:[], specialties:[],
  status:'pending',
};

export function parseProfile(r: any): ProfileData {
  function pj(v: any): string[] {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') try { return JSON.parse(v); } catch { return []; }
    return [];
  }
  return {
    company_name: r.company_name || '', description: r.description || '',
    contact_person: r.contact_person || '', phone: r.phone || '',
    website: r.website || '', city: r.city || 'Dubai', address: r.address || '',
    company_type: r.company_type || 'renovation_company',
    trade_license_number: r.trade_license_number || '',
    establishment_year: r.establishment_year || null,
    services: pj(r.services), specialties: pj(r.specialties),
    status: r.status || 'pending', admin_notes: r.admin_notes,
  };
}

interface Props {
  /** Called after every successful save. Passes back the saved profile id. */
  onSaved?: (profileId: number | null) => void;
}

export interface CompanyProfileFormRef {
  save: () => void;
  saving: boolean;
  saveText: string;
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
          // Check for pending signup data from /for-companies registration
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
              company_type: pending.company_type || 'renovation_company',
              services: pending.services || ['Interior Design'],
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
        company_type: current.company_type,
        trade_license_number: current.trade_license_number,
        establishment_year: current.establishment_year,
        specialties: current.specialties,
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

  const set = (f: string, v: string) => setProfile(p => ({ ...p, [f]: v }));
  const toggleTag = (f: 'services' | 'specialties', t: string) =>
    setProfile(p => ({ ...p, [f]: p[f].includes(t) ? p[f].filter(x => x !== t) : [...p[f], t] }));

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
            <FormLabel icon={<MapPin className="w-3.5 h-3.5" />}>City</FormLabel>
            <FormSelect value={profile.city} onChange={e => set('city', e.target.value)}>
              {EMIRATES.map(c => <option key={c} value={c}>{c}</option>)}
            </FormSelect>
          </div>
          <div>
            <FormLabel>Address</FormLabel>
            <FormInput value={profile.address} onChange={e => set('address', e.target.value)} placeholder="Street address, area" />
          </div>
          <div>
            <FormLabel>Company Type</FormLabel>
            <FormSelect value={profile.company_type} onChange={e => set('company_type', e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </FormSelect>
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
      </section>

      {/* Services & Specialties */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-3">Services & Specialties</h2>
        <div className="space-y-3">
          <div>
            <FormLabel required>Services</FormLabel>
            <div className={`flex flex-wrap gap-2 mt-1.5 ${tried && profile.services.length === 0 ? 'rounded-2xl border-2 border-dashed border-red-300 p-2' : ''}`}>
              {SERVICES.map(t => <FormTag key={t} label={t} active={profile.services.includes(t)} onClick={() => toggleTag('services', t)} />)}
            </div>
            {tried && profile.services.length === 0 && <p className="mt-1 text-xs text-red-500">Select at least one service</p>}
          </div>
          <div>
            <FormLabel>Project Specialties</FormLabel>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {SPECIALTIES.map(t => <FormTag key={t} label={t} active={profile.specialties.includes(t)} onClick={() => toggleTag('specialties', t)} />)}
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
