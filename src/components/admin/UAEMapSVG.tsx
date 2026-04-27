import { useState } from 'react';
import { labelCompanyType } from '../../pages/admin/AdminAnalyticsPage';
import { useAdminT } from '../../hooks/useAdminLang';

interface CityData {
  city: string;
  count: number;
}

interface CompanyTypeCity {
  type: string;
  count: number;
  topCities: CityData[];
}

interface UAEMapSVGProps {
  companyCities: CityData[];
  inquiryCities: CityData[];
  visitorCities: CityData[];
  companyTypeCities?: CompanyTypeCity[];
}

// Distance from Dubai (km) per emirate, for service-reach visualization
const EMIRATE_DISTANCE_KM: Record<string, number> = {
  'Dubai':     0,
  'Sharjah':  25,
  'Ajman':    40,
  'UAQ':      80,
  'RAK':     115,
  'Fujairah': 125,
  'Abu Dhabi':140,
};

interface EmirateData {
  companies: number;
  inquiries: number;
  visitors: number;
  total: number;
}

const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'UAQ', 'RAK', 'Fujairah'] as const;

const EMIRATE_CN: Record<string, string> = {
  'Abu Dhabi': '阿布扎比',
  'Dubai':     '迪拜',
  'Sharjah':   '沙迦',
  'Ajman':     '阿治曼',
  'UAQ':       '乌姆盖万',
  'RAK':       '哈伊马角',
  'Fujairah':  '富查伊拉',
};
type Emirate = typeof EMIRATES[number];

// Simplified UAE emirate polygons in a 520×400 viewBox
const EMIRATE_PATHS: Record<Emirate, string> = {
  'Abu Dhabi': 'M 12,248 L 12,392 L 440,392 L 462,356 L 468,310 L 450,262 L 425,232 L 398,198 L 368,152 L 322,185 L 228,212 L 132,168 L 65,158 Z',
  'Dubai':     'M 368,152 L 398,198 L 420,192 L 425,164 L 435,150 L 420,126 L 392,124 Z',
  'Sharjah':   'M 392,122 L 420,124 L 435,148 L 438,118 L 422,108 L 395,108 Z',
  'Ajman':     'M 395,104 L 422,106 L 424,90 L 398,88 Z',
  'UAQ':       'M 398,85 L 424,87 L 428,68 L 402,65 Z',
  'RAK':       'M 402,62 L 428,65 L 436,46 L 466,18 L 495,12 L 504,50 L 492,82 L 460,86 L 448,78 Z',
  'Fujairah':  'M 492,82 L 504,50 L 505,12 L 520,12 L 520,198 L 508,198 L 500,162 L 494,120 Z',
};


const CITY_TO_EMIRATE: Record<string, Emirate> = {
  // Abu Dhabi (English)
  'abu dhabi': 'Abu Dhabi',
  'abu-dhabi': 'Abu Dhabi',
  'abudhabi': 'Abu Dhabi',
  'al ain': 'Abu Dhabi',
  'al-ain': 'Abu Dhabi',
  'al ain city': 'Abu Dhabi',
  'al dhafra': 'Abu Dhabi',
  // Abu Dhabi (Chinese/Arabic transliteration)
  '阿布扎比': 'Abu Dhabi',
  '艾因': 'Abu Dhabi',
  'al-ain city': 'Abu Dhabi',
  // Dubai (English)
  'dubai': 'Dubai',
  'deira': 'Dubai',
  'bur dubai': 'Dubai',
  'jumeirah': 'Dubai',
  'jbr': 'Dubai',
  'downtown dubai': 'Dubai',
  // Dubai (Chinese)
  '迪拜': 'Dubai',
  'Dubai': 'Dubai',
  // Sharjah
  'sharjah': 'Sharjah',
  'khor fakkan': 'Sharjah',
  'kalba': 'Sharjah',
  '沙迦': 'Sharjah',
  '夏尔迦': 'Sharjah',
  // Ajman
  'ajman': 'Ajman',
  '阿治曼': 'Ajman',
  // UAQ
  'umm al quwain': 'UAQ',
  'umm al-quwain': 'UAQ',
  'uaq': 'UAQ',
  '乌姆盖万': 'UAQ',
  // RAK
  'ras al khaimah': 'RAK',
  'ras al-khaimah': 'RAK',
  'rak': 'RAK',
  '哈伊马角': 'RAK',
  '莱斯海玛': 'RAK',
  // Fujairah
  'fujairah': 'Fujairah',
  'dibba': 'Fujairah',
  '富查伊拉': 'Fujairah',
};

