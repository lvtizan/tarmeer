import { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
  userId?: number;
  userName?: string;
  userEmail?: string;
}

export default function FeedbackModal({ open, onClose, source = 'website', userId, userName, userEmail }: FeedbackModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), source, user_id: userId, user_name: userName, user_email: userEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after close animation
    setTimeout(() => { setTitle(''); setContent(''); setSubmitted(false); setError(''); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1c1917] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-base text-white font-medium">Share Your Feedback</h3>
              <p className="text-white/60 text-xs mt-0.5">Your opinion helps us improve</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#1c1917] mb-2">Thank You!</h3>
            <p className="text-sm text-stone-500">Your feedback has been received. We appreciate your input!</p>
            <button onClick={handleClose} className="mt-5 px-6 py-2 rounded-xl bg-[#c6a065] text-white text-sm font-semibold hover:bg-[#b8860b] transition">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Subject</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="What's on your mind?"
                className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Message</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                placeholder="Share your thoughts, suggestions, or feedback..."
                rows={5}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#c6a065]/30 focus:border-[#c6a065] transition resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="w-full h-12 rounded-xl bg-[#c6a065] text-white font-semibold text-sm hover:bg-[#b8860b] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Feedback
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
