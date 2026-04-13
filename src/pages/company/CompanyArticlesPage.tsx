import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Plus, ArrowLeft, Sparkles, Trash2, Pencil, FileText } from 'lucide-react';

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

const inputCls =
  'w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white';

const textareaCls =
  'w-full px-5 py-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white resize-y';

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
      const res = await api.get('/api/articles/mine');
      setArticles(res.articles || []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const startNew = () => {
    setEditing('new');
    setForm(emptyForm);
  };

  const startEdit = (a: Article) => {
    setEditing(a);
    setForm(articleToForm(a));
  };

  const backToList = () => {
    setEditing(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/articles/generate', {});
      setForm(f => ({
        ...f,
        title: res.title || f.title,
        content: res.content || f.content,
        excerpt: res.excerpt || f.excerpt,
      }));
      showToast('Draft generated');
    } catch {
      showToast('AI generation not yet available');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('Title is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title,
        content: form.content,
        excerpt: form.excerpt,
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        status: form.status,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
      };
      if (editing === 'new') {
        await api.post('/api/articles', body);
      } else if (editing) {
        await api.put(`/api/articles/${editing.id}`, body);
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
      await api.delete(`/api/articles/${id}`);
      showToast('Article deleted');
      if (editing && editing !== 'new' && editing.id === id) {
        setEditing(null);
      }
      await loadArticles();
    } catch {
      showToast('Failed to delete article');
    }
  };

  const updateField = (field: keyof ArticleForm, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  /* ── Toast ── */
  const toastEl = toast ? (
    <div className="fixed top-6 right-6 z-50 bg-[#2c2c2c] text-white text-sm px-5 py-3 rounded-2xl shadow-lg animate-fade-in">
      {toast}
    </div>
  ) : null;

  /* ── Editor mode ── */
  if (editing !== null) {
    const isExisting = editing !== 'new';
    return (
      <div className="max-w-3xl">
        {toastEl}

        {/* Back */}
        <button
          onClick={backToList}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#b8864a] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Articles
        </button>

        {/* Title input */}
        <input
          type="text"
          placeholder="Article title"
          value={form.title}
          onChange={e => updateField('title', e.target.value)}
          className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder:text-stone-300 text-[#2c2c2c] mb-6"
        />

        {/* AI Generate */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 text-sm font-medium text-[#b8864a] hover:text-[#9a7040] mb-6 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {generating ? 'Generating...' : 'AI Generate Draft'}
        </button>

        {/* Content */}
        <label className="text-sm font-medium text-stone-500 mb-1.5 block">Content</label>
        <textarea
          placeholder="Write your article in markdown..."
          value={form.content}
          onChange={e => updateField('content', e.target.value)}
          className={`${textareaCls} min-h-[300px] font-mono text-sm`}
        />

        {/* Excerpt */}
        <label className="text-sm font-medium text-stone-500 mt-5 mb-1.5 block">Excerpt</label>
        <textarea
          placeholder="Short summary for previews"
          value={form.excerpt}
          onChange={e => updateField('excerpt', e.target.value)}
          rows={2}
          className={textareaCls}
        />

        {/* Tags */}
        <label className="text-sm font-medium text-stone-500 mt-5 mb-1.5 block">Tags (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. interior, villa, modern"
          value={form.tags}
          onChange={e => updateField('tags', e.target.value)}
          className={inputCls}
        />

        {/* SEO Title */}
        <label className="text-sm font-medium text-stone-500 mt-5 mb-1.5 block">SEO Title</label>
        <input
          type="text"
          placeholder="Custom title for search engines"
          value={form.seo_title}
          onChange={e => updateField('seo_title', e.target.value)}
          className={inputCls}
        />

        {/* SEO Description */}
        <label className="text-sm font-medium text-stone-500 mt-5 mb-1.5 block">SEO Description</label>
        <textarea
          placeholder="Meta description for search engines"
          value={form.seo_description}
          onChange={e => updateField('seo_description', e.target.value)}
          rows={2}
          className={textareaCls}
        />

        {/* Status toggle */}
        <label className="text-sm font-medium text-stone-500 mt-5 mb-1.5 block">Status</label>
        <div className="inline-flex rounded-2xl border border-stone-200 overflow-hidden">
          <button
            onClick={() => updateField('status', 'draft')}
            className={`px-5 py-2.5 text-sm font-medium cursor-pointer transition ${
              form.status === 'draft'
                ? 'bg-[#b8864a] text-white'
                : 'bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => updateField('status', 'published')}
            className={`px-5 py-2.5 text-sm font-medium cursor-pointer transition ${
              form.status === 'published'
                ? 'bg-[#b8864a] text-white'
                : 'bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            Published
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-8 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Article'}
          </button>
          {isExisting && (
            <button
              onClick={() => handleDelete((editing as Article).id)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-2xl cursor-pointer transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── List mode ── */
  return (
    <div>
      {toastEl}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-[#2c2c2c]">Articles</h1>
        <button onClick={startNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Article
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-stone-400 text-sm">Loading...</div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-stone-300 mb-4" />
          <p className="text-[15px] text-stone-500 mb-2">No articles yet</p>
          <p className="text-sm text-stone-400 mb-6">Create your first article to share insights with your audience.</p>
          <button onClick={startNew} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create your first article
          </button>
        </div>
      )}

      {/* Article cards */}
      {!loading && articles.length > 0 && (
        <div className="flex flex-col gap-4">
          {articles.map(a => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-[15px] font-semibold text-[#2c2c2c] truncate">{a.title}</h3>
                  <span
                    className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      a.status === 'published'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {a.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                {a.excerpt && (
                  <p className="text-sm text-stone-500 line-clamp-2 mt-1">{a.excerpt}</p>
                )}
                <p className="text-xs text-stone-400 mt-2">
                  {new Date(a.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(a)}
                  className="p-2 rounded-xl text-stone-400 hover:text-[#b8864a] hover:bg-stone-50 cursor-pointer transition"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
