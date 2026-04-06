import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Pencil } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import CompanyEditModal from '../../components/admin/CompanyEditModal';

interface CompanyProfile {
  id: number;
  company_name: string;
  company_type: 'design_studio' | 'renovation_company' | string;
  status: 'pending' | 'approved' | 'rejected';
  description: string | null;
  contact_person: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  address: string | null;
  services: string | null;
  specialties: string | null;
  trade_license_number: string | null;
  establishment_year: number | null;
  logo_url: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_id: number;
  user_email: string;
  user_name: string;
}

interface Project {
  id: number;
  title: string;
  description: string | null;
  style: string | null;
  location: string | null;
  year: number | null;
  images: string[];
  tags: string[];
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-stone-100 text-stone-600',
};

const COMPANY_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function AdminRegisteredCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAdmin();
  const canApprove = hasPermission('can_approve');

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const loadDetail = () => {
    if (!id) return;
    setLoading(true);
    adminApi.getCompanyProfileDetail(Number(id))
      .then((data: any) => {
        setCompany(data.company);
        setProjects(data.projects || []);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDetail(); }, [id]);

  const styles = useMemo(() => {
    const all = projects.flatMap((p) => p.style ? [p.style] : []);
    return ['all', ...Array.from(new Set(all))];
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (activeStyle === 'all') return projects;
    return projects.filter((p) => p.style === activeStyle);
  }, [projects, activeStyle]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    setActionError('');
    try {
      await adminApi.approveCompanyProfile(Number(id));
      loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      await adminApi.rejectCompanyProfile(Number(id), rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      loadDetail();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const backTab = (() => {
    const tab = searchParams.get('tab');
    if (tab === 'applications' || tab === 'directory') return tab;
    return 'companies';
  })();

  if (loading) return <PageSpinner />;
  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!company) return <div className="p-6 text-stone-400">Company not found.</div>;

  const services = parseJsonArray(company.services);
  const specialties = parseJsonArray(company.specialties);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate(`/admin/companies?tab=${backTab}`)}
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Back to Companies
      </button>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="flex gap-6 items-start">
        {/* LEFT: Company Info */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {company.logo_url && (
              <SmartImage
                src={company.logo_url}
                alt={company.company_name}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-800">{company.company_name}</h1>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Edit company"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <a
                  href={`/companies/${company.id}?admin_preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Preview company page"
                >
                  <ExternalLink size={14} />
                  Preview
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {company.company_type === 'design_studio' ? 'Design Studio' : 'Renovation Company'}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMPANY_STATUS_COLORS[company.status] || 'bg-stone-100 text-stone-600'}`}>
                  {company.status}
                </span>
              </div>
            </div>
            {company.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{company.description}</p>
            )}
            {/* Admin actions */}
            {canApprove && company.status === 'pending' && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 border border-red-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
            {company.admin_notes && (
              <div className="mt-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
                <span className="font-medium">Admin notes:</span> {company.admin_notes}
              </div>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Details</h2>
            {company.contact_person && <InfoRow label="Contact" value={company.contact_person} />}
            {company.phone && <InfoRow label="Phone" value={company.phone} />}
            {company.city && <InfoRow label="City" value={company.city} />}
            {company.address && <InfoRow label="Address" value={company.address} />}
            {company.establishment_year && <InfoRow label="Est." value={String(company.establishment_year)} />}
            {company.trade_license_number && <InfoRow label="License" value={company.trade_license_number} />}
            {company.website && (
              <div className="flex gap-2">
                <span className="text-stone-400 w-20 flex-shrink-0">Website</span>
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[#b8864a] hover:underline truncate">{company.website}</a>
              </div>
            )}
            <div className="pt-1 border-t border-stone-100">
              <InfoRow label="Joined" value={new Date(company.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Services / Specialties */}
          {(services.length > 0 || specialties.length > 0) && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
              {services.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Services</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {specialties.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Specialties</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[#b8864a]/10 text-[#b8864a]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Owner account */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Owner Account</h2>
            <div className="font-medium text-stone-800">{company.user_name}</div>
            <div className="text-stone-500">{company.user_email}</div>
          </div>
        </div>

        {/* RIGHT: Portfolio */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-800">
              Portfolio <span className="text-stone-400 font-normal text-sm">({projects.length} projects)</span>
            </h2>
          </div>

          {/* Style tabs */}
          {styles.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStyle(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeStyle === s
                      ? 'bg-[#b8864a] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s === 'all' ? `All (${projects.length})` : s}
                </button>
              ))}
            </div>
          )}

          {/* Project grid */}
          {visibleProjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400">
              No projects yet
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleProjects.map((project) => (
                <div key={project.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group">
                  <div className="aspect-video bg-stone-100 overflow-hidden">
                    {project.images[0] ? (
                      <SmartImage
                        src={project.images[0]}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300">
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-stone-800 leading-snug line-clamp-1">{project.title}</h3>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] || 'bg-stone-100 text-stone-600'}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-stone-400">
                      {project.style && <span>{project.style}</span>}
                      {project.location && <span>· {project.location}</span>}
                      {project.year && <span>· {project.year}</span>}
                    </div>
                    {project.rejection_reason && (
                      <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{project.rejection_reason}</p>
                    )}
                    {project.images.length > 1 && (
                      <p className="text-xs text-stone-400">{project.images.length} photos</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold">Reject Company</h2>
            <p className="text-sm text-stone-500">{company.company_name}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <CompanyEditModal
          type="profile"
          id={Number(id)}
          onClose={() => setShowEditModal(false)}
          onSaved={() => loadDetail()}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-stone-700">{value}</span>
    </div>
  );
}
