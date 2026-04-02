import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useDesigner } from '../../contexts/DesignerContext';

export default function DesignerProjectsPage() {
  const navigate = useNavigate();
  const { projects, deleteProject, isProjectsLoading, projectsError } = useDesigner();
  const hasProjects = projects.length > 0;

  const statusStyles: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-700',
    pending: 'bg-amber-100 text-amber-700',
    published: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    uploading: 'bg-blue-100 text-blue-700',
    upload_failed: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#2c2c2c] mb-1">My Projects</h1>
          <p className="text-stone-500 text-sm">Manage and publish your portfolio projects.</p>
        </div>
        {hasProjects && (
          <Link
            to="/dashboard/upload"
            className="btn-primary inline-flex items-center gap-2 h-10 px-5 text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </Link>
        )}
      </div>

      {isProjectsLoading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500">
          Loading projects...
        </div>
      ) : !hasProjects ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <p className="text-stone-500 mb-6">You haven’t added any projects yet.</p>
          <Link
            to="/dashboard/upload"
            className="btn-primary inline-flex items-center gap-2 h-11 px-6 text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            Upload Your First Project
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {projectsError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              We couldn&apos;t refresh the latest project data. Showing the projects already available in your session.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/upload/${p.id}`)}
                onKeyDown={(e) => { if (e.key === ‘Enter’ || e.key === ‘ ‘) navigate(`/dashboard/upload/${p.id}`); }}
                className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-lg hover:border-[#b8864a]/40 transition cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-stone-100 overflow-hidden">
                  {p.imageUrls[0] ? (
                    <img
                      src={p.imageUrls[0]}
                      alt={p.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-[#2c2c2c] truncate group-hover:text-[#b8864a] transition-colors">{p.title}</h3>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[p.status] || statusStyles.draft}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mb-3">{p.location} · {p.year}</p>
                  {p.status === ‘uploading’ && (
                    <p className="mb-3 text-xs text-blue-700">uploading...</p>
                  )}
                  {p.status === ‘upload_failed’ && (
                    <p className="mb-3 text-xs text-red-600">Upload failed. Auto retry limit reached.</p>
                  )}
                  {p.rejectionReason && (
                    <p className="text-xs text-red-600 mb-3 line-clamp-2">{p.rejectionReason}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg h-9 px-3 border border-stone-200 bg-white text-[#2c2c2c] text-sm font-medium group-hover:bg-stone-50 group-hover:border-[#b8864a]/30 transition">
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(‘Delete this project?’)) {
                          await deleteProject(p.id);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-lg h-9 w-9 border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
