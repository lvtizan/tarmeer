import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, MousePointerClick, FolderOpen, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { adminApi, AdminDesignerDetail, AdminDesignerProject } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { formatCount } from '../../lib/formatNumber';

const PRIMARY = '#b8864a';

const projectStatusStyles: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-700',
  pending: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function AdminDesignerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAdmin();
  const [detail, setDetail] = useState<AdminDesignerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectingProject, setRejectingProject] = useState<AdminDesignerProject | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const canApprove = hasPermission('can_approve');

  const loadDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApi.getDesigner(Number(id));
      setDetail(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load designer details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [id]);

  const handleApproveProject = async (projectId: number) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await adminApi.approveProject(projectId);
      await loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectProject = async () => {
    if (!rejectingProject || !rejectReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await adminApi.rejectProject(rejectingProject.id, rejectReason);
      setRejectingProject(null);
      setRejectReason('');
      await loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDesigner = async () => {
    if (!detail || !deleteReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await adminApi.deleteDesigner(detail.designer.id, deleteReason);
      setShowDeleteModal(false);
      setDeleteReason('');
      await loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete designer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreDesigner = async () => {
    if (!detail) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await adminApi.restoreDesigner(detail.designer.id);
      await loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to restore designer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-stone-500">Loading designer details...</div>;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link to="/admin/designers" className="inline-flex items-center gap-2 text-sm font-medium mb-6" style={{ color: PRIMARY }}>
          <ArrowLeft className="w-4 h-4" />
          Back to designers
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { designer, projects, stats } = detail;

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/admin/designers" className="inline-flex items-center gap-2 text-sm font-medium mb-6" style={{ color: PRIMARY }}>
        <ArrowLeft className="w-4 h-4" />
        Back to designers
      </Link>

      {actionError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            {designer.avatar_url ? (
              <img src={designer.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-xl font-semibold text-stone-500">
                {designer.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">{designer.full_name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                <span>{designer.email}</span>
                {designer.phone && <span>{designer.phone}</span>}
                {designer.city && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {designer.city}
                  </span>
                )}
              </div>
              {designer.bio && <p className="mt-4 text-sm text-stone-600 leading-6 max-w-3xl">{designer.bio}</p>}
              {designer.deleted_at && (
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                  <p>Deleted at: {new Date(designer.deleted_at).toLocaleString()}</p>
                  {designer.delete_reason && <p className="mt-1">Reason: {designer.delete_reason}</p>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${designer.deleted_at ? 'bg-stone-200 text-stone-700' : designer.status === 'approved' ? 'bg-green-100 text-green-700' : designer.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {designer.deleted_at ? 'Designer deleted' : `Designer ${designer.status}`}
            </div>
            {canApprove && !designer.deleted_at && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-black disabled:opacity-50"
              >
                Delete
              </button>
            )}
            {canApprove && designer.deleted_at && (
              <button
                type="button"
                onClick={handleRestoreDesigner}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-stone-700 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
              >
                Restore
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Profile Views</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(stats.total_profile_views)}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <MousePointerClick className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Contact Clicks</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(stats.total_contact_clicks)}</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-sm font-medium text-stone-500">Projects</span>
          </div>
          <p className="text-2xl font-bold text-[#2c2c2c]">{projects.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#2c2c2c]">Projects</h2>
          <span className="text-sm text-stone-500">{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <p className="text-stone-500 py-8 text-center">No projects uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="rounded-lg border border-stone-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="w-full lg:w-40 h-28 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                    {project.images[0] ? (
                      <img src={project.images[0]} alt={project.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-stone-400">No image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#2c2c2c]">{project.title}</h3>
                        <p className="text-sm text-stone-500 mt-1">
                          {[project.style, project.location, project.year].filter(Boolean).join(' · ') || 'No metadata'}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${projectStatusStyles[project.status] || projectStatusStyles.draft}`}>
                        {project.status}
                      </span>
                    </div>
                    {project.description && <p className="mt-3 text-sm text-stone-600 leading-6">{project.description}</p>}
                    {project.rejection_reason && (
                      <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                        Rejection reason: {project.rejection_reason}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-stone-500">
                        Submitted {new Date(project.created_at).toLocaleDateString()}
                      </p>
                      {canApprove && !designer.deleted_at && project.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveProject(project.id)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingProject(project)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-stone-200 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-[#2c2c2c] mb-2">Reject Project</h3>
            <p className="text-sm text-stone-600 mb-4">{rejectingProject.title}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
              placeholder="Please explain why this project is being rejected..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectingProject(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectProject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-stone-200 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-[#2c2c2c] mb-2">Delete Designer</h3>
            <p className="text-sm text-stone-600 mb-4">{designer.full_name}</p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]"
              placeholder="Please explain why this designer is being deleted..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason('');
                }}
                className="px-4 py-2 text-stone-600 hover:text-[#2c2c2c]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDesigner}
                disabled={isSubmitting || !deleteReason.trim()}
                className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-black disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Designer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
