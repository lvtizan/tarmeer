import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';

interface EmailEntry {
  id: number;
  email: string;
  label: string | null;
  is_active: number;
  created_at: string;
}

export default function AdminNotificationEmailsPage() {
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchEmails = async () => {
    try {
      const data = await adminApi.request('/notification-emails');
      setEmails(data.emails || []);
    } catch {
      setError('Failed to load notification emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmails(); }, []);

  const handleAdd = async () => {
    if (!newEmail) return;
    setError('');
    try {
      await adminApi.request('/notification-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, label: newLabel || undefined }),
      });
      setNewEmail('');
      setNewLabel('');
      fetchEmails();
    } catch {
      setError('Failed to add email');
    }
  };

  const handleToggle = async (entry: EmailEntry) => {
    try {
      await adminApi.request(`/notification-emails/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !entry.is_active }),
      });
      fetchEmails();
    } catch {
      setError('Failed to update email');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this email from notification list?')) return;
    try {
      await adminApi.request(`/notification-emails/${id}`, { method: 'DELETE' });
      fetchEmails();
    } catch {
      setError('Failed to delete email');
    }
  };

  if (loading) return <div className="p-8"><PageSpinner /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Notification Emails</h1>
      <p className="text-sm text-stone-500 mb-8">
        Emails listed here will receive notifications when new inquiries or company registrations come in.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 px-4 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a]"
        />
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (optional)"
          className="w-40 px-4 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#b8864a]"
        />
        <button
          onClick={handleAdd}
          disabled={!newEmail}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#b8864a] text-white rounded-lg text-sm font-medium hover:bg-[#a07540] disabled:opacity-50 transition"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Email list */}
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
        {emails.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-stone-400">
            No notification emails configured
          </div>
        ) : (
          emails.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${entry.is_active ? 'text-stone-900' : 'text-stone-400 line-through'}`}>
                  {entry.email}
                </p>
                {entry.label && (
                  <p className="text-xs text-stone-500">{entry.label}</p>
                )}
              </div>
              <button
                onClick={() => handleToggle(entry)}
                className="p-1 hover:bg-stone-100 rounded transition"
                title={entry.is_active ? 'Disable' : 'Enable'}
              >
                {entry.is_active ? (
                  <ToggleRight className="w-6 h-6 text-green-600" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-stone-400" />
                )}
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="p-1 hover:bg-red-50 rounded transition text-stone-400 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
