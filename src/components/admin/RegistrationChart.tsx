'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

interface DataPoint { date: string; count: number; }

const W = 340, H = 140, PL = 28, PR = 8, PT = 12, PB = 44;
const CW = W - PL - PR, CH = H - PT - PB;

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export default function RegistrationChart() {
  const [userData, setUserData] = useState<DataPoint[]>([]);
  const [companyData, setCompanyData] = useState<DataPoint[]>([]);

  useEffect(() => {
    adminApi.getRegistrationStats(30).then((res: unknown) => {
      const r = res as { users?: DataPoint[]; companies?: DataPoint[] };
      setUserData(r.users || []);
      setCompanyData(r.companies || []);
    }).catch(() => {});
  }, []);

  const today = new Date();
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const userMap = Object.fromEntries(userData.map((d) => [d.date, Number(d.count)]));
  const companyMap = Object.fromEntries(companyData.map((d) => [d.date, Number(d.count)]));

  const userCounts = dates.map((d) => userMap[d] || 0);
  const companyCounts = dates.map((d) => companyMap[d] || 0);
  const maxVal = Math.max(1, ...userCounts, ...companyCounts);

  const toXY = (counts: number[]) =>
    counts.map((v, i) => ({
      x: PL + (i / (dates.length - 1)) * CW,
      y: PT + CH - (v / maxVal) * CH,
    }));

  const userPts = toXY(userCounts);
  const companyPts = toXY(companyCounts);

  const xLabels = dates.filter((_, i) => i === 0 || i === 14 || i === dates.length - 1);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: PT + CH - r * CH,
    label: Math.round(r * maxVal),
  }));

  const totalUsers = userCounts.reduce((a, b) => a + b, 0);
  const totalCompanies = companyCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-stone-500">注册趋势 (近30天)</span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#b8864a] rounded" />
            <span className="text-stone-500">业主 <strong className="text-stone-700">{totalUsers}</strong></span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#2c6e49] rounded" />
            <span className="text-stone-500">装企 <strong className="text-stone-700">{totalCompanies}</strong></span>
          </span>
        </div>
      </div>
      <svg width={W} height={H} className="overflow-visible">
        {yTicks.map((t) => (
          <g key={t.y}>
            <line x1={PL} x2={PL + CW} y1={t.y} y2={t.y} stroke="#e7e5e4" strokeWidth={0.5} />
            <text x={PL - 4} y={t.y + 3.5} textAnchor="end" fontSize={9} fill="#a8a29e">{t.label}</text>
          </g>
        ))}

        <path d={buildPath(userPts)} fill="none" stroke="#b8864a" strokeWidth={1.5} strokeLinejoin="round" />
        {userPts.map((p, i) => userCounts[i] > 0 && (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#b8864a" />
        ))}

        <path d={buildPath(companyPts)} fill="none" stroke="#2c6e49" strokeWidth={1.5} strokeLinejoin="round" />
        {companyPts.map((p, i) => companyCounts[i] > 0 && (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#2c6e49" />
        ))}

        {xLabels.map((date) => {
          const idx = dates.indexOf(date);
          const x = PL + (idx / (dates.length - 1)) * CW;
          const label = date.slice(5); // MM-DD
          return (
            <text
              key={date}
              x={x}
              y={PT + CH + 14}
              fontSize={9}
              fill="#a8a29e"
              textAnchor="end"
              transform={`rotate(-40, ${x}, ${PT + CH + 14})`}
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
