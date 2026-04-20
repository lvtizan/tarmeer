import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Users, UserCog, LogOut, Activity, Building2, MessageSquare, ShieldAlert, Mail, FileUp, CircleHelp, Info, ClipboardList, Search, X } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { adminApi } from '../../lib/adminApi';
import Avatar from '../ui/Avatar';
import SidebarNavLink from '../ui/SidebarNavLink';
import TarmeerLogo from '../TarmeerLogo';
import ToastContainer from '../ui/Toast';
import { AdminLangContext, type AdminLang } from '../../hooks/useAdminLang';

const ADMIN_LANG_KEY = 'admin_lang';

const navItems = [
  // ── Core Business ──
  {
    to: '/admin', labelEn: 'Analytics', labelZh: '数据分析', icon: Activity, end: true, permission: 'can_view_stats' as const,
    infoEn: 'Analyze traffic/events, company visitors, compare trends, and jump to external analytics platforms.',
    infoZh: '分析流量与事件趋势、公司访客，并可跳转外部分析平台。',
  },
  {
    to: '/admin/users', labelEn: 'Homeowners', labelZh: '业主', icon: Users,
    infoEn: 'Manage homeowner accounts, role/status changes, and trace account-level operations.',
    infoZh: '管理业主账号、角色与状态变更，并追踪账号操作记录。',
  },
  {
    to: '/admin/companies', labelEn: 'Companies', labelZh: '装企', icon: Building2,
    infoEn: 'Manage Companies / Directory / Applications, including approval, sorting, and profile maintenance.',
    infoZh: '管理装企 / 目录 / 申请，包含审批、排序与资料维护。',
  },
  {
    to: '/admin/inquiries', labelEn: 'Inquiries', labelZh: '询盘', icon: MessageSquare,
    infoEn: 'Review customer leads, update follow-up status, and keep conversion notes synchronized.',
    infoZh: '查看客户询盘、更新跟进状态，并同步转化备注。',
  },
  {
    to: '/admin/activity-log', labelEn: 'Activity Log', labelZh: '操作记录', icon: ClipboardList, permission: 'can_view_stats' as const,
    infoEn: 'Track all user and admin operations with IP, location, and timestamps.',
    infoZh: '追踪所有用户和管理员的操作记录，含 IP、地区和时间。',
  },
  // ── Tools ──
  {
    to: '/admin/help', labelEn: 'Help', labelZh: '帮助中心', icon: CircleHelp,
    infoEn: 'Open operation guides, SOPs, troubleshooting steps, and team onboarding documentation.',
    infoZh: '查看操作指南、SOP、故障排查与团队上手文档。',
  },
  {
    to: '/admin/company-import', labelEn: 'Import Company', labelZh: '导入公司', icon: FileUp,
    infoEn: 'Bulk import company records from templates and validate key fields before publishing.',
    infoZh: '通过模板批量导入公司信息，发布前校验关键字段。',
  },
  // ── Other ──
  {
    to: '/admin/complaints', labelEn: 'Complaints', labelZh: '投诉', icon: ShieldAlert,
    infoEn: 'Handle abuse/report tickets, complete investigation notes, and close complaint workflows.',
    infoZh: '处理举报/投诉工单，补全调查记录并完成闭环。',
  },
];

const adminItems = [
  {
    to: '/admin/admins', labelEn: 'Admin Users', labelZh: '管理员', icon: UserCog, superAdminOnly: true,
    infoEn: 'Manage administrator accounts, permissions, and privileged access boundaries.',
    infoZh: '管理管理员账号、权限与高权限访问边界。',
  },
  {
    to: '/admin/notification-emails', labelEn: 'Notify Emails', labelZh: '通知邮箱', icon: Mail, superAdminOnly: true,
    infoEn: 'Configure recipients for system notifications to ensure operational events are delivered.',
    infoZh: '配置系统通知接收邮箱，确保运营事件及时送达。',
  },
];

// Map nav paths to notification keys
const NOTIFICATION_MAP: Record<string, string> = {
  '/admin/complaints': 'newComplaints',
  '/admin/inquiries': 'newInquiries',
  '/admin/companies': 'newCompanyApps',
  '/admin/users': 'newUsers',
};

