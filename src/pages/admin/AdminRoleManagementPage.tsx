import React, { useState, useEffect, useMemo } from 'react';
import CompanyEditModal from '../../components/admin/CompanyEditModal';
import { PageSpinner } from '../../components/ui/Spinner';
import { resolveImageUrl } from '../../lib/imageUrl';
import AdminSelect from '../../components/ui/AdminSelect';
import { useAdminT } from '../../hooks/useAdminLang';
const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

type RoleTab = 'homeowners' | 'companies';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface Designer {
  id: string;
  avatar?: string;
  name: string;
  email: string;
  city: string;
  projectsCount: number;
  status: 'pending' | 'approved' | 'rejected';
  displayOrder: number;
  date: string;
}

interface Homeowner {
  id: string;
  name: string;
  email: string;
  city: string;
  area: number;
  budget: number;
  stage: string;
  assignedDesigner?: string;
  designerId?: string;
  date: string;
}

interface Company {
  id: string;
  logo?: string;
  name: string;
  contact: string;
  phone: string;
  city: string;
  services: string[];
  status: 'pending' | 'approved' | 'rejected';
  linkedUaeCompany?: string;
  displayOrder: number;
  date: string;
  company_type?: 'design_studio' | 'renovation_company';
}

interface UAECompany {
  id: string;
  name: string;
  logo?: string;
}

interface MergeCandidates {
  uaeCompanies: UAECompany[];
}

interface AssignDesignerModalProps {
  homeownerId: string;
  homeownerName: string;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (designerId: string) => void;
  designers: Designer[];
  isLoading: boolean;
}

interface MergeModalProps {
  company: Company;
  isOpen: boolean;
  onClose: () => void;
  onMerge: (uaeCompanyId: string) => void;
  candidates: UAECompany[];
  isLoading: boolean;
}

