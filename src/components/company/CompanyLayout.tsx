import { useState, useEffect } from 'react';
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Building2, FolderOpen, Settings } from 'lucide-react';
import Navbar from '../Navbar';
import PhoneRequiredModal from '../PhoneRequiredModal';

const PRIMARY = '#b8864a';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer ${
    isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
  }`;

export default function CompanyLayout() {
  const token = api.getToken();
  if (!token) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <PhoneRequiredModal />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — fixed, doesn't scroll with page */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white fixed top-[57px] bottom-0 left-0 z-10 overflow-y-auto">
          <div className="p-6">
            <nav className="flex flex-col gap-1">
              <NavLink to="/company/dashboard" end className={navCls}>
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </NavLink>
              <NavLink to="/company/projects" className={navCls}>
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </NavLink>
              <NavLink to="/company/settings" className={navCls}>
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </NavLink>
            </nav>

            {/* Profile completeness card */}
            <ProfileCard />
          </div>

        </aside>

        <main className="flex-1 overflow-y-auto md:ml-64">
          <div className="p-6 lg:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Profile completeness card (same style as /designer sidebar) ── */
function ProfileCard() {
  const [profilePct, setProfilePct] = useState(0);
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    api.get('/auth/company/profile').then(res => {
      const d = res.profile || res;
      if (!d || !d.company_name) { setProfilePct(0); return; }
      const req = [d.company_name, d.contact_person, d.phone, d.description, d.city];
      const opt = [d.website, d.address, d.trade_license_number, d.establishment_year];
      let svc: string[] = [];
      try { svc = typeof d.services === 'string' ? JSON.parse(d.services) : (d.services || []); } catch {}
      const total = req.length + opt.length + 1;
      const done = req.filter(Boolean).length + opt.filter(Boolean).length + (svc.length > 0 ? 1 : 0);
      setProfilePct(Math.round((done / total) * 100));
    }).catch(() => {});

    api.get('/auth/company/projects').then(d => {
      const list = d.projects || d || [];
      setProjectCount(Array.isArray(list) ? list.length : 0);
    }).catch(() => {});
  }, []);

  const complete = profilePct >= 80 && projectCount > 0;

  return (
    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
      <p className="text-sm font-semibold text-[#2c2c2c]">
        {complete ? 'Profile Complete' : 'Profile Incomplete'}
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        {complete
          ? 'Your profile is ready for clients.'
          : 'Complete your profile and upload projects to get discovered.'}
      </p>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-stone-500">
          <span>Profile</span>
          <span>{profilePct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${profilePct}%`, backgroundColor: PRIMARY }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
        <span>Portfolio Items</span>
        <span>{projectCount}</span>
      </div>
    </div>
  );
}