export default function AdminLayout() {
  const { admin, logout, hasPermission, isSuperAdmin, isLoading } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifCounts, setNotifCounts] = useState<Record<string, number>>({});
  const [menuCounts, setMenuCounts] = useState<Record<string, number>>({});
  const [lang, setLang] = useState<AdminLang>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_LANG_KEY) : null;
    return saved === 'zh' ? 'zh' : 'en';
  });
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);

  // Global search
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<{ users: any[]; companies: any[]; inquiries: any[] } | null>(null);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);
  const globalRef = useRef<HTMLDivElement>(null);
  const globalDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!globalQuery.trim()) { setGlobalResults(null); setGlobalOpen(false); return; }
    setGlobalSearching(true);
    clearTimeout(globalDebounce.current);
    globalDebounce.current = setTimeout(async () => {
      try {
        const q = globalQuery.trim();
        const [usersRes, companiesRes, inquiriesRes] = await Promise.all([
          adminApi.getUsers({ page: 1, limit: 5, search: q }),
          adminApi.getRegisteredCompanies({ page: 1, limit: 5, search: q }),
          adminApi.getInquiries({ page: 1, limit: 5, search: q }),
        ]);
        setGlobalResults({
          users: usersRes?.users || [],
          companies: companiesRes?.companies || [],
          inquiries: inquiriesRes?.inquiries || [],
        });
        setGlobalOpen(true);
      } catch { setGlobalResults(null); }
      setGlobalSearching(false);
    }, 300);
    return () => clearTimeout(globalDebounce.current);
  }, [globalQuery]);

  // Cmd+K to open, ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalOpen(true);
      }
      if (e.key === 'Escape' && globalOpen) {
        setGlobalOpen(false);
        setGlobalQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [globalOpen]);

  const fetchNotificationCounts = useCallback(async () => {
    try {
      const data = await adminApi.getNotificationCounts();
      setNotifCounts(data);
    } catch {
      // Silently ignore notification count errors
    }
  }, []);

  const fetchMenuCounts = useCallback(async () => {
    try {
      const [usersRes, companiesRes, homeownerInqRes, companyInqRes] = await Promise.all([
        adminApi.getUsers({ page: 1, limit: 1 }),
        adminApi.getRegisteredCompanies({ page: 1, limit: 1 }),
        adminApi.getInquiries({ page: 1, limit: 1, type: 'homeowner' }),
        adminApi.getInquiries({ page: 1, limit: 1, type: 'company' }),
      ]);
      setMenuCounts({
        '/admin/users': usersRes?.pagination?.total ?? 0,
        '/admin/companies': companiesRes?.total ?? companiesRes?.pagination?.total ?? 0,
        '/admin/inquiries': (homeownerInqRes?.pagination?.total ?? 0) + (companyInqRes?.pagination?.total ?? 0),
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotificationCounts();
    fetchMenuCounts();
    const interval = setInterval(fetchNotificationCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchNotificationCounts, fetchMenuCounts]);

  // Mark notifications seen when visiting a page, then refresh counts
  useEffect(() => {
    const notifKey = NOTIFICATION_MAP[location.pathname] ||
      Object.entries(NOTIFICATION_MAP).find(([p]) => location.pathname.startsWith(p))?.[1];
    if (notifKey) {
      const pageKeyMap: Record<string, string> = {
        newComplaints: 'complaints',
        newInquiries: 'inquiries',
        newCompanyApps: 'companies',
        newUsers: 'users',
      };
      const pageKey = pageKeyMap[notifKey];
      if (pageKey) {
        adminApi.markNotificationSeen(pageKey).then(() => fetchNotificationCounts()).catch(() => {});
      } else {
        fetchNotificationCounts();
      }
    } else {
      fetchNotificationCounts();
    }
  }, [location.pathname, fetchNotificationCounts]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    navigate('/admin/login');
    return null;
  }

  const filteredNavItems = navItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  const filteredAdminItems = adminItems.filter(item => 
    !item.superAdminOnly || isSuperAdmin
  );

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);
  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'zh' : 'en';
      if (typeof window !== 'undefined') window.localStorage.setItem(ADMIN_LANG_KEY, next);
      return next;
    });
  };
  const showTooltip = (event: any, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      top: Math.round(rect.top + rect.height / 2),
      left: Math.round(rect.right + 12),
    });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <div className="min-h-screen bg-[#faf9f7] flex">
      {/* Sidebar - match DesignerLayout style */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen overflow-visible">
        {/* Logo */}
        <div className="h-16 flex items-center px-6">
          <TarmeerLogo />
        </div>

        {/* Navigation - active: left border + light bg like designer */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-visible">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const notifKey = NOTIFICATION_MAP[item.to];
            const hasNotif = notifKey && (notifCounts[notifKey] ?? 0) > 0;
            return (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="relative group"
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex items-center gap-1.5">
                  <span>{t(item.labelEn, item.labelZh)}</span>
                  {menuCounts[item.to] != null && menuCounts[item.to] > 0 && (
                    <span className="text-[11px] text-stone-400 font-normal">{menuCounts[item.to]}</span>
                  )}
                  <span
                    className="relative inline-flex items-center"
                    onMouseEnter={(e) => showTooltip(e, t(item.infoEn, item.infoZh))}
                    onMouseLeave={hideTooltip}
                  >
                    <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-500" />
                  </span>
                </span>
                {hasNotif && (
                  <span className="absolute top-2 left-7 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </SidebarNavLink>
            );
          })}

          {filteredAdminItems.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <span className="px-4 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  {t('Administration', '系统管理')}
                </span>
              </div>
              {filteredAdminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarNavLink
                    key={item.to}
                    to={item.to}
                    className="relative group"
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="flex items-center gap-1.5">
                        <span>{t(item.labelEn, item.labelZh)}</span>
                      <span
                        className="relative inline-flex items-center"
                        onMouseEnter={(e) => showTooltip(e, t(item.infoEn, item.infoZh))}
                        onMouseLeave={hideTooltip}
                      >
                        <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-500" />
                      </span>
                    </span>
                  </SidebarNavLink>
                );
              })}
            </>
          )}
        </nav>

        {/* User info - match designer: Avatar + Back to Home / Log out */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={admin.fullName} size="md" />
            <div>
              <p className="text-sm font-medium text-[#2c2c2c]">{admin.fullName}</p>
              <p className="text-xs text-stone-500">
                {admin.role === 'super_admin' ? t('Super Admin', '超级管理员') : t('Sub Admin', '子管理员')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="mb-2 flex items-center justify-between w-full px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <span>{t('Language', '语言')}</span>
            <span>{lang === 'en' ? 'EN / 中文' : '中文 / EN'}</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]/40"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {t('Sign out', '退出登录')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <AdminLangContext.Provider value={{ lang, t }}>
          {/* Gmail-style top search bar */}
          <div className="sticky top-0 z-30 bg-[#faf9f7] px-6 md:px-10 py-4 flex justify-center">
            <div ref={globalRef} className="relative w-full max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onFocus={() => { if (globalResults) setGlobalOpen(true); }}
                placeholder={t('Search homeowners, companies, inquiries...', '搜索业主、装企、询盘...')}
                className="h-11 w-full pl-11 pr-10 rounded-2xl border border-stone-200 bg-white text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] shadow-sm"
              />
              {globalQuery && (
                <button onClick={() => { setGlobalQuery(''); setGlobalResults(null); setGlobalOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Dropdown results */}
              {globalOpen && globalQuery && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto z-50">
                  {globalSearching && <div className="p-4 text-sm text-stone-400 text-center">{t('Searching...', '搜索中...')}</div>}

                  {!globalSearching && globalResults && globalResults.users.length === 0 && globalResults.companies.length === 0 && globalResults.inquiries.length === 0 && (
                    <div className="p-6 text-sm text-stone-400 text-center">{t('No results found', '未找到结果')}</div>
                  )}

                  {globalResults?.users && globalResults.users.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider bg-stone-50/80 border-b border-stone-100">{t('Homeowners', '业主')}</div>
                      {globalResults.users.map((u: any) => (
                        <button key={`u-${u.id}`} onClick={() => { navigate(`/admin/users/${u.id}`); setGlobalOpen(false); setGlobalQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-[#b8864a]/5 flex items-center gap-3 text-sm border-b border-stone-50 transition">
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0">{(u.full_name || u.email || '?')[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[#1c1917] truncate">{u.full_name || 'Unnamed'}</div>
                            <div className="text-stone-400 text-xs truncate">{u.email} · {u.phone || ''}</div>
                          </div>
                          <span className="text-xs text-stone-300 shrink-0">{u.role || 'homeowner'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {globalResults?.companies && globalResults.companies.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider bg-stone-50/80 border-b border-stone-100">{t('Companies', '装企')}</div>
                      {globalResults.companies.map((c: any) => (
                        <button key={`c-${c.id}`} onClick={() => { navigate(`/admin/profile-companies/${c.id}?tab=companies`); setGlobalOpen(false); setGlobalQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-[#b8864a]/5 flex items-center gap-3 text-sm border-b border-stone-50 transition">
                          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-xs font-bold text-[#b8864a] shrink-0">{(c.company_name || '?')[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[#1c1917] truncate">{c.company_name || 'Unnamed'}</div>
                            <div className="text-stone-400 text-xs truncate">{c.user_email} · {c.city || ''} · {c.signup_source || ''}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(c.project_count ?? 0) > 0 && <span className="text-xs text-stone-400">{c.project_count} {t('projects', '项目')}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : c.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>{c.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {globalResults?.inquiries && globalResults.inquiries.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider bg-stone-50/80 border-b border-stone-100">{t('Inquiries', '询盘')}</div>
                      {globalResults.inquiries.map((inq: any) => (
                        <button key={`i-${inq.id}`} onClick={() => { navigate('/admin/inquiries'); setGlobalOpen(false); setGlobalQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-[#b8864a]/5 flex items-center gap-3 text-sm border-b border-stone-50 transition">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-500 shrink-0">{(inq.name || inq.contact_name || '?')[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[#1c1917] truncate">{inq.name || inq.contact_name || 'Anonymous'}</div>
                            <div className="text-stone-400 text-xs truncate">{inq.phone || ''} · {inq.city || ''} · {inq.area_range ? inq.area_range + 'm²' : ''}</div>
                          </div>
                          <span className="text-xs text-stone-300 shrink-0">{inq.source || inq.type || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-full p-6 md:p-10">
            <Outlet />
          </div>
        </AdminLangContext.Provider>
      </main>
      <ToastContainer />
      {tooltip && (
        <div
          className="pointer-events-none fixed z-[9999] w-80 -translate-y-1/2 rounded-md border border-stone-200 bg-white p-3 text-sm leading-relaxed text-stone-700 shadow-xl"
          style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