function normalizeCity(city: string): string {
  return city.toLowerCase().trim();
}

function mapToEmirate(city: string): Emirate | null {
  return CITY_TO_EMIRATE[normalizeCity(city)] || null;
}

function interpolateColor(t: number): string {
  // #FDF5EC → #B8864A
  const r = Math.round(253 - 69 * t);
  const g = Math.round(245 - 111 * t);
  const b = Math.round(236 - 162 * t);
  return `rgb(${r},${g},${b})`;
}

function aggregateCities(cities: CityData[]): Partial<Record<Emirate, number>> {
  const result: Partial<Record<Emirate, number>> = {};
  for (const { city, count } of cities) {
    const emirate = mapToEmirate(city);
    if (emirate) {
      result[emirate] = (result[emirate] || 0) + count;
    }
  }
  return result;
}

export default function UAEMapSVG({ companyCities, inquiryCities, visitorCities, companyTypeCities = [] }: UAEMapSVGProps) {
  const [hovered, setHovered] = useState<Emirate | null>(null);
  const { lang } = useAdminT();

  const companyMap = aggregateCities(companyCities);
  const inquiryMap = aggregateCities(inquiryCities);
  const visitorMap = aggregateCities(visitorCities);

  const emirateData: Record<Emirate, EmirateData> = {} as Record<Emirate, EmirateData>;
  let maxTotal = 0;

  for (const e of EMIRATES) {
    const companies = companyMap[e] || 0;
    const inquiries = inquiryMap[e] || 0;
    const visitors = visitorMap[e] || 0;
    const total = companies + inquiries + visitors;
    emirateData[e] = { companies, inquiries, visitors, total };
    if (total > maxTotal) maxTotal = total;
  }

  function getColor(emirate: Emirate): string {
    if (maxTotal === 0) return '#FDF5EC';
    const t = emirateData[emirate].total / maxTotal;
    return interpolateColor(t);
  }

  // Auto contrast: luminance = 246.3 - 104.3*t; switch to white below 180
  function getLabelColor(emirate: Emirate): { name: string; sub: string; count: string } {
    if (maxTotal === 0) return { name: '#6b4a24', sub: '#9a7a52', count: '#B8864A' };
    const t = emirateData[emirate].total / maxTotal;
    const lum = 246.3 - 104.3 * t;
    if (lum < 205) {
      return { name: '#ffffff', sub: 'rgba(255,255,255,0.78)', count: 'rgba(255,255,255,0.95)' };
    }
    return { name: '#6b4a24', sub: '#9a7a52', count: '#B8864A' };
  }

  const hoveredData = hovered ? emirateData[hovered] : null;

  // Top inquiry cities with emirate + distance-from-Dubai metadata
  const topInquiryCities = inquiryCities.slice(0, 8);
  const maxInquiry = topInquiryCities[0]?.count || 1;

  // Distance badge color
  function distanceColor(km: number): string {
    if (km < 40)  return '#22c55e'; // green  — same city / neighbour
    if (km < 100) return '#f59e0b'; // amber  — medium
    return '#f97316';               // orange — far
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-bold text-[#2c2c2c]">地理分布</h2>
        <p className="text-xs text-[#6b6b6b] mt-0.5">装企注册城市 · 询盘来源 · 访客地区</p>
      </div>

      <div className="flex min-h-0">
        {/* Left: UAE map */}
        <div className="relative flex-1 min-w-0 px-4 pt-5 pb-4 border-r border-stone-100">
          <svg viewBox="0 0 520 400" className="w-full" style={{ maxHeight: 500 }}>
            {EMIRATES.map((emirate) => (
              <path
                key={emirate}
                d={EMIRATE_PATHS[emirate]}
                fill={getColor(emirate)}
                stroke="#ffffff"
                strokeWidth={hovered === emirate ? 2.5 : 1.5}
                strokeLinejoin="round"
                style={{
                  cursor: 'pointer',
                  transition: 'fill 0.2s, stroke-width 0.15s',
                  filter: hovered === emirate ? 'brightness(0.86)' : 'none',
                }}
                onMouseEnter={() => setHovered(emirate)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}

            {/* Abu Dhabi */}
            <text x={180} y={280} textAnchor="middle" fontSize={13} fill={getLabelColor('Abu Dhabi').name} fontWeight={700} style={{ pointerEvents: 'none', userSelect: 'none' }}>阿布扎比</text>
            <text x={180} y={295} textAnchor="middle" fontSize={9} fill={getLabelColor('Abu Dhabi').sub} style={{ pointerEvents: 'none', userSelect: 'none' }}>Abu Dhabi</text>
            {emirateData['Abu Dhabi'].total > 0 && (
              <text x={180} y={312} textAnchor="middle" fontSize={14} fill={getLabelColor('Abu Dhabi').count} fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['Abu Dhabi'].total.toLocaleString()}</text>
            )}

            {/* Dubai */}
            <text x={393} y={158} textAnchor="middle" fontSize={10} fill={getLabelColor('Dubai').name} fontWeight={700} style={{ pointerEvents: 'none', userSelect: 'none' }}>迪拜</text>
            {emirateData['Dubai'].total > 0 && (
              <text x={393} y={171} textAnchor="middle" fontSize={10} fill={getLabelColor('Dubai').count} fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['Dubai'].total}</text>
            )}

            {/* Sharjah */}
            <text x={415} y={116} textAnchor="middle" fontSize={7.5} fill={getLabelColor('Sharjah').name} fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>沙迦</text>
            {emirateData['Sharjah'].total > 0 && (
              <text x={415} y={126} textAnchor="middle" fontSize={7.5} fill={getLabelColor('Sharjah').count} fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['Sharjah'].total}</text>
            )}

            {/* Ajman — callout */}
            <line x1={340} y1={97} x2={394} y2={97} stroke="#B8864A" strokeWidth={0.8} strokeOpacity={0.45} strokeDasharray="3,2" style={{ pointerEvents: 'none' }} />
            <circle cx={394} cy={97} r={2} fill="#B8864A" fillOpacity={0.55} style={{ pointerEvents: 'none' }} />
            <text x={337} y={94} textAnchor="end" fontSize={7} fill="#6b4a24" fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>阿治曼</text>
            {emirateData['Ajman'].total > 0 && (
              <text x={337} y={104} textAnchor="end" fontSize={9} fill="#B8864A" fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['Ajman'].total}</text>
            )}

            {/* UAQ — callout */}
            <line x1={340} y1={75} x2={397} y2={76} stroke="#B8864A" strokeWidth={0.8} strokeOpacity={0.45} strokeDasharray="3,2" style={{ pointerEvents: 'none' }} />
            <circle cx={397} cy={76} r={2} fill="#B8864A" fillOpacity={0.55} style={{ pointerEvents: 'none' }} />
            <text x={337} y={72} textAnchor="end" fontSize={7} fill="#6b4a24" fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>乌姆盖万</text>
            {emirateData['UAQ'].total > 0 && (
              <text x={337} y={82} textAnchor="end" fontSize={9} fill="#B8864A" fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['UAQ'].total}</text>
            )}

            {/* RAK */}
            <text x={451} y={48} textAnchor="middle" fontSize={7.5} fill={getLabelColor('RAK').name} fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>哈伊马角</text>
            {emirateData['RAK'].total > 0 && (
              <text x={451} y={58} textAnchor="middle" fontSize={7.5} fill={getLabelColor('RAK').count} fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['RAK'].total}</text>
            )}

            {/* Fujairah */}
            <text x={514} y={130} textAnchor="middle" fontSize={7.5} fill={getLabelColor('Fujairah').name} fontWeight={600} transform="rotate(-90,514,130)" style={{ pointerEvents: 'none', userSelect: 'none' }}>富查伊拉</text>
            {emirateData['Fujairah'].total > 0 && (
              <text x={514} y={175} textAnchor="middle" fontSize={7.5} fill={getLabelColor('Fujairah').count} fontWeight={800} transform="rotate(-90,514,175)" style={{ pointerEvents: 'none', userSelect: 'none' }}>{emirateData['Fujairah'].total}</text>
            )}
          </svg>

          {/* Hover tooltip */}
          {hovered && hoveredData && hoveredData.total > 0 && (
            <div className="absolute top-5 left-4 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-2xl shadow-lg p-3 text-xs min-w-[148px]">
              <div className="font-semibold text-[#2c2c2c] mb-2">{EMIRATE_CN[hovered] || hovered}</div>
              {hoveredData.companies > 0 && (
                <div className="flex items-center justify-between gap-3 text-[#6b6b6b]">
                  <span>装企</span><span className="font-medium text-[#2c2c2c]">{hoveredData.companies}</span>
                </div>
              )}
              {hoveredData.inquiries > 0 && (
                <div className="flex items-center justify-between gap-3 text-[#6b6b6b]">
                  <span>询盘</span><span className="font-medium text-[#2c2c2c]">{hoveredData.inquiries}</span>
                </div>
              )}
              {hoveredData.visitors > 0 && (
                <div className="flex items-center justify-between gap-3 text-[#6b6b6b]">
                  <span>访客</span><span className="font-medium text-[#2c2c2c]">{hoveredData.visitors}</span>
                </div>
              )}
              <div className="mt-1.5 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[#6b6b6b]">合计</span>
                <span className="font-bold text-[#B8864A]">{hoveredData.total}</span>
              </div>
            </div>
          )}

        </div>

        {/* Right: Company types + Inquiry city distribution */}
        <div className="w-[268px] shrink-0 flex flex-col overflow-y-auto">

          {/* ── 装企类型分布 ── */}
          <div className="px-4 pt-4 pb-3 border-b border-stone-100">
            <div className="text-[11px] font-bold text-[#2c2c2c] mb-0.5">装企类型</div>
            <div className="text-[10px] text-[#6b6b6b] mb-3">注册装企按类别分布</div>
            {companyTypeCities.length === 0 ? (
              <div className="text-[11px] text-stone-400 py-2">暂无数据</div>
            ) : (
              <div className="space-y-2.5">
                {companyTypeCities.slice(0, 7).map((tc) => {
                  const maxType = companyTypeCities[0].count;
                  const pct = maxType > 0 ? (tc.count / maxType) * 100 : 0;
                  return (
                    <div key={tc.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-[#2c2c2c] truncate max-w-[130px]">{labelCompanyType(tc.type, lang === 'en' ? 'en' : 'zh')}</span>
                        <span className="text-[11px] font-bold text-[#B8864A] ml-2">{tc.count}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C8975A,#B8864A)' }} />
                      </div>
                      {tc.topCities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tc.topCities.map((c) => (
                            <span key={c.city} className="text-[9.5px] text-[#6b6b6b] bg-stone-100 rounded-full px-1.5 py-0.5 leading-none">{c.city}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 询盘客分布 + 服务距离 ── */}
          <div className="px-4 pt-4 pb-4 flex-1">
            <div className="text-[11px] font-bold text-[#2c2c2c] mb-0.5">询盘客分布</div>
            <div className="text-[10px] text-[#6b6b6b] mb-3 flex items-center gap-2">
              <span>来源城市</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" />
                <span>&lt;40km</span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b] ml-1" />
                <span>&lt;100km</span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#f97316] ml-1" />
                <span>远</span>
              </span>
            </div>
            {topInquiryCities.length === 0 ? (
              <div className="text-[11px] text-stone-400 py-2">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {topInquiryCities.map((ic) => {
                  const emirate = mapToEmirate(ic.city);
                  const km = emirate !== null ? (EMIRATE_DISTANCE_KM[emirate] ?? null) : null;
                  const barPct = (ic.count / maxInquiry) * 100;
                  return (
                    <div key={ic.city} className="flex items-center gap-2">
                      {/* Distance dot */}
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: km !== null ? distanceColor(km) : '#d4d4d4' }}
                      />
                      {/* City name */}
                      <span className="text-[11px] text-[#2c2c2c] w-[64px] shrink-0 truncate">{ic.city}</span>
                      {/* Bar */}
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%`, background: km !== null ? distanceColor(km) : '#B8864A', opacity: 0.75 }}
                        />
                      </div>
                      {/* Count */}
                      <span className="text-[10px] font-semibold text-[#6b6b6b] w-[26px] text-right shrink-0">{ic.count}</span>
                      {/* Distance label */}
                      {km !== null && (
                        <span className="text-[9px] text-[#9a9a9a] w-[32px] shrink-0">{km === 0 ? '市内' : `${km}km`}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
