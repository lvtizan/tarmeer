import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, Users, Globe } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { formatCount, toNumber } from '../../lib/formatNumber';

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
  project_views: number;
  contact_clicks: number;
  phone_clicks: number;
  whatsapp_clicks: number;
}

interface TopDesigner {
  id: number;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  display_order: number;
  total_views: number;
  total_clicks: number;
}

export default function AdminDashboardPage() {
  const { hasPermission } = useAdmin();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [topDesigners, setTopDesigners] = useState<TopDesigner[]>([]);
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
      setTopDesigners(result.topDesigners);
      setVisitorUniqueIpCount(visitorOverview.uniqueIpCount);
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

  const sumMetric = (key: keyof DailyStat) => {
    return dailyStats.reduce((sum, stat) => sum + toNumber(stat[key]), 0);
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
    <div className="max-w-6xl mx-auto">
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
          <h2 className="text-lg font-bold text-[#2c2c2c] mb-4">Contact Interactions (Last 30 Days)</h2>
          {dailyStats.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-stone-200">
                <p className="text-sm text-stone-500">Phone Clicks</p>
                <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(sumMetric('phone_clicks'))}</p>
              </div>
              <div className="p-4 rounded-lg border border-stone-200">
                <p className="text-sm text-stone-500">WhatsApp Clicks</p>
                <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(sumMetric('whatsapp_clicks'))}</p>
              </div>
              <div className="p-4 rounded-lg border border-stone-200">
                <p className="text-sm text-stone-500">Contact Form</p>
                <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(sumMetric('contact_clicks'))}</p>
              </div>
              <div className="p-4 rounded-lg border border-stone-200">
                <p className="text-sm text-stone-500">Project Views</p>
                <p className="text-2xl font-bold text-[#2c2c2c]">{formatCount(sumMetric('project_views'))}</p>
              </div>
            </div>
          ) : (
            <p className="text-stone-500 text-center py-8">No data yet</p>
          )}
        </div>
      </div>

      {/* Top Designers */}
      <div className="bg-white rounded-lg border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#2c2c2c]">Top Designers by Views</h2>
          {hasPermission('can_sort') && (
            <Link to="/admin/designers?view=sort" className="text-sm font-semibold" style={{ color: PRIMARY }}>
              Manage order →
            </Link>
          )}
        </div>
        {topDesigners.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">Designer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">City</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Views</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-stone-500">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {topDesigners.map((designer, index) => (
                  <tr key={designer.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-3 px-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                        index < 3 ? 'text-white' : 'bg-stone-100 text-stone-600'
                      }`} style={index < 3 ? { backgroundColor: PRIMARY } : undefined}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link to={`/admin/designers/${designer.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                        {designer.avatar_url ? (
                          <img src={designer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
                            <span className="text-stone-500 text-sm">{designer.full_name.charAt(0)}</span>
                          </div>
                        )}
                        <span className="font-medium text-[#2c2c2c]">{designer.full_name}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-stone-500">{designer.city || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-[#2c2c2c]">{formatCount(designer.total_views)}</td>
                    <td className="py-3 px-4 text-right text-stone-500">{formatCount(designer.total_clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-stone-500 text-center py-8">No approved designers yet</p>
        )}
      </div>
    </div>
  );
}
