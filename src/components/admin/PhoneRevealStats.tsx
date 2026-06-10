'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/adminApi';
import { Phone } from 'lucide-react';

interface TrendRow { date: string; count: number }
interface TopRow { target_type: string; target_id: number; target_name: string | null; count: number }

/** 电话点击统计：衡量真实需求（哪个公司/专家被找得多） */
export default function PhoneRevealStats({ country }: { country: string }) {
  const [data, setData] = useState<{ total: number; trend: TrendRow[]; top: TopRow[] } | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.getPhoneRevealStats({ country, days })
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country, days]);

  const maxDay = Math.max(1, ...(data?.trend || []).map(t => t.count));

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#2c6e4918', color: '#2c6e49' }}>
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#2c2c2c]">电话点击（真实需求）</div>
            <div className="text-[11px] text-stone-400">用户点击「查看电话」的次数 · 同 IP 当天去重</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs rounded-lg transition ${days === d ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
            >{d}天</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-stone-400 text-sm">加载中…</div>
      ) : !data ? (
        <div className="py-8 text-center text-stone-400 text-sm">加载失败</div>
      ) : (
        <>
          <div className="text-2xl font-bold text-[#1a1a1a] mb-3">{data.total.toLocaleString()} <span className="text-xs font-normal text-stone-400">次 / {days} 天</span></div>
          {/* 迷你趋势条 */}
          {data.trend.length > 0 && (
            <div className="flex items-end gap-[2px] h-12 mb-4">
              {data.trend.map((t) => (
                <div
                  key={String(t.date)}
                  title={`${String(t.date).slice(0, 10)}: ${t.count}`}
                  className="flex-1 bg-[#b8864a]/70 rounded-t min-w-[2px]"
                  style={{ height: `${Math.max(8, (t.count / maxDay) * 100)}%` }}
                />
              ))}
            </div>
          )}
          {/* 被点击排行 */}
          {data.top.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-3">暂无点击记录</p>
          ) : (
            <div className="space-y-1.5">
              {data.top.slice(0, 10).map((t, i) => (
                <div key={`${t.target_type}-${t.target_id}`} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-xs text-stone-400">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-stone-700">{t.target_name || `${t.target_type}#${t.target_id}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${t.target_type === 'expert' ? 'bg-purple-50 text-purple-600' : 'bg-stone-100 text-stone-500'}`}>
                    {t.target_type === 'expert' ? '专家' : '公司'}
                  </span>
                  <span className="font-semibold text-[#b8864a] tabular-nums">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
