import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen, ExternalLink } from 'lucide-react';
import { resolveImageUrl } from '../../lib/imageUrl';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';

const ROLE_BADGE: Record<string, string> = {
  user: 'bg-stone-100 text-stone-700',
  designer: 'bg-[#b8864a]/10 text-[#b8864a]',
  company: 'bg-blue-100 text-blue-800',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi.getUserDetail(Number(id))
      .then(setData)
      .catch((err: any) => setError(err.message || 'Failed to load user.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusToggle = async () => {
    if (!data) return;
    const newStatus = data.user.status === 'active' ? 'suspended' : 'active';
    setActionLoading(true);
    try {
      await adminApi.updateUserStatus(data.user.id, newStatus);
      const refreshed = await adminApi.getUserDetail(Number(id));
      setData(refreshed);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <PageSpinner />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="w-4 h-4" /> Back to users
        </Link>
        <div className="text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">{error || 'User not found.'}</div>
      </div>
    );
  }

  const { user, designer, projects, company, companyApplications } = data;
  const projectStatusStyles: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-700',
    pending: 'bg-amber-100 text-amber-700',
    published: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {resolveImageUrl(user.avatar_url) ? (
            <img src={resolveImageUrl(user.avatar_url)} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-stone-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-xl font-bold">
              {(user.full_name || user.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{user.full_name || 'Unnamed'}</h1>
            <p className="text-sm text-stone-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleStatusToggle}
          disabled={actionLoading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            user.status === 'active'
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          } disabled:opacity-50`}
        >
          {actionLoading ? '...' : user.status === 'active' ? 'Suspend User' : 'Activate User'}
        </button>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">User Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
          <div>
            <span className="text-stone-500">Full Name</span>
            <p className="text-stone-800 font-medium mt-0.5">{user.full_name || '—'}</p>
          </div>
          <div>
            <span className="text-stone-500">Email</span>
            <p className="text-stone-800 font-medium mt-0.5">{user.email}</p>
          </div>
          <div>
            <span className="text-stone-500">Phone</span>
            <p className="text-stone-800 font-medium mt-0.5">{user.phone || '—'}</p>
          </div>
          <div>
            <span className="text-stone-500">City</span>
            <p className="text-stone-800 font-medium mt-0.5">{user.city || '—'}</p>
          </div>
          <div>
            <span className="text-stone-500">Role</span>
            <p className="mt-0.5">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </p>
          </div>
          <div>
            <span className="text-stone-500">Status</span>
            <p className="mt-0.5">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                {user.status}
              </span>
            </p>
          </div>
          <div>
            <span className="text-stone-500">Email Verified</span>
            <p className="text-stone-800 font-medium mt-0.5">{user.email_verified ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-stone-500">Registered</span>
            <p className="text-stone-800 font-medium mt-0.5">{new Date(user.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Linked Designer */}
      {designer && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Linked Designer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-stone-500">Designer ID</span>
              <p className="text-stone-800 font-medium mt-0.5">
                <Link to={`/admin/designers/${designer.id}`} className="text-[#b8864a] hover:underline">
                  #{designer.id}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-stone-500">Status</span>
              <p className="mt-0.5">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  designer.status === 'approved' ? 'bg-green-100 text-green-700'
                  : designer.status === 'rejected' ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>
                  {designer.status}
                </span>
              </p>
            </div>
            <div>
              <span className="text-stone-500">Approved</span>
              <p className="text-stone-800 font-medium mt-0.5">{designer.is_approved ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Linked Company */}
      {company && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Linked Company</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-stone-500">Company ID</span>
              <p className="text-stone-800 font-medium mt-0.5">#{company.id}</p>
            </div>
            <div>
              <span className="text-stone-500">Slug</span>
              <p className="text-stone-800 font-medium mt-0.5">{company.slug}</p>
            </div>
            <div>
              <span className="text-stone-500">City</span>
              <p className="text-stone-800 font-medium mt-0.5">{company.city || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Company Applications */}
      {companyApplications && companyApplications.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Company Applications</h2>
          <div className="space-y-3">
            {companyApplications.map((app: any) => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium text-stone-800">{app.company_name}</span>
                  <span className="text-stone-400 ml-2 text-xs">
                    {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  app.status === 'approved' ? 'bg-green-100 text-green-700'
                  : app.status === 'rejected' ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio / Projects */}
      {designer && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-stone-400" />
              Portfolio ({projects?.length || 0} projects)
            </h2>
            <Link
              to={`/admin/designers/${designer.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#b8864a] hover:underline"
            >
              Full designer page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!projects || projects.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">No projects uploaded yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p: any) => {
                const cover = Array.isArray(p.images) && p.images.length > 0
                  ? (typeof p.images[0] === 'string' ? p.images[0] : '')
                  : '';
                return (
                  <div key={p.id} className="rounded-xl border border-stone-200 overflow-hidden">
                    <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                      {cover ? (
                        <img
                          src={resolveImageUrl(cover)}
                          alt={p.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-stone-800 text-sm truncate">{p.title}</h3>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${projectStatusStyles[p.status] || projectStatusStyles.draft}`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {p.location}{p.year ? ` · ${p.year}` : ''} · {Array.isArray(p.images) ? p.images.length : 0} images
                      </p>
                      {p.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-2">{p.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
