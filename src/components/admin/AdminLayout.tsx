import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Users, UserCog, LogOut, Activity, Building2, ShieldAlert, Mail, CircleHelp, Info, ClipboardList, Package, Tags, Menu, X, MapPin, UserCheck, HandCoins, Images } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { adminApi } from '../../lib/adminApi';
import Avatar from '../ui/Avatar';
import SidebarNavLink from '../ui/SidebarNavLink';
import TarmeerLogo from '../TarmeerLogo';
import ToastContainer from '../ui/Toast';
import { AdminLangContext, type AdminLang } from '../../hooks/useAdminLang';
import AdminGlobalSearch from './AdminGlobalSearch';

const ADMIN_LANG_KEY = 'admin_lang';

const navItems = [
  // ── Core Business ──
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
    to: '/admin/suppliers', labelEn: 'Suppliers', labelZh: '供应商', icon: Package,
    infoEn: 'Manage building material suppliers, review applications, and track supplier leads.',
    infoZh: '管理建材供应商、审核入驻申请、跟踪供应商线索。',
  },
  {
    to: '/admin/inquiries', labelEn: 'Leads', labelZh: '线索', icon: HandCoins,
    infoEn: 'Review customer leads, update follow-up status, and keep conversion notes synchronized.',
    infoZh: '查看客户线索、更新跟进状态，并同步转化备注。',
  },
  {
    to: '/admin/activity-log', labelEn: 'Activity Log', labelZh: '操作记录', icon: ClipboardList, permission: 'can_view_stats' as const,
    infoEn: 'Track all user and admin operations with IP, location, and timestamps.',
    infoZh: '追踪所有用户和管理员的操作记录，含 IP、地区和时间。',
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
    to: '/admin', labelEn: 'Analytics', labelZh: '数据分析', icon: Activity, end: true, permission: 'can_view_stats' as const,
    infoEn: 'Analyze traffic/events, company visitors, compare trends, and jump to external analytics platforms.',
    infoZh: '分析流量与事件趋势、公司访客，并可跳转外部分析平台。',
  },
  {
    to: '/admin/enums', labelEn: 'Types & Services', labelZh: '类型与服务', icon: Tags,
    infoEn: 'Manage company type slugs and service names used in registration and filtering.',
    infoZh: '管理公司类型和服务分类，用于注册表单和筛选器。',
  },
  {
    to: '/admin/visit-records', labelEn: 'Visit Records', labelZh: '访谈记录', icon: MapPin, superAdminOnly: true,
    infoEn: 'View all field visit records submitted by field staff.',
    infoZh: '查看外勤人员提交的所有公司访谈记录。',
  },
  {
    to: '/admin/staff', labelEn: 'Field Staff', labelZh: '外勤人员', icon: UserCheck, superAdminOnly: true,
    infoEn: 'Manage field staff accounts — create, activate, or deactivate.',
    infoZh: '管理外勤账号，包括新建、启用和停用。',
  },
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
  {
    to: '/admin/showcase-images', labelEn: 'Showcase Images', labelZh: '登录页图片', icon: Images,
    infoEn: 'Manage image URLs displayed in the scrolling animation on the login page.',
    infoZh: '管理登录页左侧滚动展示的图片链接。',
  },
  {
    to: '/admin/help', labelEn: 'Help', labelZh: '帮助中心', icon: CircleHelp,
    infoEn: 'Open operation guides, SOPs, troubleshooting steps, and team onboarding documentation.',
    infoZh: '查看操作指南、SOP、故障排查与团队上手文档。',
  },
];

