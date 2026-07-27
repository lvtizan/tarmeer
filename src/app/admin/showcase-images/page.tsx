'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ExternalLink, ImageOff, ChevronDown, ChevronUp } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { showToast } from '@/components/ui/Toast';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

export default function AdminShowcaseImagesPage() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();
  const configKey = country === 'vn' ? 'showcase_images_vn' : 'showcase_images';

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  // VN image picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerImages, setPickerImages] = useState<string[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.request('/system-config');
      const row = (data.config as { config_key: string; config_value: string }[])
        .find((r: { config_key: string; config_value: string }) => r.config_key === configKey);
      if (row) {
        try { setImages(JSON.parse(row.config_value)); } catch { setImages([]); }
      } else {
        setImages([]);
      }
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [configKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPickerImages([]); setPickerOpen(false); }, [country]);

  const loadPickerImages = async () => {
    if (pickerImages.length > 0) return; // already loaded
    setPickerLoading(true);
    try {
      const data = await adminApi.request(`/portfolio-images?country=${country}`);
      setPickerImages(data.images || []);
    } catch {
      showToast('图片加载失败', 'error');
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePicker = () => {
    const next = !pickerOpen;
    setPickerOpen(next);
    if (next) loadPickerImages();
  };

  const addFromPicker = (url: string) => {
    if (images.includes(url)) return;
    const next = [...images, url];
    save(next);
  };

  const save = async (imgs: string[]) => {
    setSaving(true);
    try {
      await adminApi.request('/system-config', {
        method: 'PUT',
        body: JSON.stringify({ configs: [{ key: configKey, value: JSON.stringify(imgs) }] }),
      });
      setImages(imgs);
      showToast(t('Saved', '已保存'), 'success');
    } catch {
      showToast(t('Save failed', '保存失败'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addUrl = () => {
    const url = newUrl.trim();
    if (!url || images.includes(url)) { setNewUrl(''); return; }
    const next = [...images, url];
    setNewUrl('');
    save(next);
  };

  const removeUrl = (idx: number) => {
    save(images.filter((_, i) => i !== idx));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...images];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    save(next);
  };

  const moveDown = (idx: number) => {
    if (idx === images.length - 1) return;
    const next = [...images];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    save(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Showcase Images', '登录页展示图')}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {t('Images shown in the scrolling animation on the login page. Recommended: 18–24 URLs.', '登录页左侧滚动展示的图片，建议放 18–24 张。')}
          </p>
        </div>
        <span className="text-sm text-stone-400">{images.length} {t('images', '张')}</span>
      </div>

      {/* Add URL input */}
      <div className="flex gap-2 mb-6">
        <input
          type="url"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addUrl()}
          placeholder={t('Paste image URL here…', '粘贴图片链接…')}
          className="basis-full sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0"
        />
        <button
          onClick={addUrl}
          disabled={!newUrl.trim() || saving}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#B8864A] text-white text-sm font-medium hover:bg-[#a3780a] transition disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          {t('Add', '添加')}
        </button>
      </div>

      {/* VN portfolio image picker */}
      <div className="mb-6 rounded-xl border border-stone-200 overflow-hidden">
        <button
          onClick={togglePicker}
          className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition text-sm font-medium text-[#44403c]"
        >
          <span>从{country === 'vn' ? '越南' : 'UAE'}装企图库选取</span>
          {pickerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {pickerOpen && (
          <div className="p-4">
            {pickerLoading ? (
              <div className="text-sm text-stone-400 py-6 text-center">加载中…</div>
            ) : pickerImages.length === 0 ? (
              <div className="text-sm text-stone-400 py-6 text-center">暂无图片</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {pickerImages.map((url, i) => {
                  const added = images.includes(url);
                  return (
                    <div
                      key={i}
                      onClick={() => !added && addFromPicker(url)}
                      className={`relative rounded-lg overflow-hidden aspect-[2/3] cursor-pointer group ${added ? 'ring-2 ring-[#B8864A] opacity-60 cursor-default' : 'hover:ring-2 hover:ring-[#B8864A]'}`}
                    >
                      <img src={resolveImageUrl(url)} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                      {!added && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Plus className="w-5 h-5 text-white" />
                        </div>
                      )}
                      {added && <div className="absolute inset-0 flex items-center justify-center text-[#B8864A] text-xs font-bold">✓</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image grid */}
      {loading ? (
        <div className="text-sm text-stone-400 py-8 text-center">{t('Loading…', '加载中…')}</div>
      ) : images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 py-16 flex flex-col items-center gap-3 text-stone-400">
          <ImageOff className="w-10 h-10 opacity-40" />
          <p className="text-sm">{t('No images yet. Paste a URL above to add one.', '还没有图片，在上方粘贴链接添加。')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {images.map((url, idx) => (
            <div key={idx} className="group relative rounded-xl overflow-hidden bg-stone-100 aspect-[2/3]">
              <img
                src={resolveImageUrl(url)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
              />
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-between p-2">
                <div className="flex gap-1 w-full justify-between">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || saving}
                    className="p-1 rounded bg-white/20 hover:bg-white/40 transition disabled:opacity-30 text-white text-xs"
                    title={t('Move up', '上移')}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === images.length - 1 || saving}
                    className="p-1 rounded bg-white/20 hover:bg-white/40 transition disabled:opacity-30 text-white text-xs"
                    title={t('Move down', '下移')}
                  >
                    ↓
                  </button>
                </div>
                <div className="flex gap-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => removeUrl(idx)}
                    disabled={saving}
                    className="p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 transition text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Index badge */}
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-[9px] text-white font-medium">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="mt-4 text-xs text-stone-400">
          {t('Hover over an image to delete or reorder it. Changes save immediately.', '鼠标悬停在图片上可删除或调整顺序，操作即时保存。')}
        </p>
      )}
    </div>
  );
}
