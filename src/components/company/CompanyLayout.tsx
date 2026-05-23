import { useState, useEffect } from 'react';
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Building2, FolderOpen, FileText, User, ImagePlus, Settings, MessageSquare, ExternalLink, ArrowRightLeft, LogOut, Inbox } from 'lucide-react';
import TarmeerLogo from '../TarmeerLogo';
import PhoneRequiredModal from '../PhoneRequiredModal';
import { safeRemoveItem } from '../../lib/storage';
import FeedbackModal from '../FeedbackModal';

interface LinkedPortal { type: string; label: string; url: string; }

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
  const [linkedPortals, setLinkedPortals] = useState<LinkedPortal[]>([]);
  const [switchingPortal, setSwitchingPortal] = useState('');
  const [newLeadsCount, setNewLeadsCount] = useState(0);

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
          const p = res?.profile ?? res;
          setCompanyName(p?.company_name || '');
          setCompanyType(p?.company_type || '');
          setCrmEnabled(!!p?.crm_tenant_id);
        }).catch(() => {});
        // 拿关联入口（admin / supplier portal）
        api.get('/auth/linked-portals').then((res: any) => {
          if (!mounted) return;
          setLinkedPortals(res?.portals || []);
        }).catch(() => {});
        // 拿未读线索数
        api.request('/inquiries/mine?limit=100').then((data: any) => {
          if (!mounted) return;
          const arr: any[] = Array.isArray(data?.inquiries) ? data.inquiries : [];
          setNewLeadsCount(arr.filter((i: any) => i.status === 'new').length);
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

  const handleLogout = () => {
    api.clearToken();
    safeRemoveItem('user');
    safeRemoveItem('active_role');
    navigate('/auth');
  };

  const handleSwitchPortal = async (portal: LinkedPortal) => {
    if (switchingPortal) return;
    setSwitchingPortal(portal.type);
    try {
      const res: any = await api.post('/auth/cross-portal-token', { target: portal.type });
      if (res?.token) {
        const keyMap: Record<string, string> = { company: 'token', supplier: 'supplier_token', admin: 'admin_token' };
        localStorage.setItem(keyMap[portal.type] || portal.type, res.token);
        window.location.href = res.redirectUrl || portal.url;
      }
    } catch { } finally { setSwitchingPortal(''); }
  };

  const handleOpenCrm = async () => {
    const win = window.open('', '_blank');
    try {
      const res: any = await api.post('/auth/company/crm-sso', {});
      if (res?.consumeUrl && win) win.location.href = res.consumeUrl;
      else win?.close();
    } catch {
      win?.close();
    }
  };

  if (!token) return <Navigate to="/auth" replace />;
  if (authValid !== true) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Checking session...</div>;
  }

  return (
    <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
      <PhoneRequiredModal blocking />
      {/* Portal header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 justify-between shrink-0">
        <TarmeerLogo className="h-6" />
        <div className="flex items-center gap-3">
          {companyName && <span className="text-sm font-medium text-[#2c2c2c] hidden sm:block">{companyName}</span>}
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 transition p-1" title="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-14 bottom-0 left-0 z-10 overflow-y-auto">
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
              <NavLink to="/company/leads" className={navCls}>
                <Inbox className="w-5 h-5" />
                <span className="text-sm font-medium">Leads</span>
                {newLeadsCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                    {newLeadsCount > 9 ? '9+' : newLeadsCount}
                  </span>
                )}
              </NavLink>
              {crmEnabled && (
                <button onClick={handleOpenCrm} className="flex items-center gap-3 px-4 py-3 rounded-full transition w-full text-left bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">
                  <ExternalLink className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">Open CRM</span>
                </button>
              )}
              {linkedPortals.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-[11px] text-stone-400 px-4 mb-1">切换身份</p>
                  {linkedPortals.map(p => (
                    <button
                      key={p.type}
                      onClick={() => handleSwitchPortal(p)}
                      disabled={!!switchingPortal}
                      className="flex items-center gap-2 px-4 py-2 rounded-full w-full text-left text-[13px] text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>{switchingPortal === p.type ? '跳转中…' : p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto md:ml-64 pb-20 md:pb-0 [scrollbar-gutter:stable]">
          <div className="p-4 sm:p-6 lg:p-6">
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
        <div className="relative">
          <NavLink to="/company/leads" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
            <Inbox className="w-5 h-5" />
            Leads
          </NavLink>
          {newLeadsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
              {newLeadsCount > 9 ? '9+' : newLeadsCount}
            </span>
          )}
        </div>
        {crmEnabled && (
          <button onClick={handleOpenCrm} className="flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] text-violet-600 font-medium">
            <ExternalLink className="w-5 h-5" />
            CRM
          </button>
        )}
      </nav>
    </div>
  );
}
