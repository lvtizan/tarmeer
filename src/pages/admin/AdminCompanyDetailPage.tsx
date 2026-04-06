import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';
import SmartImage from '../../components/ui/SmartImage';
import CompanyEditModal from '../../components/admin/CompanyEditModal';

interface CompanyDetail {
  id: number;
  name_en: string;
  name_ar: string | null;
  slug: string;
  city: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  description: string | null;
  logo_url: string | null;
  year_established: number | null;
  license_number: string | null;
  services: string | null;
  specialties: string | null;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_id: number | null;
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
  created_at: string;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-stone-100 text-stone-600',
};

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [showEditModal, setShowEditModal] = useState(false);

  const loadDetail = () => {
    if (!id) return;
    setLoading(true);
    adminApi.getCompanyFullDetail(Number(id))
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

  if (loading) return <PageSpinner />;
  if (error) return <div className="text-red-600 p-6">{error}</div>;
  if (!company) return <div className="p-6 text-stone-400">Company not found.</div>;

  const services = parseJsonArray(company.services);
  const specialties = parseJsonArray(company.specialties);
  const backTab = searchParams.get('tab') || 'directory';

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

      <div className="flex gap-6 items-start">
        {/* ===== LEFT: Company Info ===== */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            {company.logo_url && (
              <SmartImage
                src={company.logo_url}
                alt={company.name_en}
                className="w-16 h-16 rounded-xl object-contain bg-stone-50 border border-stone-100"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-800">{company.name_en}</h1>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
                  title="Edit company"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              </div>
              {company.name_ar && <p className="text-sm text-stone-500 mt-0.5" dir="rtl">{company.name_ar}</p>}
              <p className="text-xs text-stone-400 mt-1">/{company.slug}</p>
            </div>
            {company.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{company.description}</p>
            )}
          </div>

          {/* Details card */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-2.5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Details</h2>
            {company.city && <InfoRow label="City" value={company.city} />}
            {company.area && <InfoRow label="Area" value={company.area} />}
            {company.address && <InfoRow label="Address" value={company.address} />}
            {company.year_established && <InfoRow label="Est." value={String(company.year_established)} />}
            {company.license_number && <InfoRow label="License" value={company.license_number} />}
            {company.phone && <InfoRow label="Phone" value={company.phone} />}
            {company.whatsapp && <InfoRow label="WhatsApp" value={company.whatsapp} />}
            {company.email && <InfoRow label="Email" value={company.email} />}
            {company.website && <InfoRow label="Website" value={company.website} isLink />}
            {company.instagram && <InfoRow label="Instagram" value={company.instagram} isLink />}
            {company.facebook && <InfoRow label="Facebook" value={company.facebook} isLink />}
            {company.linkedin && <InfoRow label="LinkedIn" value={company.linkedin} isLink />}
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

          {/* Owner */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Owner Account</h2>
            {company.owner_user_id ? (
              <div className="space-y-1">
                <div className="font-medium text-stone-800">{company.owner_name}</div>
                <div className="text-stone-500">{company.owner_email}</div>
              </div>
            ) : (
              <p className="text-stone-400 text-xs">Not claimed</p>
            )}
          </div>
        </div>

        {/* ===== RIGHT: Portfolio ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-800">Portfolio <span className="text-stone-400 font-normal text-sm">({projects.length} projects)</span></h2>
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
                  {/* Cover image */}
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

      {showEditModal && (
        <CompanyEditModal
          type="scraped"
          id={Number(id)}
          onClose={() => setShowEditModal(false)}
          onSaved={() => loadDetail()}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, isLink = false }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-20 flex-shrink-0">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#b8864a] hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-stone-700 break-words">{value}</span>
      )}
    </div>
  );
}
