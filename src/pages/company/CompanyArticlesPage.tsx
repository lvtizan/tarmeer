import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Plus, ChevronLeft, Sparkles, Trash2, Pencil, FileText } from 'lucide-react';

const PRIMARY = '#b8864a';

const inputCls =
  'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white transition';

const textareaCls =
  'w-full px-5 py-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white resize-y transition';

const labelCls = 'block text-xs font-medium uppercase tracking-wider text-stone-500 mb-1.5';

interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover_image: string | null;
  tags: string[] | null;
  status: 'draft' | 'published';
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

interface ArticleForm {
  title: string;
  content: string;
  excerpt: string;
  tags: string;
  status: 'draft' | 'published';
  seo_title: string;
  seo_description: string;
}

const emptyForm: ArticleForm = {
  title: '',
  content: '',
  excerpt: '',
  tags: '',
  status: 'draft',
  seo_title: '',
  seo_description: '',
};

function articleToForm(a: Article): ArticleForm {
  return {
    title: a.title || '',
    content: a.content || '',
    excerpt: a.excerpt || '',
    tags: (a.tags || []).join(', '),
    status: a.status,
    seo_title: a.seo_title || '',
    seo_description: a.seo_description || '',
  };
}

export default function CompanyArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Article | 'new' | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadArticles = useCallback(async () => {
    try {
      const res = await api.get('/articles/mine');
      setArticles(res.articles || []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const startNew = () => { setEditing('new'); setForm(emptyForm); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startEdit = (a: Article) => { setEditing(a); setForm(articleToForm(a)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const backToList = () => { setEditing(null); };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/articles/generate', {});
      setForm(f => ({ ...f, title: res.title || f.title, content: res.content || f.content, excerpt: res.excerpt || f.excerpt }));
      showToast('Draft generated');
    } catch {
      showToast('AI generation not yet available');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Title is required'); return; }
    setSaving(true);
    try {
      const body = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: form.status,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
      };
      if (editing === 'new') {
        await api.post('/articles', body);
      } else if (editing) {
        await api.put(`/articles/${editing.id}`, body);
      }
      showToast('Article saved');
      setEditing(null);
      await loadArticles();
    } catch {
      showToast('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return;
    try {
      await api.delete(`/articles/${id}`);
      showToast('Article deleted');
      if (editing && editing !== 'new' && (editing as Article).id === id) setEditing(null);
      await loadArticles();
    } catch {
      showToast('Failed to delete article');
    }
  };

  const updateField = (field: keyof ArticleForm, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const toastEl = toast ? (
    <div className="fixed top-6 right-6 z-50 bg-[#2c2c2c] text-white text-sm px-5 py-3 rounded-2xl shadow-lg">
      {toast}
    </div>
  ) : null;

  /* ── Editor view ── */
  if (editing !== null) {
    const isExisting = editing !== 'new';
    return (
      <div className="w-full">
        {toastEl}
        <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">

          {/* Sticky top bar */}
          <div className="sticky top-3 z-20 mb-6 w-full rounded-[24px] border border-stone-200 bg-[#faf9f7]/95 px-5 py-3.5 shadow-[0_12px_30px_rgba(28,18,8,0.08)] backdrop-blur md:px-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <button
                  onClick={backToList}
                  className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to Articles
                </button>
                <h1 className="text-2xl font-bold text-[#2c2c2c]">
                  {isExisting ? 'Edit Article' : 'New Article'}
                </h1>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-[#b8864a] hover:bg-stone-50 transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {generating ? 'Generating...' : 'AI Draft'}
                </button>
                {isExisting && (
                  <button
                    onClick={() => handleDelete((editing as Article).id)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 rounded-xl px-6 text-sm font-bold text-white transition disabled:opacity-60"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {saving ? 'Saving...' : 'Save Article'}
                </button>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid w-full items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">

            {/* LEFT: Main content */}
            <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_20px_60px_rgba(28,18,8,0.05)] space-y-5">
              <div>
                <label className={labelCls}>Article Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="Enter article title"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Content (Markdown)</label>
                <textarea
                  placeholder="Write your article in markdown..."
                  value={form.content}
                  onChange={e => updateField('content', e.target.value)}
                  className={`${textareaCls} min-h-[420px] font-mono text-sm`}
                />
                <p className="mt-1.5 text-xs text-stone-400">Supports Markdown — ## headings, **bold**, ![image](url)</p>
              </div>
              <div>
                <label className={labelCls}>Excerpt</label>
                <textarea
                  placeholder="Short summary shown in previews and search results"
                  value={form.excerpt}
                  onChange={e => updateField('excerpt', e.target.value)}
                  rows={3}
                  className={textareaCls}
                />
              </div>
            </section>

            {/* RIGHT: Meta & settings */}
            <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">

              {/* Publish settings */}
              <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
                <h2 className="mb-4 text-sm font-bold text-[#2c2c2c]">Publishing</h2>
                <div className="mb-4">
                  <label className={labelCls}>Status</label>
                  <div className="flex rounded-2xl border border-stone-200 overflow-hidden">
                    <button
                      onClick={() => updateField('status', 'draft')}
                      className={`flex-1 py-2.5 text-sm font-semibold transition ${
                        form.status === 'draft' ? 'text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
                      }`}
                      style={form.status === 'draft' ? { backgroundColor: PRIMARY } : {}}
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => updateField('status', 'published')}
                      className={`flex-1 py-2.5 text-sm font-semibold transition ${
                        form.status === 'published' ? 'text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
                      }`}
                      style={form.status === 'published' ? { backgroundColor: PRIMARY } : {}}
                    >
                      Published
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. interior, villa, modern"
                    value={form.tags}
                    onChange={e => updateField('tags', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </section>

              {/* SEO */}
              <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(28,18,8,0.06)]">
                <h2 className="mb-4 text-sm font-bold text-[#2c2c2c]">SEO</h2>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>SEO Title</label>
                    <input
                      type="text"
                      placeholder="Custom title for search engines"
                      value={form.seo_title}
                      onChange={e => updateField('seo_title', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SEO Description</label>
                    <textarea
                      placeholder="Meta description (150–160 characters recommended)"
                      value={form.seo_description}
                      onChange={e => updateField('seo_description', e.target.value)}
                      rows={3}
                      className={textareaCls}
                    />
                    <p className="mt-1.5 text-xs text-stone-400">{form.seo_description.length}/160 characters</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="w-full">
      {toastEl}
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">
      {/* SEO tip banner */}
      <div className="mb-6 flex items-center gap-3 rounded-xl bg-[#b8864a]/8 border border-[#b8864a]/20 px-4 py-3">
        <span className="text-base">✍️</span>
        <p className="text-sm text-[#7a5c2e] leading-snug">
          Each article you publish adds <strong>+10 points</strong> to your ranking score and improves your Google SEO, bringing in more organic traffic.
        </p>
      </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#2c2c2c]">Articles ({articles.length})</h1>
            <p className="mt-0.5 text-sm text-stone-500">Share insights and showcase your work.</p>
          </div>
          <button
            onClick={startNew}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" />
            New Article
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-stone-400 text-sm">Loading...</div>
        )}

        {/* Empty state */}
        {!loading && articles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b8864a]/10">
              <FileText className="h-7 w-7 text-[#b8864a]" />
            </div>
            <p className="text-sm font-semibold text-stone-700">No articles yet</p>
            <p className="mt-1 text-xs text-stone-500">Create your first article to share insights with your audience.</p>
          </div>
        )}

        {/* Article cards */}
        {!loading && articles.length > 0 && (
          <div className="flex flex-col gap-3">
            {articles.map(a => (
              <div
                key={a.id}
                className="group flex items-start justify-between gap-4 rounded-[20px] border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="text-[15px] font-semibold text-[#2c2c2c] truncate">{a.title}</h3>
                    <span
                      className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        a.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {a.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {a.excerpt && (
                    <p className="text-sm text-stone-500 line-clamp-2">{a.excerpt}</p>
                  )}
                  <p className="mt-2 text-xs text-stone-400">
                    {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(a)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 hover:border-[#b8864a]/30 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
