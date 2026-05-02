// gold-only single-color v3
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

const GOLD = '#B8864A';
const gA = (a: number) => `rgba(184,134,74,${a})`;

const STYLE_ID = 'uae-map-ping-style';
function ensurePingStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes map-ping {
      0%   { transform:scale(1);  opacity:0.6; }
      80%  { transform:scale(1.9);opacity:0.08; }
      100% { transform:scale(2.2);opacity:0;   }
    }
    .map-ping-ring { position:absolute;inset:0;border-radius:50%;animation:map-ping 2.4s ease-out infinite; }
    .map-ping-dot  { position:absolute;inset:0;border-radius:50%; }
  `;
  document.head.appendChild(s);
}

const CITY_COORDS: Record<string, [number, number]> = {
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
  'sharjah':                 [25.3463, 55.4209],
  '沙迦':                    [25.3463, 55.4209],
  '夏尔迦':                  [25.3463, 55.4209],
  'khor fakkan':             [25.3389, 56.3558],
  'kalba':                   [25.0712, 56.3641],
  'ajman':                   [25.4052, 55.5136],
  '阿治曼':                  [25.4052, 55.5136],
  'umm al quwain':           [25.5648, 55.5554],
  'umm al-quwain':           [25.5648, 55.5554],
  'uaq':                     [25.5648, 55.5554],
  '乌姆盖万':                [25.5648, 55.5554],
  'ras al khaimah':          [25.7895, 55.9432],
  'ras al-khaimah':          [25.7895, 55.9432],
  'rak':                     [25.7895, 55.9432],
  '哈伊马角':                [25.7895, 55.9432],
  '莱斯海玛':                [25.7895, 55.9432],
  'fujairah':                [25.1288, 56.3265],
  '富查伊拉':                [25.1288, 56.3265],
  'dibba':                   [25.6196, 56.2694],
};

interface AggCity {
  city: string; key: string; coords: [number, number];
  visitor: number; company: number; homeowner: number; inquiry: number; total: number;
}

function aggregateCities(
  vC: CityData[], cC: CityData[], hC: CityData[], iC: CityData[]
): AggCity[] {
  const m = new Map<string, AggCity>();
  const add = (data: CityData[], field: 'visitor'|'company'|'homeowner'|'inquiry') => {
    for (const { city, count } of data) {
      const k = city.toLowerCase().trim();
      const coords = CITY_COORDS[k];
      if (!coords) continue;
      let e = m.get(k);
      if (!e) { e = { city, key: k, coords, visitor:0, company:0, homeowner:0, inquiry:0, total:0 }; m.set(k, e); }
      e[field] += count;
      e.total += count;
    }
  };
  add(vC, 'visitor'); add(cC, 'company'); add(hC, 'homeowner'); add(iC, 'inquiry');
  return [...m.values()].sort((a, b) => b.total - a.total);
}

function makeBubbleIcon(radius: number): L.DivIcon {
  const sz = radius * 2;
  return L.divIcon({
    className: '', iconSize:[sz, sz], iconAnchor:[radius, radius],
    html: `<div style="position:relative;width:${sz}px;height:${sz}px">
      <div class="map-ping-ring" style="background:${gA(0.25)}"></div>
      <div class="map-ping-dot"  style="background:${GOLD}"></div>
    </div>`,
  });
}

function makeCardIcon(city: AggCity, side: 'left'|'right'): L.DivIcon {
  const W = 152;
  const rs = `display:flex;justify-content:space-between;font-size:11px;color:#6b6b6b;line-height:1.85`;
  const vs = `font-weight:700;color:${GOLD}`;
  const rows: string[] = [];
  if (city.visitor)   rows.push(`<div style="${rs}"><span>访客</span><span style="${vs}">${city.visitor}</span></div>`);
  if (city.company)   rows.push(`<div style="${rs}"><span>装企</span><span style="${vs}">${city.company}</span></div>`);
  if (city.homeowner) rows.push(`<div style="${rs}"><span>业主</span><span style="${vs}">${city.homeowner}</span></div>`);
  if (city.inquiry)   rows.push(`<div style="${rs}"><span>询盘</span><span style="${vs}">${city.inquiry}</span></div>`);
  return L.divIcon({
    className: '',
    iconSize: [W, 0],
    iconAnchor: [side === 'left' ? W : 0, CARD_H / 2],
    html: `<div style="background:white;border:1.5px solid ${gA(0.28)};border-radius:10px;padding:9px 12px;width:${W}px;box-shadow:0 4px 16px ${gA(0.18)};pointer-events:none">
      <div style="font-weight:700;font-size:13px;color:#2c2c2c;padding-bottom:4px;margin-bottom:4px;border-bottom:1px solid ${gA(0.15)}">${city.city}</div>
      ${rows.join('')}
      <div style="margin-top:4px;padding-top:4px;border-top:1px solid ${gA(0.12)};display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:#9b9b9b">合计</span>
        <span style="font-size:13px;font-weight:700;color:${GOLD}">${city.total}</span>
      </div>
    </div>`,
  });
}

const UAE_BOUNDS    = L.latLngBounds([22.6, 51.5], [26.2, 56.5]);
const CARD_OFFSET_PX = 180;
const CARD_W         = 155;
const CARD_H         = 100; // estimated height for collision avoidance
const TOP_CALLOUT_N  = 5;

function cardSide(city: AggCity): 'left'|'right' {
  return city.coords[1] < 54.9 ? 'left' : 'right';
}

interface CardRect { x: number; y: number; w: number; h: number; side: 'left'|'right'; }

