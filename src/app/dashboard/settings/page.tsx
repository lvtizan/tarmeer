'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { safeRemoveItem } from '@/lib/storage';
import { SettingsSection, SettingsRow } from '@/components/portal/SettingsCard';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';

export default function DashboardSettingsPage() {
  const router = useRouter();
  const tp = useSiteLocale().tr.portal;
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
        <h1 className="text-xl font-bold text-[#2c2c2c]">{tp.settings}</h1>
        <p className="mt-0.5 text-sm text-stone-500">{tp.manageAccount}</p>
      </div>

      <SettingsSection title={tp.account}>
        <SettingsRow
          icon={<ShieldCheck className="w-4 h-4" />}
          title={tp.profile}
          desc={tp.updateNamePhoneCity}
          actionLabel={tp.editProfileArrow}
          onAction={() => router.push('/dashboard/profile')}
          divider
        />
        <SettingsRow
          icon={<LogOut className="w-4 h-4" />}
          title={tp.signOut}
          desc={tp.signOutDesc}
          actionLabel={loggingOut ? tp.signingOut : tp.signOut}
          onAction={handleLogout}
          disabled={loggingOut}
        />
      </SettingsSection>
    </div>
  );
}
