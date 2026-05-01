import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

interface UAEMapLeafletProps {
  companyCities: CityData[];
  inquiryCities: CityData[];
  visitorCities: CityData[];
  companyTypeCities?: CompanyTypeCity[];
}

const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'UAQ', 'RAK', 'Fujairah'] as const;
type Emirate = typeof EMIRATES[number];

const EMIRATE_CN: Record<Emirate, string> = {
  'Abu Dhabi': '阿布扎比',
  'Dubai':     '迪拜',
  'Sharjah':   '沙迦',
  'Ajman':     '阿治曼',
  'UAQ':       '乌姆盖万',
  'RAK':       '哈伊马角',
  'Fujairah':  '富查伊拉',
};

const EMIRATE_COORDS: Record<Emirate, [number, number]> = {
  'Abu Dhabi': [24.4539, 54.3773],
  'Dubai':     [25.2048, 55.2708],
  'Sharjah':   [25.3463, 55.4209],
  'Ajman':     [25.4052, 55.5136],
  'UAQ':       [25.5648, 55.5554],
  'RAK':       [25.7895, 55.9432],
  'Fujairah':  [25.1288, 56.3265],
};

const EMIRATE_DISTANCE_KM: Record<Emirate, number> = {
  'Dubai':     0,
  'Sharjah':  25,
  'Ajman':    40,
  'UAQ':      80,
  'RAK':     115,
  'Fujairah': 125,
  'Abu Dhabi':140,
};

const CITY_TO_EMIRATE: Record<string, Emirate> = {
  'abu dhabi': 'Abu Dhabi', 'abu-dhabi': 'Abu Dhabi', 'abudhabi': 'Abu Dhabi',
  'al ain': 'Abu Dhabi', 'al-ain': 'Abu Dhabi', 'al ain city': 'Abu Dhabi',
  'al dhafra': 'Abu Dhabi', '阿布扎比': 'Abu Dhabi', '艾因': 'Abu Dhabi',
  'dubai': 'Dubai', 'deira': 'Dubai', 'bur dubai': 'Dubai',
  'jumeirah': 'Dubai', 'jbr': 'Dubai', 'downtown dubai': 'Dubai', '迪拜': 'Dubai',
  'sharjah': 'Sharjah', 'khor fakkan': 'Sharjah', 'kalba': 'Sharjah',
  '沙迦': 'Sharjah', '夏尔迦': 'Sharjah',
  'ajman': 'Ajman', '阿治曼': 'Ajman',
  'umm al quwain': 'UAQ', 'umm al-quwain': 'UAQ', 'uaq': 'UAQ', '乌姆盖万': 'UAQ',
  'ras al khaimah': 'RAK', 'ras al-khaimah': 'RAK', 'rak': 'RAK',
  '哈伊马角': 'RAK', '莱斯海玛': 'RAK',
  'fujairah': 'Fujairah', 'dibba': 'Fujairah', '富查伊拉': 'Fujairah',
};

function mapToEmirate(city: string): Emirate | null {
  return CITY_TO_EMIRATE[city.toLowerCase().trim()] ?? null;
}

function aggregateCities(cities: CityData[]): Partial<Record<Emirate, number>> {
  const result: Partial<Record<Emirate, number>> = {};
  for (const { city, count } of cities) {
    const e = mapToEmirate(city);
    if (e) result[e] = (result[e] || 0) + count;
  }
  return result;
}

function distanceColor(km: number): string {
  if (km < 40)  return '#22c55e';
  if (km < 100) return '#f59e0b';
  return '#f97316';
}

