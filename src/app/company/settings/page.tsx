'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { safeRemoveItem } from '@/lib/storage';
import { SettingsSection, SettingsRow } from '@/components/portal/SettingsCard';

export default function CompanySettingsPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout', {});
    } catch { /* ignore */ }
    api.clearToken();
    safeRemoveItem('user');
    safeRemoveItem('active_role');
    router.push('/auth');
  };

  return (
    <div className="w-full max-w-[640px] mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#2c2c2c]">Settings</h1>
        <p className="mt-0.5 text-sm text-stone-500">Manage your account preferences.</p>
      </div>

      <SettingsSection title="Account">
        <SettingsRow
          icon={<ShieldCheck className="w-4 h-4" />}
          title="Company Profile"
          desc="Update company info, services & contact"
          actionLabel="Edit Profile →"
          onAction={() => router.push('/company/profile')}
          divider
        />
        <SettingsRow
          icon={<LogOut className="w-4 h-4" />}
          title="Sign Out"
          desc="Sign out of your account on this device"
          actionLabel={loggingOut ? 'Signing out…' : 'Sign Out'}
          onAction={handleLogout}
          disabled={loggingOut}
        />
      </SettingsSection>
    </div>
  );
}
