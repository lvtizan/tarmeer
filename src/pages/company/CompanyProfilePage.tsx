import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Clock, AlertCircle, Save, Eye, Globe, MapPin, Phone } from 'lucide-react';
import { api } from '../../lib/api';
import { FormInput, FormTextarea, FormSelect, FormLabel, FormTag } from '../../components/form/FormInput';

/* ── Constants ── */
const SERVICES = ['Interior Design','Architecture','Fit-Out','Renovation','Construction','Landscape','Furniture','Joinery','MEP','Project Management','Design & Build','Turnkey Solutions','Maintenance','Glass & Aluminium','Painting & Finishing','Flooring & Tiling','Demolition','Steel & Fabrication','Curtains & Blinds','Cleaning Services','Pools'];
const SPECIALTIES = ['Residential','Villa','Commercial','Hospitality','Retail','Office','Education','Healthcare','F&B','Luxury Residential','Mixed-Use'];
const EMIRATES = ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'];
const TYPE_OPTIONS = [
  { value:'design_studio', label:'Interior Design Studio' },
  { value:'renovation_company', label:'Renovation & Fit-out' },
  { value:'general_contractor', label:'General Contractor' },
  { value:'mep_contractor', label:'MEP Contractor' },
  { value:'maintenance_company', label:'Maintenance Company' },
  { value:'specialty_trade', label:'Specialty Trade' },
  { value:'landscaping', label:'Landscaping & Pools' },
  { value:'furnishing', label:'Furnishing' },
];

interface Profile {
  company_name: string; description: string; contact_person: string;
  phone: string; website: string; city: string; address: string;
  company_type: string; trade_license_number: string;
  establishment_year: number | null; services: string[]; specialties: string[];
  status: string; admin_notes?: string;
}

const EMPTY: Profile = {
  company_name:'', description:'', contact_person:'', phone:'', website:'',
  city:'Dubai', address:'', company_type:'renovation_company',
  trade_license_number:'', establishment_year:null, services:[], specialties:[],
  status:'pending',
};

function pj(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') try { return JSON.parse(v); } catch { return []; }
  return [];
}

function pp(r: any): Profile {
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

function getPublicSiteBase(): string {
  if (typeof window === 'undefined') return '';
  const { hostname, protocol } = window.location;
  if (hostname.startsWith('admin.')) return `${protocol}//www.${hostname.replace(/^admin\./, '')}`;
  return '';
}

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('');
  const publicSiteBase = getPublicSiteBase();

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  const initializedRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');

  const serialize = useCallback((v: Profile) => JSON.stringify(v), []);

  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/auth/company/profile');
        const d = r.profile || r;
        if (d?.company_name) {
          let next = pp(d);
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
          setIsNew(true);
          lastSavedSnapshotRef.current = serialize(EMPTY);
        }
      } catch {
        setIsNew(true);
        lastSavedSnapshotRef.current = serialize(EMPTY);
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
      if (saved?.id) setProfileId(Number(saved.id));
      setIsNew(false);
      lastSavedSnapshotRef.current = serialize(current);
      setSaveText(manual ? 'Saved' : 'Saved just now');
      clearSaveTextLater();
    } catch (err: any) {
      setSaveText(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [serialize, clearSaveTextLater]);

  // Auto-save on change (debounced 900ms)
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
  const toggleTag = (f: 'services' | 'specialties', t: string) => {
    setProfile(p => {
      const a = p[f];
      return { ...p, [f]: a.includes(t) ? a.filter(x => x !== t) : [...a, t] };
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Loading...</div>;

  return (
    <div className="w-full max-w-[840px] mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2c2c2c]">Company Profile</h1>
          <p className="mt-1 text-sm text-stone-500">Changes save automatically as you type.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveText && (
            <span className={`text-sm font-medium ${
              saveText === 'Saved' || saveText === 'Saved just now' ? 'text-emerald-600' :
              saveText === 'Saving...' ? 'text-stone-400' : 'text-red-600'
            }`}>
              {saving && <span className="inline-block w-3 h-3 border-2 border-[#b8864a] border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />}
              {saveText}
            </span>
          )}
          <button
            type="button"
            onClick={() => void saveProfile(true)}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition disabled:opacity-60"
          >
            <Save className="w-4 h-4" />Save
          </button>
          {profileId && (
            <a
              href={`${publicSiteBase || ''}/companies/${profileId}?preview=1&from=company-dashboard`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 px-4 rounded-lg border border-stone-200 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
            >
              <Eye className="w-4 h-4" />Preview
            </a>
          )}
        </div>
      </div>

      {/* ── Status banner ── */}
      {!isNew && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          profile.status === 'approved' ? 'border-green-200 bg-green-50 text-green-800' :
          profile.status === 'rejected' ? 'border-amber-200 bg-amber-50 text-amber-900' :
          'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          <div className="flex items-center gap-2">
            {profile.status === 'approved' && <CheckCircle2 className="w-4 h-4" />}
            {profile.status === 'rejected' && <AlertCircle className="w-4 h-4" />}
            {profile.status === 'pending' && <Clock className="w-4 h-4" />}
            <span className="font-semibold">
              {profile.status === 'approved' ? 'Profile approved — visible to clients' :
               profile.status === 'rejected' ? 'Profile needs updates' :
               'Under review — usually 1–2 business days'}
            </span>
          </div>
          {profile.status === 'rejected' && profile.admin_notes && (
            <p className="mt-1 text-amber-900/90">{profile.admin_notes}</p>
          )}
        </div>
      )}

      {/* ── Section 1: Basic Info ── */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-bold text-[#2c2c2c] mb-5">Basic Information</h2>
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

      {/* ── Section 2: Company Details ── */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-bold text-[#2c2c2c] mb-5">Company Details</h2>
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

      {/* ── Section 3: Services & Specialties ── */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-base font-bold text-[#2c2c2c] mb-5">Services & Specialties</h2>
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

    </div>
  );
}