export default function UAEMapLeaflet({
  companyCities,
  inquiryCities,
  visitorCities: _visitorCities,
  companyTypeCities = [],
}: UAEMapLeafletProps) {
  const { lang } = useAdminT();
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<L.Map | null>(null);
  const circlesRef = useRef<L.CircleMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Aggregate
  const companyMap = aggregateCities(companyCities);
  const inquiryMap = aggregateCities(inquiryCities);

  interface EmirateData { companies: number; inquiries: number; total: number; }
  const emirateData: Record<Emirate, EmirateData> = {} as Record<Emirate, EmirateData>;
  let maxTotal = 0;
  for (const e of EMIRATES) {
    const companies = companyMap[e] || 0;
    const inquiries = inquiryMap[e] || 0;
    emirateData[e] = { companies, inquiries, total: companies + inquiries };
    if (emirateData[e].total > maxTotal) maxTotal = emirateData[e].total;
  }

  // Init Leaflet once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center:            [24.5, 54.8],
      zoom:              6,
      zoomControl:       true,
      scrollWheelZoom:   false,
      attributionControl: true,
    });
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);
    mapRef.current = map;
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update bubbles whenever data or map readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    circlesRef.current.forEach(c => map.removeLayer(c));
    circlesRef.current = [];

    for (const emirate of EMIRATES) {
      const data = emirateData[emirate];
      if (data.total === 0) continue;

      const radius = Math.max(8, Math.sqrt(data.total / Math.max(maxTotal, 1)) * 45);
      const [lat, lng] = EMIRATE_COORDS[emirate];

      const circle = L.circleMarker([lat, lng], {
        radius,
        fillColor:   '#B8864A',
        fillOpacity: 0.45,
        color:       '#B8864A',
        weight:      1.5,
        opacity:     0.9,
      });

      const label = `
        <div style="font-size:12px;min-width:100px">
          <div style="font-weight:700;margin-bottom:4px">${EMIRATE_CN[emirate]}</div>
          ${data.companies > 0 ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b6b6b">装企</span><span style="font-weight:600">${data.companies}</span></div>` : ''}
          ${data.inquiries > 0 ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6b6b6b">询盘</span><span style="font-weight:600">${data.inquiries}</span></div>` : ''}
          <div style="margin-top:4px;padding-top:4px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:12px">
            <span style="color:#6b6b6b">合计</span>
            <span style="font-weight:700;color:#B8864A">${data.total}</span>
          </div>
        </div>`;

      circle.bindTooltip(label, { sticky: false, direction: 'top', offset: [0, -4] });
      circle.addTo(map);
      circlesRef.current.push(circle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, companyCities, inquiryCities]);

  const topInquiryCities = inquiryCities.slice(0, 8);
  const maxInquiry = topInquiryCities[0]?.count || 1;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-bold text-[#2c2c2c]">地理分布</h2>
        <p className="text-xs text-[#6b6b6b] mt-0.5">装企注册城市 · 询盘来源 · 访客地区</p>
      </div>

      <div className="flex min-h-0">
        {/* Left: Leaflet map */}
        <div className="flex-1 min-w-0 border-r border-stone-100">
          <div ref={mapDivRef} style={{ height: 380 }} />
        </div>

        {/* Right: stats panel — unchanged */}
        <div className="w-[268px] shrink-0 flex flex-col overflow-y-auto">

          {/* 装企类型分布 */}
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
                        <span className="text-[11px] font-medium text-[#2c2c2c] truncate max-w-[130px]">
                          {labelCompanyType(tc.type, lang === 'en' ? 'en' : 'zh')}
                        </span>
                        <span className="text-[11px] font-bold text-[#B8864A] ml-2">{tc.count}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C8975A,#B8864A)' }}
                        />
                      </div>
                      {tc.topCities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tc.topCities.map((c) => (
                            <span key={c.city} className="text-[9.5px] text-[#6b6b6b] bg-stone-100 rounded-full px-1.5 py-0.5 leading-none">
                              {c.city}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 询盘客分布 */}
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
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: km !== null ? distanceColor(km) : '#d4d4d4' }}
                      />
                      <span className="text-[11px] text-[#2c2c2c] w-[64px] shrink-0 truncate">{ic.city}</span>
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%`, background: km !== null ? distanceColor(km) : '#B8864A', opacity: 0.75 }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-[#6b6b6b] w-[26px] text-right shrink-0">{ic.count}</span>
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
