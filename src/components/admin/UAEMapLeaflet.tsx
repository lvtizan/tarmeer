import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { labelCompanyType } from '../../pages/admin/AdminAnalyticsPage';
import { useAdminT } from '../../hooks/useAdminLang';

interface CityData { city: string; count: number; }
interface CompanyTypeCity { type: string; count: number; topCities: CityData[]; }
interface UAEMapLeafletProps {
  companyCities:      CityData[];
  inquiryCities:      CityData[];
  visitorCities:      CityData[];
  homeownerCities?:   CityData[];
  companyTypeCities?: CompanyTypeCity[];
}

// ── Inject ping keyframes once ────────────────────────────────────────────
const STYLE_ID = 'uae-map-ping-style';
function ensurePingStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes map-ping {
      0%   { transform: scale(1);   opacity: 0.75; }
      80%  { transform: scale(2.4); opacity: 0.15; }
      100% { transform: scale(2.8); opacity: 0;    }
    }
    .map-ping-ring {
      position: absolute; inset: 0; border-radius: 50%;
      animation: map-ping 2.2s ease-out infinite;
    }
    .map-ping-dot {
      position: absolute; inset: 0; border-radius: 50%; opacity: 0.82;
    }
  `;
  document.head.appendChild(s);
}

// ── City → [lat, lng] ────────────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  // Dubai
  'dubai':                   [25.2048, 55.2708],
  '迪拜':                    [25.2048, 55.2708],
  'downtown dubai':          [25.1972, 55.2744],
  'business bay':            [25.1888, 55.2726],
  'dubai marina':            [25.0769, 55.1342],
  'marina':                  [25.0769, 55.1342],
  'jbr':                     [25.0753, 55.1334],
  'jumeirah beach residence':[25.0753, 55.1334],
  'jumeirah':                [25.2048, 55.2508],
  'bur dubai':               [25.2544, 55.2914],
  'deira':                   [25.2697, 55.3095],
  'al barsha':               [25.1166, 55.2009],
  'al quoz':                 [25.1555, 55.2270],
  'palm jumeirah':           [25.1121, 55.1390],
  'silicon oasis':           [25.1205, 55.3786],
  'dubai silicon oasis':     [25.1205, 55.3786],
  'mirdif':                  [25.2268, 55.4131],
  'international city':      [25.1668, 55.4133],
  'al nahda':                [25.2826, 55.3626],
  'al qusais':               [25.2733, 55.3809],
  'karama':                  [25.2373, 55.2981],
  'jlt':                     [25.0695, 55.1422],
  'jumeirah lake towers':    [25.0695, 55.1422],
  'difc':                    [25.2100, 55.2814],
  'media city':              [25.0949, 55.1581],
  'dubai sports city':       [25.0447, 55.2231],
  'al warqa':                [25.2185, 55.4012],
  'dubai hills':             [25.1350, 55.2450],
  'town square':             [24.9965, 55.2418],
  'dubai south':             [24.8968, 55.1638],
  // Abu Dhabi
  'abu dhabi':               [24.4539, 54.3773],
  'abu-dhabi':               [24.4539, 54.3773],
  'abudhabi':                [24.4539, 54.3773],
  '阿布扎比':                [24.4539, 54.3773],
  'al ain':                  [24.2075, 55.7447],
  'al-ain':                  [24.2075, 55.7447],
  '艾因':                    [24.2075, 55.7447],
  'khalifa city':            [24.4215, 54.6092],
  'yas island':              [24.4888, 54.6091],
  'al reem island':          [24.4889, 54.4046],
  'saadiyat island':         [24.5420, 54.4350],
  'mussafah':                [24.3615, 54.4990],
  // Sharjah
  'sharjah':                 [25.3463, 55.4209],
  '沙迦':                    [25.3463, 55.4209],
  '夏尔迦':                  [25.3463, 55.4209],
  'khor fakkan':             [25.3389, 56.3558],
  'kalba':                   [25.0712, 56.3641],
  // Ajman
  'ajman':                   [25.4052, 55.5136],
  '阿治曼':                  [25.4052, 55.5136],
  // UAQ
  'umm al quwain':           [25.5648, 55.5554],
  'umm al-quwain':           [25.5648, 55.5554],
  'uaq':                     [25.5648, 55.5554],
  '乌姆盖万':                [25.5648, 55.5554],
  // RAK
  'ras al khaimah':          [25.7895, 55.9432],
  'ras al-khaimah':          [25.7895, 55.9432],
  'rak':                     [25.7895, 55.9432],
  '哈伊马角':                [25.7895, 55.9432],
  '莱斯海玛':                [25.7895, 55.9432],
  // Fujairah
  'fujairah':                [25.1288, 56.3265],
  '富查伊拉':                [25.1288, 56.3265],
  'dibba':                   [25.6196, 56.2694],
};

function cityCoords(city: string): [number, number] | null {
  return CITY_COORDS[city.toLowerCase().trim()] ?? null;
}

// ── Layer config ──────────────────────────────────────────────────────────
const LAYERS = [
  { key: 'visitor',   label: '访客',   color: '#3b82f6', delay: '0s'    },
  { key: 'company',   label: '装企',   color: '#B8864A', delay: '0.55s' },
  { key: 'homeowner', label: '业主',   color: '#22c55e', delay: '1.1s'  },
  { key: 'inquiry',   label: '询盘',   color: '#f97316', delay: '1.65s' },
] as const;

function makePingIcon(color: string, radius: number, delay: string): L.DivIcon {
  const size = radius * 2;
  return L.divIcon({
    className: '',
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [radius, radius] as L.PointExpression,
    html: `
      <div style="position:relative;width:${size}px;height:${size}px">
        <div class="map-ping-ring" style="background:${color};animation-delay:${delay}"></div>
        <div class="map-ping-dot"  style="background:${color}"></div>
      </div>`,
  });
}

// ── Right-panel helpers ───────────────────────────────────────────────────
const EMIRATE_DISTANCE_KM: Record<string, number> = {
  'Dubai': 0, 'Sharjah': 25, 'Ajman': 40, 'UAQ': 80,
  'RAK': 115, 'Fujairah': 125, 'Abu Dhabi': 140,
};
const CITY_TO_EMIRATE: Record<string, string> = {
  'abu dhabi': 'Abu Dhabi', 'abu-dhabi': 'Abu Dhabi', 'abudhabi': 'Abu Dhabi',
  'al ain': 'Abu Dhabi', 'al-ain': 'Abu Dhabi', '阿布扎比': 'Abu Dhabi',
  'dubai': 'Dubai', 'deira': 'Dubai', 'bur dubai': 'Dubai', 'jumeirah': 'Dubai',
  'jbr': 'Dubai', 'downtown dubai': 'Dubai', '迪拜': 'Dubai',
  'business bay': 'Dubai', 'dubai marina': 'Dubai', 'al barsha': 'Dubai',
  'difc': 'Dubai', 'silicon oasis': 'Dubai', 'mirdif': 'Dubai',
  'sharjah': 'Sharjah', 'khor fakkan': 'Sharjah', 'kalba': 'Sharjah',
  '沙迦': 'Sharjah', '夏尔迦': 'Sharjah',
  'ajman': 'Ajman', '阿治曼': 'Ajman',
  'umm al quwain': 'UAQ', 'umm al-quwain': 'UAQ', 'uaq': 'UAQ',
  'ras al khaimah': 'RAK', 'ras al-khaimah': 'RAK', 'rak': 'RAK',
  '哈伊马角': 'RAK',
  'fujairah': 'Fujairah', 'dibba': 'Fujairah', '富查伊拉': 'Fujairah',
};
function mapToEmirate(city: string) { return CITY_TO_EMIRATE[city.toLowerCase().trim()] ?? null; }
function distanceColor(km: number) { return km < 40 ? '#22c55e' : km < 100 ? '#f59e0b' : '#f97316'; }

const UAE_BOUNDS = L.latLngBounds([22.6, 51.5], [26.2, 56.5]);

export default function UAEMapLeaflet({
  companyCities,
  inquiryCities,
  visitorCities,
  homeownerCities = [],
  companyTypeCities = [],
}: UAEMapLeafletProps) {
  const { lang } = useAdminT();
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    ensurePingStyle();
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      zoomControl:        true,
      scrollWheelZoom:    true,   // ← 滚轮缩放开启
      attributionControl: true,
    });
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);
    map.fitBounds(UAE_BOUNDS, { padding: [24, 24] });
    mapRef.current = map;
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const datasets: Record<string, CityData[]> = {
      visitor:   visitorCities,
      company:   companyCities,
      homeowner: homeownerCities,
      inquiry:   inquiryCities,
    };

    const allCounts = Object.values(datasets).flatMap(arr => arr.map(d => d.count));
    const maxCount  = Math.max(...allCounts, 1);

    for (const layer of LAYERS) {
      const data = datasets[layer.key] ?? [];
      for (const { city, count } of data) {
        const coords = cityCoords(city);
        if (!coords) continue;
        const radius  = Math.max(5, Math.sqrt(count / maxCount) * 36);
        const marker  = L.marker(coords, {
          icon: makePingIcon(layer.color, radius, layer.delay),
          interactive: true,
        });
        marker.bindTooltip(
          `<div style="font-size:12px;min-width:90px">
             <div style="font-weight:700;margin-bottom:3px">${city}</div>
             <div style="display:flex;justify-content:space-between;gap:10px">
               <span style="color:#6b6b6b">${layer.label}</span>
               <span style="font-weight:700;color:${layer.color}">${count}</span>
             </div>
           </div>`,
          { sticky: false, direction: 'top', offset: [0, -radius - 2] }
        );
        marker.addTo(map);
        markersRef.current.push(marker);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, companyCities, inquiryCities, visitorCities, homeownerCities]);

  const topInquiryCities = inquiryCities.slice(0, 8);
  const maxInquiry = topInquiryCities[0]?.count || 1;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#2c2c2c]">地理分布</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">装企 · 询盘 · 访客 · 业主</p>
        </div>
        <div className="flex items-center gap-3">
          {LAYERS.map(l => (
            <span key={l.key} className="flex items-center gap-1 text-[10px] text-[#6b6b6b]">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0">
        <div className="flex-1 min-w-0 border-r border-stone-100 relative" style={{ minHeight: 480 }}>
          <div ref={mapDivRef} className="absolute inset-0" />
        </div>

        <div className="w-[268px] shrink-0 flex flex-col overflow-y-auto">
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
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C8975A,#B8864A)' }} />
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

          <div className="px-4 pt-4 pb-4 flex-1">
            <div className="text-[11px] font-bold text-[#2c2c2c] mb-0.5">询盘客分布</div>
            <div className="text-[10px] text-[#6b6b6b] mb-3 flex items-center gap-2">
              <span>来源城市</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e]" /><span>&lt;40km</span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#f59e0b] ml-1" /><span>&lt;100km</span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#f97316] ml-1" /><span>远</span>
              </span>
            </div>
            {topInquiryCities.length === 0 ? (
              <div className="text-[11px] text-stone-400 py-2">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {topInquiryCities.map((ic) => {
                  const emirate = mapToEmirate(ic.city);
                  const km = emirate ? (EMIRATE_DISTANCE_KM[emirate] ?? null) : null;
                  const barPct = (ic.count / maxInquiry) * 100;
                  return (
                    <div key={ic.city} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0"
                           style={{ background: km !== null ? distanceColor(km) : '#d4d4d4' }} />
                      <span className="text-[11px] text-[#2c2c2c] w-[64px] shrink-0 truncate">{ic.city}</span>
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${barPct}%`, background: km !== null ? distanceColor(km) : '#B8864A', opacity: 0.75 }} />
                      </div>
                      <span className="text-[10px] font-semibold text-[#6b6b6b] w-[26px] text-right shrink-0">{ic.count}</span>
                      {km !== null && (
                        <span className="text-[9px] text-[#9a9a9a] w-[32px] shrink-0">
                          {km === 0 ? '市内' : `${km}km`}
                        </span>
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
