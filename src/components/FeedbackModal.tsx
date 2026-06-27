'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Send, MessageSquare, ChevronLeft } from 'lucide-react';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
  userId?: number;
  userName?: string;
  userEmail?: string;
  companyName?: string;
  companyType?: string;
}

interface Thread {
  id: number;
  title: string;
  content: string;
  created_at: string;
  unread_replies: number;
  reply_count: number;
}
interface Reply { id: number; sender: 'admin' | 'user'; content: string; created_at: string; }

export default function FeedbackModal({
  open, onClose, source = 'website', userId, userName, userEmail, companyName, companyType,
}: FeedbackModalProps) {
  const { tr, lang } = useSiteLocale();
  const tm = tr.modals;
  const vi = lang === 'vi';
  const tt = (en: string, v: string) => (vi ? v : en);
  const loggedIn = typeof window !== 'undefined' && !!api.getToken();

  // view: 'list' 我的对话列表 | 'thread' 单条对话 | 'new' 新建反馈
  const [view, setView] = useState<'list' | 'thread' | 'new'>(loggedIn ? 'list' : 'new');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<{ feedback: Thread; replies: Reply[] } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedGuest, setSubmittedGuest] = useState(false);

  const loadThreads = useCallback(async () => {
    if (!loggedIn) return;
    try { const res = await api.request('/feedback/my'); setThreads(res.feedback || []); }
    catch { /* ignore */ }
  }, [loggedIn]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (loggedIn) { setView('list'); loadThreads(); }
    else setView('new');
  }, [open, loggedIn, loadThreads]);

  if (!open) return null;

  const openThread = async (id: number) => {
    setBusy(true); setError('');
    try {
      const res = await api.request(`/feedback/my/${id}`);
      setActive({ feedback: res.feedback, replies: res.replies || [] });
      setView('thread');
    } catch { setError(tt('Failed to load conversation.', '加载对话失败。')); }
    finally { setBusy(false); }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : {}) },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), source, user_id: userId, user_name: userName, user_email: userEmail, company_name: companyName, company_type: companyType }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; throw new Error(d.error || tm.submitFailed); }
      setTitle(''); setContent('');
      if (loggedIn) { await loadThreads(); setView('list'); }
      else { setView('new'); setError(''); setSubmittedGuest(true); }
    } catch (err) { setError(err instanceof Error ? err.message : tm.somethingWrong); }
    finally { setBusy(false); }
  };

  const sendReply = async () => {
    const c = replyText.trim();
    if (!c || !active || busy) return;
    setBusy(true); setError('');
    try {
      const res = await api.request(`/feedback/my/${active.feedback.id}/reply`, { method: 'POST', body: JSON.stringify({ content: c }) });
      setActive({ feedback: active.feedback, replies: res.replies || [] });
      setReplyText('');
    } catch { setError(tt('Failed to send.', '发送失败。')); }
    finally { setBusy(false); }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setTitle(''); setContent(''); setReplyText(''); setActive(null); setSubmittedGuest(false); setError(''); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#5c4a38] px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {view === 'thread' && (
              <button onClick={() => { setView('list'); loadThreads(); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white/70 hover:text-white shrink-0">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-base text-white font-medium truncate">
                {view === 'thread' ? (active?.feedback.title || tm.feedbackTitle) : tm.feedbackTitle}
              </h3>
              <p className="text-white/60 text-xs mt-0.5 truncate">{view === 'thread' ? tt('Conversation', '对话') : tm.feedbackSubtitle}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white/60 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* 列表视图 */}
          {view === 'list' && (
            <div className="p-4">
              <button onClick={() => { setView('new'); setSubmittedGuest(false); }} className="w-full mb-3 h-10 rounded-xl bg-[#c6a065] text-white text-sm font-semibold hover:bg-[#b8860b] transition flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> {tt('New Feedback', '新建反馈')}
              </button>
              {threads.length === 0 ? (
                <p className="text-center text-sm text-stone-400 py-8">{tt('No feedback yet.', '还没有反馈。')}</p>
              ) : (
                <div className="space-y-2">
                  {threads.map((th) => (
                    <button key={th.id} onClick={() => openThread(th.id)} className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-[#c6a065] hover:bg-stone-50 transition">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#1c1917] truncate">{th.title}</span>
                        {th.unread_replies > 0 && <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{th.unread_replies}</span>}
                      </div>
                      <p className="text-xs text-stone-500 truncate mt-0.5">{th.content}</p>
                      <p className="text-[11px] text-stone-400 mt-1">{th.reply_count > 0 ? tt(`${th.reply_count} replies`, `${th.reply_count} 条回复`) : tt('Awaiting reply', '等待回复')}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 对话视图 */}
          {view === 'thread' && active && (
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#c6a065] text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{active.feedback.content}</div>
              </div>
              {active.replies.map((r) => (
                <div key={r.id} className={`flex ${r.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${r.sender === 'user' ? 'bg-[#c6a065] text-white rounded-br-sm' : 'bg-stone-100 text-[#2c2c2c] rounded-bl-sm'}`}>
                    <div className="text-[11px] opacity-70 mb-0.5">{r.sender === 'admin' ? tt('Support', '客服') : tt('You', '你')}</div>
                    {r.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 新建视图 */}
          {view === 'new' && (
            submittedGuest ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4"><Send className="w-6 h-6 text-green-600" /></div>
                <h3 className="font-serif text-lg font-semibold text-[#1c1917] mb-2">{tm.feedbackThankYou}</h3>
                <p className="text-sm text-stone-500">{tm.feedbackReceived}</p>
                <button onClick={handleClose} className="mt-5 px-6 py-2 rounded-xl bg-[#c6a065] text-white text-sm font-semibold hover:bg-[#b8860b] transition">{tm.close}</button>
              </div>
            ) : (
              <form onSubmit={submitNew} className="p-6 space-y-4">
                {loggedIn && (
                  <button type="button" onClick={() => { setView('list'); loadThreads(); }} className="flex items-center gap-1 text-xs text-stone-500 hover:text-[#b8860b] transition -mt-1">
                    <ChevronLeft className="w-3.5 h-3.5" /> {tt('My conversations', '我的对话')}
                  </button>
                )}
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">{tm.subject}</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={tm.subjectPlaceholder}
                    className="w-full h-11 px-4 bg-white border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">{tm.message}</label>
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} required placeholder={tm.messagePlaceholder} rows={5}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition resize-none" />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <button type="submit" disabled={busy || !title.trim() || !content.trim()}
                  className="w-full h-12 rounded-xl bg-[#c6a065] text-white font-semibold text-sm hover:bg-[#b8860b] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
                  {busy ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" />{tm.sendFeedback}</>}
                </button>
              </form>
            )
          )}
        </div>

        {/* 对话视图的回复框(贴底)：空内容时发送灰色 */}
        {view === 'thread' && active && (
          <div className="shrink-0 border-t border-stone-100 p-3 flex items-end gap-2">
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} placeholder={tt('Type a reply…', '回复…')}
              className="flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-[#1c1917] outline-none focus:border-[#c6a065] focus:ring-2 focus:ring-[#c6a065]/20 placeholder:text-stone-400 max-h-24" />
            <button onClick={sendReply} disabled={!replyText.trim() || busy}
              className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition ${replyText.trim() && !busy ? 'bg-[#c6a065] text-white hover:bg-[#b8860b]' : 'bg-stone-200 text-stone-400 cursor-not-allowed'}`}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && view !== 'new' && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
