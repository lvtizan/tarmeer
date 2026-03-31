import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Building2, MessageSquare, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  role: 'user' | 'designer' | 'company';
  status: string;
}

const ROLE_LABEL: Record<string, string> = {
  user: 'User',
  designer: 'Designer',
  company: 'Company',
};

const ROLE_COLOR: Record<string, string> = {
  user: 'bg-stone-100 text-stone-700',
  designer: 'bg-amber-100 text-amber-800',
  company: 'bg-blue-100 text-blue-800',
};

export default function DashboardHomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [designer, setDesigner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then((data) => {
        setUser(data.user);
        setDesigner(data.designer);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-20 text-stone-500">Failed to load profile.</div>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          Welcome back, {user.full_name.split(' ')[0]}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLOR[user.role]}`}>
            {ROLE_LABEL[user.role]}
          </span>
          {user.email && <span className="text-sm text-stone-400">{user.email}</span>}
        </div>
      </div>

      {/* Designer pending */}
      {designer && designer.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-medium">Your designer application is under review.</p>
          <p className="text-amber-700 text-sm mt-1">We'll notify you once it's approved.</p>
        </div>
      )}

      {/* Regular user CTAs */}
      {user.role === 'user' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/dashboard/apply/designer"
            className="group p-6 bg-white rounded-xl border border-stone-200 hover:border-[#b8864a] hover:shadow-md transition"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
              <Palette className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-semibold text-stone-800 group-hover:text-[#b8864a] transition">Become a Designer</h3>
            <p className="text-sm text-stone-500 mt-1">Showcase your portfolio and get clients</p>
          </Link>
          <Link
            to="/dashboard/apply/company"
            className="group p-6 bg-white rounded-xl border border-stone-200 hover:border-blue-400 hover:shadow-md transition"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-stone-800 group-hover:text-blue-600 transition">Register Company</h3>
            <p className="text-sm text-stone-500 mt-1">List your renovation company on Tarmeer</p>
          </Link>
        </div>
      )}

      {/* Designer/Company quick stats */}
      {(user.role === 'designer' || user.role === 'company') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {user.role === 'designer' && (
            <Link to="/dashboard/projects" className="p-5 bg-white rounded-xl border border-stone-200 hover:shadow-md transition">
              <FolderOpen className="w-5 h-5 text-[#b8864a] mb-2" />
              <div className="text-2xl font-bold text-stone-800">—</div>
              <div className="text-xs text-stone-500 mt-1">Projects</div>
            </Link>
          )}
          <Link to="/dashboard/inquiries" className="p-5 bg-white rounded-xl border border-stone-200 hover:shadow-md transition">
            <MessageSquare className="w-5 h-5 text-green-600 mb-2" />
            <div className="text-2xl font-bold text-stone-800">—</div>
            <div className="text-xs text-stone-500 mt-1">Inquiries Received</div>
          </Link>
          <Link to="/dashboard/profile" className="p-5 bg-white rounded-xl border border-stone-200 hover:shadow-md transition">
            <div className="w-5 h-5 rounded-full bg-[#b8864a] mb-2" />
            <div className="text-sm font-semibold text-stone-800">Edit Profile</div>
            <div className="text-xs text-stone-500 mt-1">Update your information</div>
          </Link>
        </div>
      )}
    </div>
  );
}
