'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications?limit=20') as { notifications?: Notification[]; unread_count?: number };
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('[NotificationBell] Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationBell] Failed to mark all as read:', err);
    }
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await api.put(`/notifications/${n.id}/read`, {});
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('[NotificationBell] Failed to mark notification as read:', err);
      }
    }
    if (n.link) window.location.href = n.link;
    setOpen(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-stone-100 transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-stone-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <span className="text-sm font-semibold text-stone-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-50 hover:bg-stone-50 transition ${!n.is_read ? 'bg-amber-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{n.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-stone-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
