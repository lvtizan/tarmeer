import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, FileText, Download, FolderOpen, X } from 'lucide-react';
import { useAdminT } from '../../hooks/useAdminLang';
import { ScreenSpinner } from '../../components/ui/Spinner';
import ImageUploadZone from '../../components/ui/ImageUploadZone';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';
function getToken() { return localStorage.getItem('supplier_token'); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

const inputCls = 'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';
const labelCls = 'block text-sm font-medium text-stone-500 mb-1.5';

export default function SupplierCatalogsPage() {
  const { t } = useAdminT();
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/catalogs`, { headers: authHeaders() as any })
      .then(r => r.json())
      .then(data => { if (data?.catalogs) setCatalogs(data.catalogs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    setTried(true);
    if (!title.trim()) { setMsg(t('Title is required.', '请填写目录名称。')); return; }
    if (uploadedUrls.length === 0) { setMsg(t('Please upload a file.', '请先上传文件。')); return; }
    setSaving(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/catalogs`, {
        method: 'POST',
        headers: authHeaders() as any,
        body: JSON.stringify({ title: title.trim(), file_url: uploadedUrls[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCatalogs(prev => [...prev, data.catalog]);
      setTitle(''); setUploadedUrls([]); setAdding(false); setTried(false);
    } catch (err: any) {
      setMsg(err.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_BASE}/suppliers/me/catalogs/${id}`, { method: 'DELETE', headers: authHeaders() as any });
    setCatalogs(prev => prev.filter(c => c.id !== id));
  };

  const cancelAdd = () => { setAdding(false); setTitle(''); setUploadedUrls([]); setMsg(''); setTried(false); };

  if (loading) return <ScreenSpinner />;

  return (
    <>
      <Helmet><title>Catalogs — Supplier Dashboard | Tarmeer</title></Helmet>

      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Catalogs & Brochures', '目录 & 宣传册')}</h1>
            <p className="text-sm text-stone-500 mt-1">{t(`${catalogs.length} file${catalogs.length !== 1 ? 's' : ''} uploaded`, `已上传 ${catalogs.length} 份文件`)}</p>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> {t('Add Catalog', '添加目录')}
            </button>
          )}
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#2c2c2c]">{t('New Catalog', '新增目录')}</h2>
              <button onClick={cancelAdd} className="text-stone-400 hover:text-stone-600 transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={labelCls}>{t('File *', '文件 *')}</label>
              <ImageUploadZone
                value={uploadedUrls}
                onUpload={setUploadedUrls}
                uploadUrl={`${API_BASE}/suppliers/me/upload-catalog-file`}
                chunkUploadUrl={`${API_BASE}/suppliers/me/upload-catalog-chunk`}
                getHeaders={() => ({ Authorization: `Bearer ${getToken()}` })}
                accept="image/*,application/pdf"
                label={t('Click, drag or paste to upload', '点击、拖放或粘贴截图上传')}
                sublabel="PDF · JPG · PNG · WebP"
                onFileMeta={({ original_name }) => { if (original_name && !title.trim()) setTitle(original_name); }}
              />
              {tried && uploadedUrls.length === 0 && <p className="text-xs text-red-500 mt-1">{t('Please upload a file', '请先上传文件')}</p>}
            </div>

            <div>
              <label className={labelCls}>{t('Catalog Title *', '目录名称 *')}</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={t('e.g. Product Catalogue 2024', '如：2024 产品目录')}
                className={`${inputCls} ${tried && !title.trim() ? '!border-red-400' : ''}`} />
              {tried && !title.trim() && <p className="text-xs text-red-500 mt-1">{t('Title is required', '请填写目录名称')}</p>}
            </div>

            {msg && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-2xl">{msg}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={cancelAdd} className="h-11 px-5 rounded-2xl border border-stone-200 text-[15px] text-stone-600 hover:bg-stone-50 transition">
                {t('Cancel', '取消')}
              </button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Plus className="w-4 h-4" />
                {saving ? t('Saving...', '保存中...') : t('Add Catalog', '添加目录')}
              </button>
            </div>
          </div>
        )}

        {/* Catalog list */}
        {catalogs.length > 0 ? (
          <div className="space-y-3">
            {catalogs.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-stone-200 group">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-[#2c2c2c] truncate">{c.title}</p>
                  {c.file_size && (
                    <p className="text-xs text-stone-400 mt-0.5">
                      {c.file_size > 1048576 ? `${(c.file_size / 1048576).toFixed(1)} MB` : `${(c.file_size / 1024).toFixed(0)} KB`}
                    </p>
                  )}
                </div>
                <a href={c.file_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-600 hover:bg-[#b8864a] hover:text-white hover:border-[#b8864a] transition">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('View', '查看')}</span>
                </a>
                <button onClick={() => handleDelete(c.id)}
                  className="shrink-0 w-9 h-9 rounded-xl border border-red-100 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                  aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : !adding ? (
          <div className="bg-white rounded-2xl border border-stone-200 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-stone-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#2c2c2c] mb-2">{t('No catalogs yet', '暂无目录')}</h3>
            <p className="text-sm text-stone-500">{t('Upload product catalogues and brochures for buyers to download.', '上传产品目录和宣传册，供采购方下载。')}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
