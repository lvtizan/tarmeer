import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';

interface Props {
  type: 'scraped' | 'profile';
  id: number;
  onClose: () => void;
  onSaved: () => void;
}

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

const SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
];

const SPECIALTIES = [
  'Residential', 'Villa', 'Commercial', 'Hospitality', 'Retail', 'Office',
  'Education', 'Healthcare', 'F&B', 'Luxury Residential', 'Mixed-Use',
];

export default function CompanyEditModal({ type, id, onClose, onSaved }: Props) {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endpoint = type === 'scraped'
          ? `/companies/${id}/detail`
          : `/roles/companies/${id}/detail`;
        const result = await adminApi.request(endpoint);
        const raw = result.company || result.profile || {};
        // Parse JSON fields
        if (typeof raw.services === 'string') try { raw.services = JSON.parse(raw.services); } catch { raw.services = []; }
        if (typeof raw.specialties === 'string') try { raw.specialties = JSON.parse(raw.specialties); } catch { raw.specialties = []; }
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

  const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a]";
  const labelCls = "block text-xs font-medium text-stone-500 mb-1";

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 text-stone-500">Loading...</div>
      </div>
    );
  }

  const isScraped = type === 'scraped';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-stone-900">
            Edit {isScraped ? 'Scraped Company' : 'Company Profile'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isScraped ? 'Name (EN)' : 'Company Name'}</label>
              <input className={inputCls} value={data[isScraped ? 'name_en' : 'company_name'] || ''} onChange={e => set(isScraped ? 'name_en' : 'company_name', e.target.value)} />
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

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={data.phone || ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'Email' : 'Website'}</label>
              <input className={inputCls} value={data[isScraped ? 'email' : 'website'] || ''} onChange={e => set(isScraped ? 'email' : 'website', e.target.value)} />
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

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>City</label>
              <select className={inputCls} value={data.city || ''} onChange={e => set('city', e.target.value)}>
                <option value="">Select</option>
                {EMIRATES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'Area' : 'Address'}</label>
              <input className={inputCls} value={data[isScraped ? 'area' : 'address'] || ''} onChange={e => set(isScraped ? 'area' : 'address', e.target.value)} />
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
            <textarea className={inputCls} rows={3} value={data.description || ''} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Business info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{isScraped ? 'Year Established' : 'Est. Year'}</label>
              <input type="number" className={inputCls} value={data[isScraped ? 'year_established' : 'establishment_year'] || ''} onChange={e => set(isScraped ? 'year_established' : 'establishment_year', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{isScraped ? 'License Number' : 'Trade License No.'}</label>
              <input className={inputCls} value={data[isScraped ? 'license_number' : 'trade_license_number'] || ''} onChange={e => set(isScraped ? 'license_number' : 'trade_license_number', e.target.value)} />
            </div>
          </div>

          {/* Company type (profile only) */}
          {!isScraped && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Company Type</label>
                <select className={inputCls} value={data.company_type || ''} onChange={e => set('company_type', e.target.value)}>
                  <option value="design_studio">Design Studio</option>
                  <option value="renovation_company">Renovation Company</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={data.status || ''} onChange={e => set('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          {/* Social (scraped only) */}
          {isScraped && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={data.instagram || ''} onChange={e => set('instagram', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Facebook</label>
                <input className={inputCls} value={data.facebook || ''} onChange={e => set('facebook', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>LinkedIn</label>
                <input className={inputCls} value={data.linkedin || ''} onChange={e => set('linkedin', e.target.value)} />
              </div>
            </div>
          )}

          {/* Services */}
          <div>
            <label className={labelCls}>Services</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SERVICES.map(s => (
                <button key={s} type="button" onClick={() => toggleArrayItem('services', s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    (data.services || []).includes(s)
                      ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div>
            <label className={labelCls}>Specialties</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SPECIALTIES.map(s => (
                <button key={s} type="button" onClick={() => toggleArrayItem('specialties', s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    (data.specialties || []).includes(s)
                      ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm bg-[#b8864a] text-white rounded-lg hover:bg-[#a07540] disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
