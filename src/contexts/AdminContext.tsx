import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { adminApi, AdminUser } from '../lib/adminApi';

interface AdminContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  isInstalled: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  install: (email: string, password: string, fullName: string) => Promise<void>;
  checkInstallation: () => Promise<void>;
  hasPermission: (permission: 'can_approve' | 'can_sort' | 'can_view_stats') => boolean;
  isSuperAdmin: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);

  const checkInstallation = useCallback(async () => {
    try {
      const result = await adminApi.checkInstallation();
      setIsInstalled(result.installed);
    } catch (error) {
      console.error('Error checking installation:', error);
      setIsInstalled(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!adminApi.getToken()) {
      setIsLoading(false);
      return;
    }

    try {
      const profile = await adminApi.getProfile();
      setAdmin({
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role as AdminUser['role'],
        permissions: profile.permissions,
      });
    } catch (error) {
      console.error('Error loading admin profile:', error);
      adminApi.clearToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      // Check installation first, then load profile
      // This prevents race conditions between the two async operations
      await checkInstallation();
      await loadProfile();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  const login = async (email: string, password: string) => {
    const result = await adminApi.login(email, password);
    setAdmin({
      id: result.admin.id,
      email: result.admin.email,
      fullName: result.admin.fullName,
      role: result.admin.role as AdminUser['role'],
      permissions: result.admin.permissions,
    });
  };

  const logout = () => {
    adminApi.logout();
    setAdmin(null);
  };

  const install = async (email: string, password: string, fullName: string) => {
    const result = await adminApi.install({ email, password, fullName });
    setAdmin({
      id: result.admin.id,
      email: result.admin.email,
      fullName: result.admin.fullName,
      role: result.admin.role as AdminUser['role'],
      permissions: null,
    });
    setIsInstalled(true);
  };

  const hasPermission = useCallback(
    (permission: 'can_approve' | 'can_sort' | 'can_view_stats') => {
      if (!admin) return false;
      if (admin.role === 'super_admin') return true;
      return admin.permissions?.[permission] === true;
    },
    [admin]
  );

  const isSuperAdmin = admin?.role === 'super_admin';

  return (
    <AdminContext.Provider
      value={{
        admin,
        isLoading,
        isInstalled,
        login,
        logout,
        install,
        checkInstallation,
        hasPermission,
        isSuperAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
