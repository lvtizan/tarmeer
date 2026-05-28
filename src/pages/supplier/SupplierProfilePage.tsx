import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Save } from 'lucide-react';
import { useAdminT } from '../../hooks/useAdminLang';
import { ScreenSpinner } from '../../components/ui/Spinner';
import PhoneCountryInput from '../../components/ui/PhoneCountryInput';
import FileUploadButton from '../../components/ui/FileUploadButton';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}


const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

export default function SupplierProfilePage() {
  const { t } = useAdminT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [catGroups, setCatGroups] = useState<{value:string;label:string;categories:{value:string;label:string}[]}[]>([]);
  const [catUngrouped, setCatUngrouped] = useState<{value:string;label:string}[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState<'china' | 'dubai'>('china');
  const [categories, setCategories] = useState<string[]>([]);
  const [licenseUrl, setLicenseUrl] = useState('');
  const [hasStore, setHasStore] = useState(false);
  const [storeAddress, setStoreAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const profilePromise = fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(data => {
        const p = data.profile;
        if (!p) return;
        setCompanyName(p.company_name || '');
        setDescription(p.description || '');
        setOrigin(p.origin || 'china');
        const cats = typeof p.categories === 'string'
          ? JSON.parse(p.categories || '[]') : (p.categories || []);
        setCategories(cats);
        setLicenseUrl(p.license_url || '');
        setHasStore(!!p.has_physical_store);
        setStoreAddress(p.store_address || '');
        setGoogleMapsUrl(p.google_maps_url || '');
        setContactPhone(p.contact_phone || '');
        setWhatsapp(p.whatsapp || '');
        setWebsite(p.website || '');
      })
      .catch(() => {});

    const categoriesPromise = fetch(`${API_BASE}/public/supplier-categories`)
      .then(r => r.json())
      .then(data => {
        setCatGroups(data.groups || []);
        setCatUngrouped(data.ungrouped || []);
      })
      .catch(() => {});

    Promise.all([profilePromise, categoriesPromise]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/profile`, {
        method: 'POST',
        headers: authHeaders() as any,
        body: JSON.stringify({
          company_name: companyName,
          description,
          origin,
          categories,
          license_url: licenseUrl || null,
          has_physical_store: hasStore,
          store_address: storeAddress || null,
          google_maps_url: googleMapsUrl || null,
          contact_phone: contactPhone || null,
          whatsapp: whatsapp || null,
          website: website || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(t('Profile saved!', '保存成功！'));
    } catch (err: any) {
      setMsg(err.message || t('Failed to save.', '保存失败。'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (c: string) =>
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  if (loading) return <ScreenSpinner />;

  const msgIsSuccess = msg.includes('saved') || msg.includes('成功');

  return (
    <>
      <Helmet><title>Profile — Supplier Dashboard | Tarmeer</title></Helmet>

      <div className="max-w-2xl pb-24 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Company Profile', '公司资料')}</h1>
          <p className="text-sm text-stone-500 mt-1">{t('Fill in your company details. Submitted for admin review after save.', '填写公司信息，保存后提交管理员审核。')}</p>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('Basic Information', '基本信息')}</h2>

          <div>
            <label className={labelCls}>{t('Company Name *', '公司名称 *')}</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder={t('Your company name', '请输入公司名称')} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>{t('Description', '公司简介')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder={t('What does your company specialise in?', '贵公司主要经营哪些品类？')}
              className="w-full px-5 py-3 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition resize-none" />
          </div>

          <div>
            <label className={labelCls}>{t('Origin', '来源地')}</label>
            <div className="flex gap-2">
              {(['china', 'dubai'] as const).map(o => (
                <button key={o} type="button" onClick={() => setOrigin(o)}
                  className={`flex-1 h-[50px] rounded-2xl text-[15px] font-medium transition ${
                    origin === o ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}>
                  {o === 'china' ? `🇨🇳 ${t('China', '中国')}` : `🇦🇪 ${t('Dubai', '迪拜')}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('Categories', '产品品类')}</label>
            <div className="space-y-3">
              {catGroups.map(group => (
                <div key={group.value}>
                  <p className="text-xs text-stone-400 mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.categories.map(c => (
                      <button key={c.value} type="button" onClick={() => toggleCategory(c.value)}
                        className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition ${
                          categories.includes(c.value) ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {catUngrouped.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {catUngrouped.map(c => (
                    <button key={c.value} type="button" onClick={() => toggleCategory(c.value)}
                      className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition ${
                        categories.includes(c.value) ? 'bg-[#b8864a] text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business license — upload only, no display */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('Business License', '营业执照')}</h2>
            <p className="text-sm text-stone-500 mt-1">{t('Upload your trade license for admin verification. Supports image and PDF.', '上传营业执照供管理员审核，支持图片和 PDF。')}</p>
          </div>
          <FileUploadButton
            value={licenseUrl}
            onUpload={url => setLicenseUrl(url)}
            uploadUrl={`${API_BASE}/suppliers/me/upload-license`}
            getHeaders={() => ({ Authorization: `Bearer ${getToken()}` })}
            accept="image/*,application/pdf"
            label={t('Click, drag, or paste screenshot to upload', '点击、拖放或粘贴截图上传')}
            sublabel={t('JPG · PNG · PDF', 'JPG · PNG · PDF')}
          />
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('Contact', '联系方式')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('Contact Phone', '联系电话')}</label>
              <PhoneCountryInput value={contactPhone} onChange={setContactPhone} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <PhoneCountryInput value={whatsapp} onChange={setWhatsapp} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>{t('Website', '官网')}</label>
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="https://..." className={inputCls} />
            </div>
          </div>
        </div>

        {/* Physical store */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="hasStore" checked={hasStore} onChange={e => setHasStore(e.target.checked)}
              className="w-4 h-4 rounded accent-[#b8864a]" />
            <label htmlFor="hasStore" className="text-[15px] text-[#2c2c2c] cursor-pointer">
              {t('We have a physical showroom / store', '我们有实体展厅 / 门店')}
            </label>
          </div>
          {hasStore && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{t('Store Address', '门店地址')}</label>
                <input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
                  placeholder={t('Full address', '请输入完整地址')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('Google Maps URL', 'Google 地图链接')}</label>
                <input type="url" value={googleMapsUrl} onChange={e => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..." className={inputCls} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar — bottom right */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 z-40 bg-white/90 backdrop-blur border-t border-stone-100 px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-end gap-4">
        {msg && (
          <span className={`text-sm ${msgIsSuccess ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</span>
        )}
        <button onClick={handleSave} disabled={saving || !companyName.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? t('Saving...', '保存中...') : t('Save Profile', '保存资料')}
        </button>
      </div>
    </>
  );
}
