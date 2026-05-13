import { useState, useEffect } from 'react';
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Building2, FolderOpen, FileText, User, ImagePlus, Settings, MessageSquare, ExternalLink } from 'lucide-react';
import Navbar from '../Navbar';
import PhoneRequiredModal from '../PhoneRequiredModal';
import { safeRemoveItem } from '../../lib/storage';
import FeedbackModal from '../FeedbackModal';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer ${
    isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
  }`;

export default function CompanyLayout() {
  const navigate = useNavigate();
  const token = api.getToken();
  const [authValid, setAuthValid] = useState<boolean | null>(token ? null : false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [crmOpening, setCrmOpening] = useState(false);

  useEffect(() => {
    if (!token) {
      setAuthValid(false);
      return;
    }

    let mounted = true;
    api.get('/auth/me')
      .then(() => {
        if (!mounted) return;
        setAuthValid(true);
        // 拿公司名和类型用于反馈标识
        api.get('/auth/company/profile').then((res: any) => {
          if (!mounted) return;
          setCompanyName(res?.company_name || '');
          setCompanyType(res?.company_type || '');
          setCrmEnabled(!!res?.crm_tenant_id);
        }).catch(() => {});
      })
      .catch(() => {
        if (!mounted) return;
        api.clearToken();
        safeRemoveItem('user');
        safeRemoveItem('active_role');
        setAuthValid(false);
        navigate('/auth', { replace: true });
      });

    return () => { mounted = false; };
  }, [token, navigate]);

  const handleOpenCrm = async () => {
    if (crmOpening) return;
    setCrmOpening(true);
    try {
      const res: any = await api.post('/auth/company/crm-sso', {});
      if (res?.consumeUrl) window.open(res.consumeUrl, '_blank');
    } catch { } finally { setCrmOpening(false); }
  };

  if (!token) return <Navigate to="/auth" replace />;
  if (authValid !== true) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Checking session...</div>;
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <PhoneRequiredModal blocking />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 sm:top-16 bottom-0 left-0 z-10 overflow-y-auto">
          <div className="p-6">
            <nav className="flex flex-col gap-1">
              <NavLink to="/company/dashboard" end className={navCls}>
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </NavLink>
              <NavLink to="/company/projects" className={navCls}>
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </NavLink>
              <NavLink to="/company/articles" className={navCls}>
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">Articles</span>
              </NavLink>
              <NavLink to="/company/profile" className={navCls}>
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </NavLink>
              <NavLink to="/company/settings" className={navCls}>
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </NavLink>
              {crmEnabled && (
                <button onClick={handleOpenCrm} disabled={crmOpening} className={navCls({ isActive: false }) + ' w-full text-left'}>
                  <ExternalLink className="w-5 h-5" />
                  <span className="text-sm font-medium">{crmOpening ? 'Opening…' : 'Open CRM'}</span>
                </button>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto md:ml-64 pb-20 md:pb-0 [scrollbar-gutter:stable]">
          <div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Feedback bubble — fixed bottom-right, above mobile nav */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-20 w-14 rounded-2xl bg-[#1c1917] text-white shadow-lg hover:bg-[#2c2c2c] transition flex flex-col items-center justify-center gap-1 py-2.5"
        aria-label="Send feedback"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] font-medium leading-none">Feedback</span>
      </button>
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        source="company_portal"
        companyName={companyName}
        companyType={companyType}
      />

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex items-center justify-around px-2 py-2 safe-area-pb">
        <NavLink to="/company/dashboard" end className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <Building2 className="w-5 h-5" />
          Dashboard
        </NavLink>
        <NavLink to="/company/projects" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <FolderOpen className="w-5 h-5" />
          Projects
        </NavLink>
        <NavLink to="/company/upload" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <ImagePlus className="w-5 h-5" />
          Upload
        </NavLink>
        <NavLink to="/company/profile" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
          <User className="w-5 h-5" />
          Profile
        </NavLink>
        {crmEnabled && (
          <button onClick={handleOpenCrm} disabled={crmOpening} className="flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] text-stone-500 disabled:opacity-50">
            <ExternalLink className="w-5 h-5" />
            CRM
          </button>
        )}
      </nav>
    </div>
  );
}
