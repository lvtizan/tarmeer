import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart2, UserCog, LogOut, Globe, Activity, Building2, MessageSquare, Palette, ShieldAlert, Mail, FileUp } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { adminApi } from '../../lib/adminApi';
import Avatar from '../ui/Avatar';
import NotificationBell from '../NotificationBell';

const PRIMARY = '#b8864a';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/roles', label: 'Approvals', icon: Palette, permission: 'can_approve' as const },
  { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
  { to: '/admin/complaints', label: 'Complaints', icon: ShieldAlert },
  { to: '/admin/company-import', label: 'Import Company', icon: FileUp },
  { to: '/admin/notification-emails', label: 'Notify Emails', icon: Mail },
  { to: '/admin/visitors', label: 'Visitors', icon: Globe, permission: 'can_view_stats' as const },
  { to: '/admin/analytics', label: 'Analytics', icon: Activity, permission: 'can_view_stats' as const },
  { to: '/admin/stats', label: 'Statistics', icon: BarChart2, permission: 'can_view_stats' as const },
];

const adminItems = [
  { to: '/admin/admins', label: 'Admin Users', icon: UserCog, superAdminOnly: true },
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
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        {/* Logo - match designer: icon in rounded box + title */}
        <div className="h-16 flex items-center px-6 border-b border-stone-200">
          <div
            className="size-8 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${PRIMARY}20` }}
          >
            <LayoutDashboard className="w-5 h-5" style={{ color: PRIMARY }} />
          </div>
          <span className="ml-3 text-lg font-bold text-[#2c2c2c] flex-1">Tarmeer Admin</span>
          <NotificationBell />
        </div>

        {/* Navigation - active: left border + light bg like designer */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const notifKey = NOTIFICATION_MAP[item.to];
            const hasNotif = notifKey && (notifCounts[notifKey] ?? 0) > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]'
                      : 'text-stone-600 hover:bg-stone-50'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
                {hasNotif && (
                  <span className="absolute top-2 left-7 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </NavLink>
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
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {item.label}
                  </NavLink>
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
