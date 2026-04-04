import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, LogOut, Activity, Building2, MessageSquare, ShieldAlert, Mail, FileUp, CircleHelp, Info } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { adminApi } from '../../lib/adminApi';
import Avatar from '../ui/Avatar';
import SidebarNavLink from '../ui/SidebarNavLink';

const PRIMARY = '#b8864a';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, info: 'View platform overview, key KPIs, and quick status summary.' },
  { to: '/admin/users', label: 'Users', icon: Users, info: 'Manage user accounts, status, and role-related records.' },
  { to: '/admin/companies', label: 'Companies', icon: Building2, info: 'Manage Companies / Directory / Applications, including review and sorting.' },
  { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare, info: 'Review customer inquiry leads and update follow-up status/notes.' },
  { to: '/admin/complaints', label: 'Complaints', icon: ShieldAlert, info: 'Process abuse/report tickets and resolve complaint workflows.' },
  { to: '/admin/company-import', label: 'Import Company', icon: FileUp, info: 'Bulk import company data from template files.' },
  { to: '/admin/notification-emails', label: 'Notify Emails', icon: Mail, info: 'Configure notification recipients for system events.' },
  { to: '/admin/help', label: 'Help', icon: CircleHelp, info: 'Open operation guides, troubleshooting steps, and usage docs.' },
  { to: '/admin/analytics', label: 'Analytics', icon: Activity, permission: 'can_view_stats' as const, info: 'View traffic/events analytics and trend reports.' },
];

const adminItems = [
  { to: '/admin/admins', label: 'Admin Users', icon: UserCog, superAdminOnly: true, info: 'Manage administrator accounts, permissions, and access control.' },
];

// Map nav paths to notification keys
const NOTIFICATION_MAP: Record<string, string> = {
  '/admin/complaints': 'newComplaints',
};

export default function AdminLayout() {
  const { admin, logout, hasPermission, isSuperAdmin, isLoading } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifCounts, setNotifCounts] = useState<Record<string, number>>({});

  const fetchNotificationCounts = useCallback(async () => {
    try {
      const data = await adminApi.getNotificationCounts();
      setNotifCounts(data);
    } catch {
      // Silently ignore notification count errors
    }
  }, []);

  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchNotificationCounts]);

  // Refresh counts on navigation
  useEffect(() => {
    fetchNotificationCounts();
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

  return (
    <div className="min-h-screen bg-[#faf9f7] flex">
      {/* Sidebar - match DesignerLayout style */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Logo - match designer: icon in rounded box + title */}
        <Link to="/" className="h-16 flex items-center px-6 border-b border-stone-200 hover:bg-stone-50 transition-colors">
          <div
            className="size-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${PRIMARY}20` }}
          >
            <img src="/images/tarmeer_logo.svg" alt="" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <span className="ml-3 text-lg font-bold text-[#2c2c2c] flex-1">TARMEER</span>
        </Link>

        {/* Navigation - active: left border + light bg like designer */}
        <nav className="flex-1 p-4 space-y-1">
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
                  <span>{item.label}</span>
                  <span className="relative inline-flex items-center">
                    <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-500" />
                    <span className="pointer-events-none absolute left-5 top-1/2 z-20 hidden w-64 -translate-y-1/2 rounded-md border border-stone-200 bg-white p-2 text-xs leading-relaxed text-stone-600 shadow-lg group-hover:block">
                      {item.info}
                    </span>
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
                  Administration
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
                      <span>{item.label}</span>
                      <span className="relative inline-flex items-center">
                        <Info className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-500" />
                        <span className="pointer-events-none absolute left-5 top-1/2 z-20 hidden w-64 -translate-y-1/2 rounded-md border border-stone-200 bg-white p-2 text-xs leading-relaxed text-stone-600 shadow-lg group-hover:block">
                          {item.info}
                        </span>
                      </span>
                    </span>
                  </SidebarNavLink>
                );
              })}
            </>
          )}
        </nav>

        {/* User info - match designer: Avatar + Back to Home / Log out */}
        <div className="p-4 border-t border-stone-200">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={admin.fullName} size="md" />
            <div>
              <p className="text-sm font-medium text-[#2c2c2c]">{admin.fullName}</p>
              <p className="text-xs text-stone-500">
                {admin.role === 'super_admin' ? 'Super Admin' : 'Sub Admin'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b8864a]/40"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content - same padding as designer */}
      <main className="flex-1 overflow-auto p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