function computeCardLayout(
  map: L.Map,
  topCities: { city: AggCity; side: 'left'|'right' }[]
): { anchorPt: L.Point; bubbleLL: L.LatLng }[] {
  const rects: CardRect[] = topCities.map(({ city, side }) => {
    const bPt = map.latLngToContainerPoint(L.latLng(city.coords));
    const ax  = bPt.x + (side === 'left' ? -CARD_OFFSET_PX : CARD_OFFSET_PX);
    const x   = side === 'left' ? ax - CARD_W : ax;
    const y   = bPt.y - CARD_H / 2;
    return { x, y, w: CARD_W, h: CARD_H, side };
  });

  // Iterative push-apart: resolve overlaps in y-axis
  const GAP = 8;
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (!(a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x)) continue;
        const aCY = a.y + a.h / 2, bCY = b.y + b.h / 2;
        const overlap = (a.h + b.h) / 2 + GAP - Math.abs(bCY - aCY);
        if (overlap <= 0) continue;
        const half = overlap / 2;
        if (aCY <= bCY) { a.y -= half; b.y += half; }
        else            { a.y += half; b.y -= half; }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return rects.map((r, i) => ({
    anchorPt: L.point(r.side === 'left' ? r.x + r.w : r.x, r.y + r.h / 2),
    bubbleLL: L.latLng(topCities[i].city.coords),
  }));
}

const EMIRATE_DISTANCE_KM: Record<string, number> = {
  'Dubai': 0, 'Sharjah': 25, 'Ajman': 40, 'UAQ': 80, 'RAK': 115, 'Fujairah': 125, 'Abu Dhabi': 140,
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
  'ras al khaimah': 'RAK', 'ras al-khaimah': 'RAK', 'rak': 'RAK', '哈伊马角': 'RAK',
  'fujairah': 'Fujairah', 'dibba': 'Fujairah', '富查伊拉': 'Fujairah',
};
function mapToEmirate(city: string) { return CITY_TO_EMIRATE[city.toLowerCase().trim()] ?? null; }
function distanceColor(km: number) { return km < 40 ? '#22c55e' : km < 100 ? '#f59e0b' : '#f97316'; }

export default function UAEMapLeaflet({
  companyCities, inquiryCities, visitorCities, homeownerCities = [], companyTypeCities = [],
}: UAEMapLeafletProps) {
  const { lang } = useAdminT();
  const mapDivRef      = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const markersRef     = useRef<L.Marker[]>([]);
  const cardMarkersRef = useRef<L.Marker[]>([]);
  const leaderLinesRef = useRef<L.Polyline[]>([]);
  const topCitiesRef   = useRef<{ city: AggCity; side: 'left'|'right' }[]>([]);
  const [mapReady, setMapReady] = useState(false);

  function syncCallouts(map: L.Map) {
    if (!topCitiesRef.current.length) return;
    const layout = computeCardLayout(map, topCitiesRef.current);
    layout.forEach(({ anchorPt, bubbleLL }, i) => {
      const cLL = map.containerPointToLatLng(anchorPt);
      cardMarkersRef.current[i]?.setLatLng(cLL);
      leaderLinesRef.current[i]?.setLatLngs([bubbleLL, cLL]);
    });
  }

  useEffect(() => {
    ensurePingStyle();
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, { zoomControl:true, scrollWheelZoom:true, attributionControl:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    map.fitBounds(UAE_BOUNDS, { padding:[24, 24] });
    mapRef.current = map;
    const handler = () => syncCallouts(map);
    map.on('moveend', handler).on('zoomend', handler);
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    [...markersRef.current, ...cardMarkersRef.current].forEach(m => map.removeLayer(m));
    leaderLinesRef.current.forEach(l => map.removeLayer(l));
    markersRef.current = []; cardMarkersRef.current = []; leaderLinesRef.current = [];

    const agg  = aggregateCities(visitorCities, companyCities, homeownerCities, inquiryCities);
    const maxT = Math.max(...agg.map(c => c.total), 1);

    for (const city of agg) {
      const r = Math.max(4, Math.sqrt(city.total / maxT) * 18);
      const m = L.marker(city.coords, { icon: makeBubbleIcon(r), zIndexOffset: Math.round(city.total) });
      m.bindTooltip(`<b>${city.city}</b>: ${city.total}`, { sticky:true, direction:'top' });
      m.addTo(map);
      markersRef.current.push(m);
    }

    const topCities = agg.slice(0, TOP_CALLOUT_N).map(city => ({ city, side: cardSide(city) }));
    topCitiesRef.current = topCities;

    // Create markers at placeholder positions; syncCallouts will apply collision-resolved positions
    for (let i = 0; i < topCities.length; i++) {
      const { city, side } = topCities[i];
      const bLL = L.latLng(city.coords);
      leaderLinesRef.current.push(
        L.polyline([bLL, bLL], { color: GOLD, weight: 1.2, opacity: 0.45 }).addTo(map)
      );
      cardMarkersRef.current.push(
        L.marker(bLL, { icon: makeCardIcon(city, side), interactive: false, zIndexOffset: 2000 }).addTo(map)
      );
    }
    // Apply collision-avoided positions immediately
    syncCallouts(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, companyCities, inquiryCities, visitorCities, homeownerCities]);

  const topInquiryCities = inquiryCities.slice(0, 8);
  const maxInquiry = topInquiryCities[0]?.count || 1;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#2c2c2c]">地理分布</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">城市综合热度 · 气泡大小代表活跃度</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: GOLD }} />
          <span className="text-[10px] text-[#6b6b6b]">访客 · 装企 · 业主 · 询盘</span>
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
                             style={{ width: `${barPct}%`, background: km !== null ? distanceColor(km) : GOLD, opacity: 0.75 }} />
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
