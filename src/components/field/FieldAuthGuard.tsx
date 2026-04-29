import { useAdmin } from '../../contexts/AdminContext';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function FieldAuthGuard({ children }: { children: ReactNode }) {
  const { admin, isLoading, isInstalled } = useAdmin();

  if (isLoading || isInstalled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  // Super admin can also access field survey (for testing)
  if (admin.role !== 'field_staff' && admin.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
