import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, MapPin, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { FormInput, FormTextarea, FormSelect, FormLabel, FormTag } from '../form/FormInput';

/* ── Constants ── */
export const SERVICES = ['Interior Design','Architecture','Fit-Out','Renovation','Construction','Landscape','Furniture','Joinery','MEP','Project Management','Design & Build','Turnkey Solutions','Maintenance','Glass & Aluminium','Painting & Finishing','Flooring & Tiling','Demolition','Steel & Fabrication','Curtains & Blinds','Cleaning Services','Pools'];
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
  /** Show save status text + manual Save button in the top-right */
  showSaveBar?: boolean;
}

export default function CompanyProfileForm({ onSaved, showSaveBar = false }: Props) {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('');

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
        } else {
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
    if (!current.company_name.trim()) {
      if (manual) setSaveText('Company name is required.');
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
      setSaveText(manual ? 'Saved' : 'Saved just now');
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

  const set = (f: string, v: string) => setProfile(p => ({ ...p, [f]: v }));
  const toggleTag = (f: 'services' | 'specialties', t: string) =>
    setProfile(p => ({ ...p, [f]: p[f].includes(t) ? p[f].filter(x => x !== t) : [...p[f], t] }));

  if (loading) return <div className="flex items-center justify-center py-12 text-stone-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-5">
      {showSaveBar && (
        <div className="flex items-center justify-end gap-3">
          {saveText && (
            <span className={`text-sm font-medium ${
              saveText === 'Saved' || saveText === 'Saved just now' ? 'text-emerald-600' :
              saveText === 'Saving...' ? 'text-stone-400' : 'text-red-600'
            }`}>
              {saving && <span className="inline-block w-3 h-3 border-2 border-[#b8864a] border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />}
              {saveText}
            </span>
          )}
          <button type="button" onClick={() => void saveProfile(true)} disabled={saving}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition disabled:opacity-60">
            Save
          </button>
        </div>
      )}

      {/* Basic Info */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormLabel required>Company Name</FormLabel>
            <FormInput value={profile.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Enter company name" />
          </div>
          <div>
            <FormLabel required>Contact Person</FormLabel>
            <FormInput value={profile.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <FormLabel required icon={<Phone className="w-3.5 h-3.5" />}>Phone</FormLabel>
            <FormInput type="tel" value={profile.phone} onChange={e => set('phone', e.target.value)} placeholder="+971 50 123 4567" />
          </div>
          <div className="md:col-span-2">
            <FormLabel required>Description</FormLabel>
            <FormTextarea value={profile.description} rows={4} onChange={e => set('description', e.target.value)} placeholder="Tell potential clients about your company, expertise, and what makes you unique..." />
          </div>
        </div>
      </section>

      {/* Company Details */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-4">Company Details</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-bold text-[#2c2c2c] mb-4">Services & Specialties</h2>
        <div className="space-y-5">
          <div>
            <FormLabel required>Services</FormLabel>
            <div className="flex flex-wrap gap-2 mt-2">
              {SERVICES.map(t => <FormTag key={t} label={t} active={profile.services.includes(t)} onClick={() => toggleTag('services', t)} />)}
            </div>
          </div>
          <div>
            <FormLabel>Project Specialties</FormLabel>
            <div className="flex flex-wrap gap-2 mt-2">
              {SPECIALTIES.map(t => <FormTag key={t} label={t} active={profile.specialties.includes(t)} onClick={() => toggleTag('specialties', t)} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Save status (non-bar mode) */}
      {!showSaveBar && saveText && (
        <p className={`text-xs text-right ${
          saveText === 'Saved' || saveText === 'Saved just now' ? 'text-emerald-600' :
          saveText === 'Saving...' ? 'text-stone-400' : 'text-red-600'
        }`}>{saveText}</p>
      )}
    </div>
  );
}
