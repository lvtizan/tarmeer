'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { safeRemoveItem } from '@/lib/storage';

export default function DashboardSettingsPage() {
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
    <div className="mx-auto max-w-[640px] space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#2c2c2c]">Settings</h1>
        <p className="mt-0.5 text-sm text-stone-500">Manage your account preferences.</p>
      </div>

      {/* Account */}
      <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Account</h2>

        <div className="space-y-3">
          {/* Change password — link to profile */}
          <div className="flex items-center justify-between py-3 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              <div>
                <p className="text-sm font-medium text-[#2c2c2c]">Password</p>
                <p className="text-xs text-stone-400">Update your account password</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/profile')}
              className="text-xs font-semibold text-[#b8864a] hover:underline"
            >
              Edit Profile →
            </button>
          </div>

          {/* Sign out */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-stone-400" />
              <div>
                <p className="text-sm font-medium text-[#2c2c2c]">Sign Out</p>
                <p className="text-xs text-stone-400">Sign out of your account on this device</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs font-semibold text-stone-600 hover:text-[#2c2c2c] disabled:opacity-50"
            >
              {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-[24px] border border-red-100 bg-white p-6">
        <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-sm font-medium text-[#2c2c2c]">Delete Account</p>
              <p className="text-xs text-stone-400">Permanently remove your account and all data</p>
            </div>
          </div>
          <button
            onClick={() => window.alert('Please contact support to delete your account.')}
            className="text-xs font-semibold text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
