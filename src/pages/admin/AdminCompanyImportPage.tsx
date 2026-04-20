import { useState } from 'react';
import { Download, Upload, Check, AlertCircle, FileText } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';

type Step = 'upload' | 'preview' | 'done';

const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company Name (EN)',
  company_name_ar: 'Company Name (AR)',
  company_type: 'Company Type',
  contact_person: 'Contact Person',
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  whatsapp: 'WhatsApp',
  city: 'City',
  address: 'Address',
  description: 'Description',
  year_established: 'Year Established',
  license_number: 'License Number',
  services: 'Services',
  specialties: 'Specialties',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

export default function AdminCompanyImportPage() {
  const { t } = useAdminT();
  const [step, setStep] = useState<Step>('upload');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<Record<string, string>>({});
  const [importedName, setImportedName] = useState('');

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/admin/companies/import/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Tarmeer-Company-Template.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download template');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/admin/companies/import/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Parse failed');
      }
      const result = await res.json();
      setParsed(result.data || {});
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse document');
    } finally {
      setUploading(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setParsed(prev => ({ ...prev, [key]: value }));
  };

  const handleConfirmImport = async () => {
    if (!parsed.company_name) {
      setError('Company name is required');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const result = await adminApi.request('/companies/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsed }),
      });
      setImportedName(result.message || parsed.company_name);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">{t('Import Company', '导入公司')}</h1>
      <p className="text-sm text-stone-500 mb-8">
        {t('Download the Word template, send it to partner companies, then upload the filled document to import their info.', '下载 Word 模板，发给合作公司填写，再上传已填写文档以导入其信息。')}
      </p>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Download template */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-2">{t('Step 1: Download Template', '步骤 1：下载模板')}</h2>
            <p className="text-sm text-stone-500 mb-4">
              {t('Download the Word template and send it to the partner company to fill in.', '下载 Word 模板并发给合作公司填写。')}
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#b8864a] text-white rounded-lg text-sm font-medium hover:bg-[#a07540] transition"
            >
              <Download className="w-4 h-4" />
              {t('Download Template (.docx)', '下载模板 (.docx)')}
            </button>
          </div>

          {/* Upload filled */}
          <div className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-2">{t('Step 2: Upload Filled Document', '步骤 2：上传已填写文档')}</h2>
            <p className="text-sm text-stone-500 mb-4">
              {t('Once the company fills out the template, upload it here.', '公司填写完模板后，在此处上传。')}
            </p>
            <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition ${
              uploading ? 'bg-stone-200 text-stone-500' : 'bg-stone-900 text-white hover:bg-stone-800'
            }`}>
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('Parsing...', '解析中...')}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t('Upload Filled Template', '上传已填写模板')}
                </>
              )}
              <input
                type="file"
                accept=".docx"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Edit */}
      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-800">{t('Preview & Edit', '预览与编辑')}</h2>
              <button
                onClick={() => { setStep('upload'); setParsed({}); }}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                {t('Re-upload', '重新上传')}
              </button>
            </div>

            <div className="divide-y divide-stone-100">
              {Object.keys(FIELD_LABELS).map(key => (
                <div key={key} className="flex items-start gap-4 px-6 py-3">
                  <label className="w-40 flex-shrink-0 text-xs font-medium text-stone-500 pt-2">
                    {FIELD_LABELS[key]}
                  </label>
                  {key === 'description' ? (
                    <textarea
                      value={parsed[key] || ''}
                      onChange={e => handleFieldChange(key, e.target.value)}
                      rows={3}
                      className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a] resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={parsed[key] || ''}
                      onChange={e => handleFieldChange(key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setStep('upload'); setParsed({}); }}
              className="px-5 py-2.5 text-sm text-stone-600 hover:text-stone-800"
            >
              {t('Cancel', '取消')}
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || !parsed.company_name}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('Importing...', '导入中...')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('Confirm Import', '确认导入')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">{t('Import Successful', '导入成功')}</h2>
          <p className="text-sm text-stone-500 mb-6">{importedName}</p>
          <button
            onClick={() => { setStep('upload'); setParsed({}); setImportedName(''); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#b8864a] text-white rounded-lg text-sm font-medium hover:bg-[#a07540] transition"
          >
            <FileText className="w-4 h-4" />
            {t('Import Another', '导入下一个')}
          </button>
        </div>
      )}
    </div>
  );
}
