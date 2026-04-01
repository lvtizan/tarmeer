import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  User,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useDesigner } from '../../contexts/DesignerContext';
import Avatar from '../ui/Avatar';

const PRIMARY = '#b8864a';

export default function DesignerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, projects, logout } = useDesigner();
  const sectionLabel =
    location.pathname.startsWith('/designer/projects')
      ? 'My Projects'
      : location.pathname.startsWith('/designer/profile')
        ? 'Profile'
        : 'Dashboard';

  const handleLogout = () => {
    logout();
    api.clearToken();
    navigate('/auth', { replace: true });
  };

  const profileChecklist = [
    Boolean(profile.fullName.trim()),
    Boolean(profile.title.trim()),
    Boolean(profile.phone.trim()),
    Boolean(profile.city.trim()),
    Boolean(profile.bio.trim()),
    Boolean(profile.avatarUrl.trim()),
  ];
  const profileDone = profileChecklist.filter(Boolean).length;
  const profilePercent = Math.round((profileDone / profileChecklist.length) * 100);
  const projectTarget = 3;
  const projectCount = projects.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f7]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white px-4 md:px-10 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/designer/dashboard" className="flex items-center gap-3 text-[#2c2c2c] cursor-pointer shrink-0">
            <div
              className="size-8 rounded flex items-center justify-center"
              style={{ backgroundColor: `${PRIMARY}20` }}
            >
              <LayoutDashboard className="w-5 h-5" style={{ color: PRIMARY }} />
            </div>
            <span className="text-lg font-bold">Tarmeer Dashboard</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-sm text-stone-500 min-w-0">
            <Link to="/" className="hover:text-[#2c2c2c] transition shrink-0">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
            <span className="text-[#2c2c2c] font-medium truncate">{sectionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg h-9 px-3 border border-stone-200 text-stone-600 hover:text-[#b8864a] hover:border-[#b8864a] text-sm font-medium transition"
          >
            Back to Site
          </Link>
          <Link
            to="/designer/profile"
            className="cursor-pointer"
            aria-label="Profile"
          >
            <Avatar name={profile.fullName} avatarUrl={profile.avatarUrl} size="md" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg h-9 px-3 text-stone-600 hover:text-red-600 text-sm font-medium transition cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col flex-shrink-0 border-r border-stone-200 bg-white overflow-y-auto">
          <div className="p-6">
            <div className="flex gap-3 items-center mb-8">
              <Avatar name={profile.fullName} avatarUrl={profile.avatarUrl} size="lg" />
              <div>
                <h2 className="text-[#2c2c2c] font-bold text-base">{profile.fullName || 'New Designer'}</h2>
                <p className="text-stone-500 text-xs">{profile.title || 'Complete your profile'}</p>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              <NavLink
                to="/designer/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]' : 'text-stone-600 hover:bg-stone-50'}`
                }
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </NavLink>
              <NavLink
                to="/designer/projects"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]' : 'text-stone-600 hover:bg-stone-50'}`
                }
              >
                <FolderOpen className="w-5 h-5" />
                <span className="text-sm font-medium">My Projects</span>
              </NavLink>
              <NavLink
                to="/designer/profile"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${isActive ? 'bg-[#b8864a]/10 text-[#2c2c2c] border-l-4 border-[#b8864a]' : 'text-stone-600 hover:bg-stone-50'}`
                }
              >
                <User className="w-5 h-5" />
                <span className="text-sm font-medium">Profile</span>
              </NavLink>
            </nav>
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
              <p className="text-sm font-semibold text-[#2c2c2c]">Profile Incomplete</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                After completing your profile and portfolio, our clients will contact you within two days.
              </p>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Profile</span>
                  <span>{profilePercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full" style={{ width: `${profilePercent}%`, backgroundColor: PRIMARY }} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500">
                <span>Portfolio</span>
                <span>{projectCount}/{projectTarget}</span>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-stone-200" />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
