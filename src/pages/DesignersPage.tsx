import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import PageContainer from '../components/PageContainer';
import DesignerCard from '../components/designers/DesignerCard';
import { designersList, type Designer } from '../data/designers';
import { loadOrderedDesignerSeeds } from '../lib/designerOrder';
import { api } from '../lib/api';
import { safeGetJSON } from '../lib/storage';
import Avatar from '../components/ui/Avatar';

export default function DesignersPage() {
  const [designers, setDesigners] = useState<Designer[]>(designersList);

  const isDesignerLoggedIn = Boolean(api.getToken());
  const designer = safeGetJSON<Record<string, unknown>>('designer');
  const designerName = ((designer?.full_name as string) || (designer?.fullName as string) || '').trim() || 'Designer';
  const designerAvatar = ((designer?.avatar_url as string) || (designer?.avatarUrl as string) || '').trim();

  useEffect(() => {
    let active = true;
    loadOrderedDesignerSeeds().then((ordered) => {
      if (!active) return;
      setDesigners(ordered);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageContainer className="py-8 sm:py-12">
        <a href="/" className="text-[#c6a065] hover:underline text-sm mb-8 inline-block">
          ← Back to Home
        </a>

        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c2c2c]">
            All designers
          </h1>

          {/* Login / Register or Dashboard */}
          <div className="flex items-center gap-3">
            {isDesignerLoggedIn ? (
              <Link
                to="/designer/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f0e8] text-[#2c2c2c] text-sm font-medium hover:bg-[#ede5d6] transition"
              >
                <Avatar name={designerName} avatarUrl={designerAvatar} size="sm" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/auth?tab=login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-stone-200 text-[#2c2c2c] text-sm font-medium hover:bg-stone-50 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Log In
                </Link>
                <Link
                  to="/auth?tab=register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2c2c2c] text-white text-sm font-medium hover:bg-[#1a1a1a] transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        <p className="text-[#6b6b6b] mb-10">
          {designers.length} designer{designers.length !== 1 ? 's' : ''}. Click a card to view profile and portfolio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {designers.map((d) => (
            <DesignerCard key={d.slug} designer={d} />
          ))}
        </div>
    </PageContainer>
  );
}
