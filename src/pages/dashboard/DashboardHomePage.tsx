import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useDesigner, DesignerProjectItem } from '../../contexts/DesignerContext';
import Avatar from '../../components/ui/Avatar';

interface UserData {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  role: string;
  active_role: string;
  status: string;
  created_at: string;
}

interface ChecklistItem {
  step: number;
  title: string;
  description: string;
  done: boolean;
  to: string;
}

function buildChecklist(user: UserData, projects: DesignerProjectItem[]): ChecklistItem[] {
  const hasName = !!user.full_name?.trim();
  const hasCity = !!user.city?.trim();
  const hasPhone = !!user.phone?.trim();
  const profileDone = hasName && hasCity && hasPhone;

  const hasProjects = projects.length > 0;
  const publishedProjects = projects.filter(p => p.status === 'published').length;

  return [
    {
      step: 1,
      title: 'Complete personal information',
      description: 'Add your city, phone number, and full name to build trust with clients.',
      done: profileDone,
      to: '/dashboard/profile',
    },
    {
      step: 2,
      title: 'Upload portfolio projects',
      description: 'Add high-quality projects with cover images, location, and descriptions.',
      done: hasProjects,
      to: '/dashboard/projects',
    },
    {
      step: 3,
      title: 'Get projects approved',
      description: 'Submit your projects for review. Approved projects appear on your public profile.',
      done: publishedProjects > 0,
      to: '/dashboard/projects',
    },
    {
      step: 4,
      title: 'Share your profile',
      description: 'Once approved, share your Tarmeer profile link with potential clients.',
      done: false,
      to: '/dashboard/profile',
    },
  ];
}

function projectStatusLabel(status: string) {
  switch (status) {
    case 'published': return 'Approved';
    case 'pending': return 'Pending review';
    case 'rejected': return 'Needs revision';
    case 'draft': return 'Draft';
    default: return status;
  }
}

function projectStatusColor(status: string) {
  switch (status) {
    case 'published': return 'bg-green-900 text-white';
    case 'pending': return 'bg-amber-100 text-amber-800';
    case 'rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-stone-200 text-stone-700';
  }
}

export default function DashboardHomePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const { projects } = useDesigner();

  useEffect(() => {
    api.getMe()
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-20 text-stone-500">Failed to load profile.</div>;
  }

  const checklist = buildChecklist(user, projects);
  const firstName = (user.full_name || '').split(' ')[0] || 'there';
  const joinYear = user.created_at ? new Date(user.created_at).getFullYear() : 2026;
  const yearsExp = 2026 - joinYear || 1;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <h1 className="text-2xl font-bold text-stone-900">
        Welcome back, {firstName}
      </h1>

      {/* Top row: Checklist + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* What to complete next */}
        <div className="bg-[#faf5ef] rounded-2xl p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-lg font-bold text-stone-900">What to complete next</h2>
            <Link to="/dashboard/profile" className="text-sm text-stone-600 hover:text-stone-900 transition">
              View all
            </Link>
          </div>
          <p className="text-sm text-stone-500 mb-5">
            Complete these steps to get the most out of your Tarmeer profile.
          </p>
          <div className="space-y-3">
            {checklist.map((item) => (
              <Link
                key={item.step}
                to={item.to}
                className="flex items-start gap-4 bg-white rounded-xl p-4 border border-stone-100 hover:border-[#b8864a]/30 hover:shadow-sm transition group"
              >
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  item.done
                    ? 'bg-[#b8864a]/10 text-[#b8864a]'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {item.done ? <Check className="w-5 h-5" /> : `0${item.step}`}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-stone-900 group-hover:text-[#b8864a] transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.description}</p>
                </div>
                <span className={`shrink-0 self-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                  item.done
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {item.done ? 'Done' : 'Pending'}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Profile summary */}
        <div className="bg-[#faf5ef] rounded-2xl p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-lg font-bold text-stone-900">Profile summary</h2>
            <Link to="/dashboard/profile" className="text-sm text-stone-600 hover:text-stone-900 transition">
              Edit
            </Link>
          </div>
          <p className="text-sm text-stone-500 mb-5">
            How clients see you at a glance.
          </p>

          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={user.full_name || 'U'} size="lg" />
            <div>
              <h3 className="text-lg font-bold text-stone-900">{user.full_name || 'Your Name'}</h3>
              <p className="text-sm text-stone-500">{user.email}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Location</div>
              <div className="text-sm font-semibold text-stone-900">{user.city || 'Not set'}</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Member since</div>
              <div className="text-sm font-semibold text-stone-900">{joinYear}</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Projects</div>
              <div className="text-sm font-semibold text-stone-900">{projects.length || 0}</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-100 px-4 py-3">
              <div className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">Status</div>
              <div className="text-sm font-semibold text-stone-900 capitalize">{user.status || 'Active'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio preview */}
      {(
        <div className="bg-[#faf5ef] rounded-2xl p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-lg font-bold text-stone-900">Portfolio preview</h2>
            <Link to="/dashboard/projects" className="text-sm text-stone-600 hover:text-stone-900 transition">
              Manage portfolio
            </Link>
          </div>
          <p className="text-sm text-stone-500 mb-5">
            Your latest projects as clients will see them.
          </p>

          {projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-100 p-8 text-center">
              <p className="text-stone-500 mb-4">No projects yet. Upload your first project to build your portfolio.</p>
              <Link
                to="/dashboard/upload"
                className="btn-primary inline-flex items-center gap-2 h-10 px-5 text-sm font-medium"
              >
                Upload Project
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={`/dashboard/upload/${p.id}`}
                  className="bg-white rounded-xl border border-stone-100 overflow-hidden hover:shadow-md hover:border-[#b8864a]/30 transition group"
                >
                  <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                    {p.imageUrls[0] ? (
                      <img
                        src={p.imageUrls[0]}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
                        No cover
                      </div>
                    )}
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-semibold ${projectStatusColor(p.status)}`}>
                      {projectStatusLabel(p.status)}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-900 group-hover:text-[#b8864a] transition truncate">
                      {p.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {[p.style, p.location].filter(Boolean).join(' \u00b7 ') || 'No details'}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[11px] text-stone-400">
                        {p.imageUrls.length} {p.imageUrls.length === 1 ? 'image' : 'images'}
                      </span>
                      <span className="text-xs font-medium text-[#b8864a] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        View project <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
