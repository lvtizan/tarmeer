import { Link } from 'react-router-dom';
import { FolderOpen, TrendingUp, Eye } from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';

const PRIMARY = '#b8864a';

export default function DesignerDashboardPage() {
  const { profile, projects } = useDesigner();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">Welcome back, {profile.fullName.split(' ')[0]}</h1>
      <p className="text-stone-500 text-sm mb-8">Here’s an overview of your designer studio.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Total Projects</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">{projects.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Profile Views</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">—</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Leads This Month</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">—</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Your Projects</h2>
          <Link
            to="/designer/projects"
            className="text-sm font-semibold"
            style={{ color: PRIMARY }}
          >
            Manage all
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-stone-500 text-sm py-4">No projects yet. Add your first project to get started.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/designer/upload/${p.id}`}
                className="group rounded-lg border border-stone-200 overflow-hidden bg-white hover:shadow-md hover:border-stone-300 transition"
              >
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                  <img
                    src={p.imageUrls?.[0] || 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&q=80'}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-[#2c2c2c] line-clamp-2 mb-1">{p.title}</h3>
                  <p className="text-stone-500 text-xs">
                    {p.location && <span>{p.location}</span>}
                    {p.location && p.year && ' · '}
                    {p.year && <span>{p.year}</span>}
                  </p>
                  <span className="inline-block mt-2 text-sm font-medium" style={{ color: PRIMARY }}>
                    Edit →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link
          to="/designer/upload"
          className="mt-6 inline-flex items-center justify-center rounded-lg h-10 px-4 text-white text-sm font-bold w-full sm:w-auto"
          style={{ backgroundColor: PRIMARY }}
        >
          Upload New Project
        </Link>
      </div>
    </div>
  );
}
