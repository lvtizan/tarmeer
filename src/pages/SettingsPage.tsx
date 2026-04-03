import { useState, useEffect } from 'react';
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { FormInput, FormLabel } from '../components/form/FormInput';

function StatusMessage({ type, message }: { type: 'success' | 'error'; message: string }) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
      type === 'success'
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {message}
    </div>
  );
}

export default function SettingsPage() {
  // Current user info
  const [currentName, setCurrentName] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [isOAuth, setIsOAuth] = useState(false);

  // Update name form
  const [newName, setNewName] = useState('');
  const [namePassword, setNamePassword] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    api.getMe().then((data: any) => {
      const u = data.user;
      if (u) {
        setCurrentName(u.full_name || '');
        setCurrentEmail(u.email || '');
        setNewName(u.full_name || '');
        // If password field is empty, user is OAuth-only
        setIsOAuth(!u.has_password && !u.password);
      }
    }).catch(() => {});
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameStatus(null);

    if (!newName.trim()) {
      setNameStatus({ type: 'error', message: 'Please enter a name.' });
      return;
    }
    if (!namePassword) {
      setNameStatus({ type: 'error', message: 'Please enter your current password to confirm.' });
      return;
    }

    setNameLoading(true);
    try {
      const res = await api.put('/auth/update-name', {
        full_name: newName.trim(),
        current_password: namePassword,
      });
      setCurrentName(res.user?.full_name || newName.trim());
      setNamePassword('');
      setNameStatus({ type: 'success', message: res.message || 'Name updated successfully.' });
    } catch (err: any) {
      setNameStatus({ type: 'error', message: err.message || 'Failed to update name.' });
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);

    if (!currentPassword) {
      setPwStatus({ type: 'error', message: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwStatus({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    setPwLoading(true);
    try {
      const res = await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwStatus({ type: 'success', message: res.message || 'Password changed successfully.' });
    } catch (err: any) {
      setPwStatus({ type: 'error', message: err.message || 'Failed to change password.' });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#2c2c2c]">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your account name and password.</p>
      </div>

      {/* ── Update Name ── */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-[#b8864a]" />
          <h2 className="text-lg font-semibold text-[#2c2c2c]">Update Name</h2>
        </div>

        <div className="mb-4 text-sm text-stone-600">
          Current name: <span className="font-medium text-[#2c2c2c]">{currentName || '—'}</span>
          {currentEmail && (
            <span className="ml-3 text-stone-400">({currentEmail})</span>
          )}
        </div>

        {isOAuth ? (
          <p className="text-sm text-stone-500 bg-stone-50 rounded-lg px-4 py-3 border border-stone-200">
            You signed in with a social account. Name changes via password are not available. You can update your name from your Profile page.
          </p>
        ) : (
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div>
              <FormLabel required>New Name</FormLabel>
              <FormInput
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
              />
            </div>
            <div>
              <FormLabel required>Current Password</FormLabel>
              <FormInput
                type="password"
                value={namePassword}
                onChange={(e) => setNamePassword(e.target.value)}
                placeholder="Enter current password to confirm"
              />
            </div>

            {nameStatus && <StatusMessage type={nameStatus.type} message={nameStatus.message} />}

            <button
              type="submit"
              disabled={nameLoading}
              className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {nameLoading ? 'Updating...' : 'Update Name'}
            </button>
          </form>
        )}
      </div>

      {/* ── Change Password ── */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-[#b8864a]" />
          <h2 className="text-lg font-semibold text-[#2c2c2c]">Change Password</h2>
        </div>

        {isOAuth ? (
          <p className="text-sm text-stone-500 bg-stone-50 rounded-lg px-4 py-3 border border-stone-200">
            You signed in with a social account (Google/Facebook). Password management is not available for social login accounts.
          </p>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <FormLabel required>Current Password</FormLabel>
              <FormInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <FormLabel required>New Password</FormLabel>
              <FormInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <FormLabel required>Confirm New Password</FormLabel>
              <FormInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            {pwStatus && <StatusMessage type={pwStatus.type} message={pwStatus.message} />}

            <button
              type="submit"
              disabled={pwLoading}
              className="btn-primary px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {pwLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