// Map nav paths to todayNew keys (for badge clear on visit)
const TODAY_NEW_PAGE_MAP: Record<string, keyof { homeowners: number; companies: number; suppliers: number }> = {
  '/admin/users': 'homeowners',
  '/admin/companies': 'companies',
  '/admin/suppliers': 'suppliers',
};

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
  const [todayNew, setTodayNew] = useState<{ homeowners: number; companies: number; suppliers: number }>({ homeowners: 0, companies: 0, suppliers: 0 });
  const [lang, setLang] = useState<AdminLang>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_LANG_KEY) : null;
    return saved === 'zh' ? 'zh' : 'en';
  });
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      const [usersRes, companiesRes, homeownerInqRes, companyInqRes, todayRes] = await Promise.all([
        adminApi.getUsers({ page: 1, limit: 1 }),
        adminApi.getRegisteredCompanies({ page: 1, limit: 1 }),
        adminApi.getInquiries({ page: 1, limit: 1, type: 'homeowner' }),
        adminApi.getInquiries({ page: 1, limit: 1, type: 'company' }),
        adminApi.request('/stats/today-new').catch(() => null),
      ]);
      setMenuCounts({
        '/admin/users': usersRes?.pagination?.total ?? 0,
        '/admin/companies': companiesRes?.total ?? companiesRes?.pagination?.total ?? 0,
        '/admin/inquiries': (homeownerInqRes?.pagination?.total ?? 0) + (companyInqRes?.pagination?.total ?? 0),
      });
      if (todayRes) {
        setTodayNew({
          homeowners: todayRes.homeowners ?? 0,
          companies: todayRes.companies ?? 0,
          suppliers: todayRes.suppliers ?? 0,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotificationCounts();
    fetchMenuCounts();
    const interval = setInterval(fetchNotificationCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchNotificationCounts, fetchMenuCounts]);

  // Close sidebar on navigation (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

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
    // Clear todayNew badge for this page
    const todayNewKey = TODAY_NEW_PAGE_MAP[location.pathname] ??
      (Object.entries(TODAY_NEW_PAGE_MAP).find(([p]) => location.pathname.startsWith(p))?.[1] as keyof typeof todayNew | undefined);
    if (todayNewKey) {
      setTodayNew(prev => ({ ...prev, [todayNewKey]: 0 }));
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
    (!('superAdminOnly' in item) || !item.superAdminOnly || isSuperAdmin) &&
    (!('permission' in item) || !item.permission || hasPermission(item.permission))
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
    <div className="h-screen bg-[#faf9f7] flex flex-col overflow-hidden">
      {/* Top header */}
      <header className="h-14 md:h-16 bg-white border-b border-stone-200 flex items-center px-4 md:grid md:grid-cols-[16rem_1fr_16rem] md:px-6 sticky top-0 z-30 shrink-0 gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-stone-100 transition shrink-0"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label="Menu"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <TarmeerLogo />
        <div className="hidden md:flex justify-center">
          <AdminGlobalSearch />
        </div>
        <div className="hidden md:block" />
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-14 md:top-0 z-40 md:z-auto
        h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)]
        w-64 bg-white border-r border-stone-200 flex flex-col overflow-visible
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Navigation - active: left border + light bg like designer */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-visible">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const notifKey = NOTIFICATION_MAP[item.to];
            const hasNotif = notifKey && (notifCounts[notifKey] ?? 0) > 0;
            const todayCount =
              item.to === '/admin/users' ? todayNew.homeowners :
              item.to === '/admin/companies' ? todayNew.companies :
              item.to === '/admin/suppliers' ? todayNew.suppliers : 0;
            return (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? Boolean(item.end) : undefined}
                className="relative group"
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex items-center gap-1.5">
                  <span>{t(item.labelEn, item.labelZh)}</span>
                  {menuCounts[item.to] != null && menuCounts[item.to] > 0 && (
                    <span className="text-[11px] text-stone-400 font-normal">{menuCounts[item.to]}</span>
                  )}
                  {todayCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#b8864a] text-white leading-none">
                      +{todayCount}
                    </span>
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
                    end={'end' in item ? Boolean(item.end) : undefined}
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
      <main className="flex-1 overflow-auto w-full md:ml-0 [scrollbar-gutter:stable]">
        <AdminLangContext.Provider value={{ lang, t }}>
          <div className="w-full p-4 md:p-6">
            <Outlet />
          </div>
        </AdminLangContext.Provider>
      </main>
      </div>
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
