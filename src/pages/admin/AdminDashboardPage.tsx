import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, Users, Globe } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { formatCount } from '../../lib/formatNumber';

const PRIMARY = '#b8864a';

interface OverviewStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_count: number;
}

interface DailyStat {
  stat_date: string;
  profile_views: number;
}

interface TopCompany {
  company_slug: string;
  views: number;
}

interface TopPage {
  page_path: string;
  total_views: number;
  unique_visitors: number;
}

export default function AdminDashboardPage() {
  const { hasPermission } = useAdmin();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [visitorUniqueIpCount, setVisitorUniqueIpCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) {
      setIsLoading(false);
      return;
    }
    loadData();
  }, [hasPermission]);

  const loadData = async () => {
    try {
      const [result, visitorOverview] = await Promise.all([
        adminApi.getStatsOverview(),
        adminApi.getVisitorOverview(),
      ]);
      setOverview(result.overview);
      setDailyStats(result.dailyStats);
      setTopCompanies(result.topCompanies || []);
      setTopPages(result.topPages || []);
      setVisitorUniqueIpCount(result.overview?.unique_visitors || visitorOverview.uniqueIpCount);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-stone-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!hasPermission('can_view_stats')) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">Dashboard</h1>
        <p className="text-stone-500 text-sm mb-8">You do not have permission to view platform statistics.</p>
        <Link to="/admin/designers" className="text-sm font-semibold" style={{ color: PRIMARY }}>
          Go to designer management →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[#2c2c2c] mb-2">Dashboard</h1>
      <p className="text-stone-500 text-sm mb-8">Overview of designers and platform statistics.</p>

      {/* Overview Cards - match DesignerDashboardPage: icon + label + number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#b8864a] via-[#d2ad77] to-[#f0dfbf]" />
          <div className="mb-3 flex items-center gap-3">
            <Clock className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Pending Designers</span>
          </div>
          <p className="text-4xl font-black tracking-tight text-[#2c2c2c] sm:text-5xl">{formatCount(overview?.pending_count)}</p>
          {hasPermission('can_approve') && (
            <Link to="/admin/designers?status=pending" className="mt-3 inline-block text-sm font-semibold" style={{ color: PRIMARY }}>
              Review pending designers →
            </Link>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#b8864a] via-[#d2ad77] to-[#f0dfbf]" />
          <div className="mb-3 flex items-center gap-3">
            <CheckCircle className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Approved Designers</span>
          </div>
          <p className="text-4xl font-black tracking-tight text-[#2c2c2c] sm:text-5xl">{formatCount(overview?.approved_count)}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#b8864a] via-[#d2ad77] to-[#f0dfbf]" />
          <div className="mb-3 flex items-center gap-3">
            <Globe className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Visitor IPs</span>
          </div>
          <p className="text-4xl font-black tracking-tight text-[#2c2c2c] sm:text-5xl">{formatCount(visitorUniqueIpCount)}</p>
          <Link to="/admin/visitors" className="mt-3 inline-block text-sm font-semibold" style={{ color: PRIMARY }}>
            View visitor list →
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#b8864a] via-[#d2ad77] to-[#f0dfbf]" />
          <div className="mb-3 flex items-center gap-3">
            <Users className="w-6 h-6" style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Total Designers</span>
          </div>
          <p className="text-4xl font-black tracking-tight text-[#2c2c2c] sm:text-5xl">{formatCount(overview?.total_count)}</p>
        </div>
      </div>

      {/* Charts Row - match designer card style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Daily Profile Views (Last 30 Days)</h2>
          {dailyStats.length > 0 ? (
            <div className="space-y-2">
              {(() => {
                const maxViews = Math.max(...dailyStats.map(s => s.profile_views), 1);
                return dailyStats.slice(-7).map((stat) => (
                  <div key={stat.stat_date} className="flex items-center gap-4">
                    <span className="text-sm text-stone-500 w-16">{formatDate(stat.stat_date)}</span>
                    <div className="flex-1 h-6 bg-stone-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(100, (stat.profile_views / maxViews) * 100)}%`, backgroundColor: PRIMARY }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[#2c2c2c] w-12 text-right">{formatCount(stat.profile_views)}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="text-stone-500 text-center py-8">No data yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Top Companies by Views</h2>
          {topCompanies.length > 0 ? (
            <div className="space-y-2">
              {(() => {
                const maxViews = Math.max(...topCompanies.map(c => c.views), 1);
                return topCompanies.map((co) => (
                  <div key={co.company_slug} className="flex items-center gap-4">
                    <span className="text-sm text-stone-500 w-32 truncate" title={co.company_slug.replace(/-/g, ' ')}>{co.company_slug.replace(/-/g, ' ')}</span>
                    <div className="flex-1 h-6 bg-stone-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(100, (co.views / maxViews) * 100)}%`, backgroundColor: PRIMARY }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[#2c2c2c] w-10 text-right">{formatCount(co.views)}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="text-stone-500 text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Top Pages by Views</h2>
          <Link to="/admin/analytics" className="text-sm font-semibold" style={{ color: PRIMARY }}>
            Full analytics →
          </Link>
        </div>
        {topPages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Page</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Views</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((page, index) => (
                  <tr key={page.page_path} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                        index < 3 ? 'text-white' : 'bg-stone-100 text-stone-600'
                      }`} style={index < 3 ? { backgroundColor: PRIMARY } : undefined}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-[#2c2c2c] text-sm truncate block max-w-[300px]">{page.page_path}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-[#2c2c2c]">{formatCount(page.total_views)}</td>
                    <td className="py-3 px-4 text-right text-stone-500">{formatCount(page.unique_visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-stone-500 text-center py-8">No page view data yet</p>
        )}
      </div>
    </div>
  );
}