const AssignDesignerModal: React.FC<AssignDesignerModalProps> = ({
  homeownerId: _homeownerId,
  homeownerName,
  isOpen,
  onClose,
  onAssign,
  designers,
  isLoading,
}) => {
  const { t } = useAdminT();
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>('');

  const approvedDesigners = designers.filter(d => d.status === 'approved');

  const handleAssign = () => {
    if (selectedDesignerId) {
      onAssign(selectedDesignerId);
      setSelectedDesignerId('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t('Assign Designer to', '分配设计师给')} {homeownerName}
        </h3>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {t('Select Designer', '选择设计师')}
          </label>
          <AdminSelect
            value={selectedDesignerId}
            onChange={(val) => setSelectedDesignerId(val)}
            options={[
              { value: '', label: t('Choose a designer...', '请选择设计师...') },
              ...approvedDesigners.map((designer) => ({
                value: designer.id,
                label: `${designer.name} (${designer.city})`,
              })),
            ]}
            disabled={isLoading}
            className="w-full"
          />
          {approvedDesigners.length === 0 && (
            <p className="mt-2 text-sm text-amber-600">{t('No approved designers available', '暂无已通过的设计师')}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
            disabled={isLoading}
          >
            {t('Cancel', '取消')}
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDesignerId || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('Assigning...', '分配中...') : t('Assign', '分配')}
          </button>
        </div>
      </div>
    </div>
  );
};

const MergeModal: React.FC<MergeModalProps> = ({
  company,
  isOpen,
  onClose,
  onMerge,
  candidates,
  isLoading,
}) => {
  const { t } = useAdminT();
  const [selectedCandidate, setSelectedCandidate] = useState<UAECompany | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [candidates, searchQuery]);

  const handleMerge = () => {
    if (selectedCandidate) {
      onMerge(selectedCandidate.id);
      setSelectedCandidate(null);
      setSearchQuery('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {t('Merge', '合并')} {company.name}
        </h3>
        <p className="text-sm text-amber-600 mb-4">
          {t('Warning: Scraped data will override registered data', '警告：爬取的数据将覆盖注册数据')}
        </p>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left side: Registered Company */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">{t('Registered Company', '已注册公司')}</h4>
            {company.logo && (
              <img
                src={resolveImageUrl(company.logo)}
                alt={company.name}
                className="w-16 h-16 object-contain mb-3"
              />
            )}
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-700">{t('Name', '名称')}:</span> {company.name}</p>
              <p><span className="font-medium text-slate-700">{t('Contact', '联系人')}:</span> {company.contact}</p>
              <p><span className="font-medium text-slate-700">{t('Phone', '电话')}:</span> {company.phone}</p>
              <p><span className="font-medium text-slate-700">{t('City', '城市')}:</span> {company.city}</p>
              {company.services.length > 0 && (
                <div>
                  <p className="font-medium text-slate-700 mb-1">{t('Services', '服务')}:</p>
                  <div className="flex flex-wrap gap-1">
                    {company.services.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: UAE Companies Search */}
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">{t('Select UAE Company', '选择 UAE 公司')}</h4>
            <input
              type="text"
              placeholder={t('Search companies...', '搜索公司...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 text-sm"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(candidate)}
                    className={`w-full p-3 text-left rounded-md border-2 transition ${
                      selectedCandidate?.id === candidate.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {candidate.logo && (
                      <img
                        src={resolveImageUrl(candidate.logo)}
                        alt={candidate.name}
                        className="w-8 h-8 object-contain mb-1"
                      />
                    )}
                    <p className="text-sm font-medium text-slate-900">{candidate.name}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">{t('No companies found', '未找到公司')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
            disabled={isLoading}
          >
            {t('Cancel', '取消')}
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedCandidate || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('Merging...', '合并中...') : t('Merge', '合并')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminRoleManagementPage: React.FC = () => {
  const { t } = useAdminT();
  const [activeTab, setActiveTab] = useState<RoleTab>('homeowners');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [mergeCandidates, setMergeCandidates] = useState<UAECompany[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedHomeowner, setSelectedHomeowner] = useState<Homeowner | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [editProfileId, setEditProfileId] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);

  const token = localStorage.getItem('adminToken');

  // Fetch homeowners
  const fetchHomeowners = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/admin/roles/homeowners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch homeowners');
      const data = await response.json();
      setHomeowners(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch designers
  const fetchDesigners = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/admin/roles/designers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch designers');
      const data = await response.json();
      setDesigners(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const statusQuery = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`${API_BASE}/admin/roles/companies${statusQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      const data = await response.json();
      setCompanies(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch merge candidates
  const fetchMergeCandidates = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/companies/merge-candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch merge candidates');
      const data: MergeCandidates = await response.json();
      setMergeCandidates(data.uaeCompanies);
    } catch (err) {
      console.error('Failed to fetch merge candidates:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'homeowners') {
      fetchHomeowners();
    } else if (activeTab === 'companies') {
      fetchCompanies();
    }
  }, [activeTab, statusFilter, token]);

  useEffect(() => {
    if (assignModalOpen) {
      fetchDesigners();
    }
  }, [assignModalOpen]);

  useEffect(() => {
    if (mergeModalOpen) {
      fetchMergeCandidates();
    }
  }, [mergeModalOpen]);

  const handleAssignDesigner = async (designerId: string) => {
    if (!selectedHomeowner) return;

    try {
      setAssignLoading(true);
      const response = await fetch(
        `${API_BASE}/admin/homeowners/${selectedHomeowner.id}/assign`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ designerId }),
        }
      );

      if (!response.ok) throw new Error('Failed to assign designer');

      // Update local state
      setHomeowners(
        homeowners.map((h) =>
          h.id === selectedHomeowner.id
            ? { ...h, designerId, assignedDesigner: designerId }
            : h
        )
      );

      setAssignModalOpen(false);
      setSelectedHomeowner(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign designer');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleApproveCompany = async (companyId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/roles/companies/${companyId}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to approve company');

      setCompanies(
        companies.map((c) =>
          c.id === companyId ? { ...c, status: 'approved' } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve company');
    }
  };

  const handleRejectCompany = async (companyId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/roles/companies/${companyId}/reject`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to reject company');

      setCompanies(
        companies.map((c) =>
          c.id === companyId ? { ...c, status: 'rejected' } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject company');
    }
  };

  const handleSetCompanyDisplayOrder = async (companyId: string, order: number) => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/roles/companies/${companyId}/display-order`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ displayOrder: order }),
        }
      );

      if (!response.ok) throw new Error('Failed to update display order');

      setCompanies(
        companies.map((c) =>
          c.id === companyId ? { ...c, displayOrder: order } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update display order');
    }
  };

  const handleMergeCompany = async (uaeCompanyId: string) => {
    if (!selectedCompany) return;

    try {
      setMergeLoading(true);
      const response = await fetch(
        `${API_BASE}/admin/companies/${selectedCompany.id}/merge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uaeCompanyId }),
        }
      );

      if (!response.ok) throw new Error('Failed to merge companies');

      setCompanies(
        companies.map((c) =>
          c.id === selectedCompany.id
            ? { ...c, linkedUaeCompany: uaeCompanyId }
            : c
        )
      );

      setMergeModalOpen(false);
      setSelectedCompany(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge companies');
    } finally {
      setMergeLoading(false);
    }
  };

  const getTabCounts = () => {
    const companiesCount = companies.length;
    return {
      homeowners: homeowners.length,
      companies: companiesCount,
    };
  };

  const counts = getTabCounts();
  const filteredCompanies = statusFilter === 'all'
    ? companies
    : companies.filter(c => c.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{t('Role Management', '角色管理')}</h1>
          <p className="text-slate-600 mt-2">{t('Manage homeowners, designers, and companies', '管理业主、设计师和公司')}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'homeowners', label: t('Homeowners', '装修业主'), count: counts.homeowners },
                { id: 'companies', label: t('Companies', '装修公司'), count: counts.companies },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as RoleTab);
                    setStatusFilter('all');
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 inline-block bg-slate-200 text-slate-700 rounded-full px-2 py-1 text-xs font-semibold">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading ? (
              <PageSpinner />
            ) : activeTab === 'homeowners' ? (
              <HomeownersTab
                homeowners={homeowners}
                onAssignClick={(homeowner) => {
                  setSelectedHomeowner(homeowner);
                  setAssignModalOpen(true);
                }}
              />
            ) : (
              <CompaniesTab
                companies={filteredCompanies}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onApprove={handleApproveCompany}
                onReject={handleRejectCompany}
                onSetDisplayOrder={handleSetCompanyDisplayOrder}
                onMergeClick={(company) => {
                  setSelectedCompany(company);
                  setMergeModalOpen(true);
                }}
                onEditClick={(companyId) => setEditProfileId(parseInt(companyId))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedHomeowner && (
        <AssignDesignerModal
          homeownerId={selectedHomeowner.id}
          homeownerName={selectedHomeowner.name}
          isOpen={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedHomeowner(null);
          }}
          onAssign={handleAssignDesigner}
          designers={designers}
          isLoading={assignLoading}
        />
      )}

      {editProfileId && (
        <CompanyEditModal
          type="profile"
          id={editProfileId}
          onClose={() => setEditProfileId(null)}
          onSaved={() => { setEditProfileId(null); window.location.reload(); }}
        />
      )}

      {selectedCompany && (
        <MergeModal
          company={selectedCompany}
          isOpen={mergeModalOpen}
          onClose={() => {
            setMergeModalOpen(false);
            setSelectedCompany(null);
          }}
          onMerge={handleMergeCompany}
          candidates={mergeCandidates}
          isLoading={mergeLoading}
        />
      )}
    </div>
  );
};

// Homeowners Tab Component
const HomeownersTab: React.FC<{
  homeowners: Homeowner[];
  onAssignClick: (homeowner: Homeowner) => void;
}> = ({ homeowners, onAssignClick }) => {
  const { t } = useAdminT();
  if (homeowners.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">{t('No homeowners found', '暂无业主')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Name', '名称')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Email', '邮箱')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('City', '城市')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Area', '面积')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Budget', '预算')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Stage', '阶段')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Designer', '设计师')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Date', '日期')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
              {t('Action', '操作')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {homeowners.map((homeowner) => (
            <tr key={homeowner.id} className="hover:bg-slate-50 transition">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                {homeowner.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {homeowner.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {homeowner.city}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {homeowner.area} sqm
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                ${homeowner.budget.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {homeowner.stage}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {homeowner.assignedDesigner || '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {new Date(homeowner.date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  onClick={() => onAssignClick(homeowner)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                >
                  {t('Assign Designer', '分配设计师')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Companies Tab Component
const CompaniesTab: React.FC<{
  companies: Company[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  onApprove: (companyId: string) => void;
  onReject: (companyId: string) => void;
  onSetDisplayOrder: (companyId: string, order: number) => void;
  onMergeClick: (company: Company) => void;
  onEditClick: (companyId: string) => void;
}> = (props) => {
  const { t } = useAdminT();
  const {
    companies,
    statusFilter,
    onStatusFilterChange,
    onApprove,
    onReject,
    onSetDisplayOrder,
    onMergeClick,
    onEditClick,
  } = props;
  return (
    <div>
      {/* Status Filter */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => onStatusFilterChange(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600">{t('No companies found', '未找到公司')}</p>
        </div>
      ) : (
        <>
        {/* ── Mobile card list ── */}
        <div className="sm:hidden space-y-3">
          {companies.map((company) => (
            <div key={company.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-stone-900 truncate">{company.name}</p>
                  <p className="text-[13px] text-stone-500">{company.contact} · {company.phone}</p>
                  <p className="text-[12px] text-stone-400">{company.city}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ${
                  company.status === 'approved' ? 'bg-green-100 text-green-800'
                  : company.status === 'pending' ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
                }`}>
                  {company.status}
                </span>
              </div>
              {company.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onApprove(company.id)}
                    className="flex-1 h-11 rounded-xl bg-green-600 text-white text-[14px] font-semibold hover:bg-green-700 transition"
                  >
                    {t('Approve', '通过')}
                  </button>
                  <button
                    onClick={() => onReject(company.id)}
                    className="flex-1 h-11 rounded-xl bg-red-600 text-white text-[14px] font-semibold hover:bg-red-700 transition"
                  >
                    {t('Reject', '拒绝')}
                  </button>
                  <button
                    onClick={() => onEditClick(company.id)}
                    className="h-11 px-4 rounded-xl border border-stone-200 text-[13px] text-stone-600 hover:bg-stone-50 transition"
                  >
                    {t('Edit', '编辑')}
                  </button>
                </div>
              )}
              {company.status !== 'pending' && (
                <button
                  onClick={() => onEditClick(company.id)}
                  className="mt-2 h-10 w-full rounded-xl border border-stone-200 text-[13px] text-stone-600 hover:bg-stone-50 transition"
                >
                  {t('Edit', '编辑')}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Company', '公司')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Contact', '联系人')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Phone', '电话')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('City', '城市')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Type', '类型')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Services', '服务')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Status', '状态')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Display Order', '展示顺序')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                  {t('Actions', '操作')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {company.logo && (
                        <img
                          src={resolveImageUrl(company.logo)}
                          alt={company.name}
                          className="w-8 h-8 mr-3 object-contain"
                        />
                      )}
                      <span className="text-sm font-medium text-slate-900">
                        {company.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {company.contact}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {company.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {company.city}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {{ design_studio: t('Design Studio', '设计工作室'), renovation_company: t('Renovation', '装修公司'), general_contractor: t('Contractor', '总承包商'), mep_contractor: t('MEP', '机电工程'), maintenance_company: t('Maintenance', '维保公司'), specialty_trade: t('Specialty', '专项工程'), landscaping: t('Landscaping', '景观工程'), furnishing: t('Furnishing', '软装公司') }[company.company_type!] || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {company.services.slice(0, 2).map((service, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                        >
                          {service}
                        </span>
                      ))}
                      {company.services.length > 2 && (
                        <span className="px-2 py-1 text-slate-600 text-xs">
                          +{company.services.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        company.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : company.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <input
                      type="number"
                      value={company.displayOrder}
                      onChange={(e) =>
                        onSetDisplayOrder(company.id, parseInt(e.target.value))
                      }
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {company.status === 'pending' && (
                      <>
                        <button
                          onClick={() => onApprove(company.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition"
                        >
                          {t('Approve', '通过')}
                        </button>
                        <button
                          onClick={() => onReject(company.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition"
                        >
                          {t('Reject', '拒绝')}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onEditClick(company.id)}
                      className="px-3 py-1 bg-stone-100 text-stone-700 rounded text-xs font-medium hover:bg-stone-200 transition"
                    >
                      {t('Edit', '编辑')}
                    </button>
                    {!company.linkedUaeCompany && (
                      <button
                        onClick={() => onMergeClick(company)}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition"
                      >
                        {t('Merge', '合并')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
};

export default AdminRoleManagementPage;
