import { Link } from 'react-router-dom';
import { FolderOpen, TrendingUp, Eye } from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';

const PRIMARY = '#b8864a';

export default function DesignerDashboardPage() {
  const { profile, projects } = useDesigner();

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-6 lg:px-7">
      <section className="mb-5 rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
        <h1 className="mb-1 text-3xl font-bold text-[#2c2c2c]">Welcome back, {profile.fullName.split(' ')[0]}</h1>
        <p className="text-sm text-stone-500">Here’s an overview of your designer studio.</p>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_10px_30px_rgba(28,18,8,0.04)]">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2">
              <FolderOpen className="h-5 w-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-sm font-medium text-stone-500">Total Projects</span>
          </div>
          <p className="text-3xl font-bold leading-none text-[#2c2c2c]">{projects.length}</p>
        </div>
        <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_10px_30px_rgba(28,18,8,0.04)]">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2">
              <Eye className="h-5 w-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-sm font-medium text-stone-500">Profile Views</span>
          </div>
          <p className="text-3xl font-bold leading-none text-[#2c2c2c]">—</p>
        </div>
        <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-[0_10px_30px_rgba(28,18,8,0.04)]">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2">
              <TrendingUp className="h-5 w-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-sm font-medium text-stone-500">Leads This Month</span>
          </div>
          <p className="text-3xl font-bold leading-none text-[#2c2c2c]">—</p>
        </div>
      </div>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_46px_rgba(28,18,8,0.05)]">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#2c2c2c]">Your Projects</h2>
            <p className="text-xs text-stone-500">Recent work and quick actions</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/designer/projects"
              className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Manage all
            </Link>
            <Link
              to="/designer/upload"
              className="inline-flex items-center justify-center rounded-lg h-9 px-4 text-white text-sm font-bold"
              style={{ backgroundColor: PRIMARY }}
            >
              Upload New Project
            </Link>
          </div>
        </div>
        {projects.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">No projects yet. Add your first project to get started.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/designer/upload/${p.id}`}
                className="group overflow-hidden rounded-[18px] border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-md"
              >
                <div className="aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    src={p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&q=80'}
                    alt=""
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="mb-2 min-h-[2.75rem] line-clamp-2 text-sm font-semibold text-[#2c2c2c]">{p.title}</h3>
                  <p className="text-xs text-stone-500">
                    {p.location && <span>{p.location}</span>}
                    {p.location && p.year && ' · '}
                    {p.year && <span>{p.year}</span>}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold" style={{ color: PRIMARY }}>
                      Edit →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
