// gold-only single-color v4
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';
import { labelCompanyType } from '../../lib/companyTypeLabel';
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
      0%   { transform:scale(0.6); opacity:0.85; }
      60%  { transform:scale(2.2); opacity:0.18; }
      100% { transform:scale(2.8); opacity:0;    }
    }
    .map-ping-ring {
      position:absolute; inset:0; border-radius:50%;
      animation:map-ping 2.4s cubic-bezier(0.25,0,0.4,1) infinite;
      will-change:transform,opacity;
    }
    .map-ping-ring-2 { animation-delay:1.2s; }
    .map-ping-dot {
      position:absolute; inset:0; border-radius:50%;
      will-change:transform;
    }
    .uae-card-wrap {
      cursor:grab; user-select:none; transition:box-shadow 0.15s;
    }
    .uae-card-wrap:active { cursor:grabbing; }
    .leaflet-marker-draggable.leaflet-marker-dragging .uae-card-wrap {
      box-shadow:0 4px 12px rgba(0,0,0,0.18),0 16px 40px rgba(184,134,74,0.28),0 0 0 1.5px rgba(184,134,74,0.5);
    }
    /* "+N" delta toast popping up above a row when new entity registers */
    @keyframes map-delta-toast {
      0%   { transform:translateY(0)    scale(0.6); opacity:0; }
      15%  { transform:translateY(-4px) scale(1);   opacity:1; }
      75%  { transform:translateY(-22px) scale(1);  opacity:1; }
      100% { transform:translateY(-32px) scale(0.95); opacity:0; }
    }
    .map-delta-toast {
      display:inline-flex; align-items:center; gap:3px;
      background:linear-gradient(135deg,#D4A05A,#B8864A);
      color:white; padding:3px 9px; border-radius:12px;
      font-size:11px; font-weight:700; line-height:1.4;
      box-shadow:0 4px 10px rgba(184,134,74,0.45),0 0 0 1px rgba(255,255,255,0.18);
      white-space:nowrap;
      /* fill-mode: both → during stagger delay, show 0% keyframe (opacity:0); after, show 100% (also opacity:0). Avoids flicker. */
      animation:map-delta-toast 2.4s cubic-bezier(0.2,0.7,0.3,1) both;
    }
    /* Subtle highlight while a value is rolling */
    @keyframes map-num-flash {
      0%, 100% { background:transparent; }
      30%      { background:rgba(184,134,74,0.18); }
    }
    .map-num-rolling {
      animation:map-num-flash 0.7s ease-out;
      border-radius:3px;
      padding:0 2px;
      margin:0 -2px;
    }
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

const HAS_CJK = /[一-鿿]/;

function aggregateCities(
  vC: CityData[], cC: CityData[], hC: CityData[], iC: CityData[]
): AggCity[] {
  const m = new Map<string, AggCity>();
  const add = (data: CityData[], field: 'visitor'|'company'|'homeowner'|'inquiry') => {
    for (const { city, count } of data) {
      const lower = city.toLowerCase().trim();
      const coords = CITY_COORDS[lower];
      if (!coords) continue;
      // Canonicalize by coordinate so "Dubai" + "迪拜" merge into one entry
      const k = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
      let e = m.get(k);
      if (!e) {
        e = { city, key: k, coords, visitor:0, company:0, homeowner:0, inquiry:0, total:0 };
        m.set(k, e);
      } else if (HAS_CJK.test(city) && !HAS_CJK.test(e.city)) {
        // Prefer Chinese display name when both variants seen
        e.city = city;
      }
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
      <div class="map-ping-ring" style="background:${gA(0.42)}"></div>
      <div class="map-ping-ring map-ping-ring-2" style="background:${gA(0.28)}"></div>
      <div class="map-ping-dot" style="background:${gA(0.5)}"></div>
    </div>`,
  });
}

// Per-card geometry.
//   总计 = 装企+业主+询盘（去掉访客噪声）→ "转化"
//   装企/业主/询盘 = 主行（gold）；访客 = 参考行（muted gray + dashed separator）
const CARD_W            = 156;
const ROW_PX            = 17;   // primary row: line-height 1.55 * 10.5px ≈ 16.3, round to 17
const VISITOR_FOOTER_PX = 14;   // visitor row: line-height 1.55 * 9.5px ≈ 14.7, round to 14
const SEPARATOR_PX      = 5;    // dashed top border + small margin
const HEAD_PX           = 30;   // rank + city + total + border/margin
const PAD_Y_PX          = 14;   // 7 top + 7 bottom

const conversionTotal = (c: AggCity) => c.company + c.homeowner + c.inquiry;

function cardRowCount(city: AggCity): number {
  // primary rows only (visitor is footer when conv > 0)
  return (city.company ? 1 : 0) + (city.homeowner ? 1 : 0) + (city.inquiry ? 1 : 0);
}
function cardHeight(city: AggCity, scale = 1): number {
  const conv = conversionTotal(city);
  const primary = cardRowCount(city);
  const hasVisitor = city.visitor > 0;
  let h: number;
  if (conv === 0 && hasVisitor) {
    h = HEAD_PX + ROW_PX + PAD_Y_PX;
  } else {
    const visitorBlock = hasVisitor ? SEPARATOR_PX + VISITOR_FOOTER_PX : 0;
    h = HEAD_PX + primary * ROW_PX + visitorBlock + PAD_Y_PX;
  }
  return h * scale;
}

function makeCardIcon(city: AggCity, side: 'left'|'right', rank: number, scale = 1): L.DivIcon {
  // iconSize/iconAnchor stay at unscaled values so leaflet's anchoring math is unaffected.
  // Visual scaling is done via CSS transform with origin at the anchor edge.
  const H = cardHeight(city, 1);
  const W = CARD_W;
  const conv = conversionTotal(city);
  const rs        = `display:flex;justify-content:space-between;font-size:10.5px;color:#4a4a4a;line-height:1.55`;
  const rsMuted   = `display:flex;justify-content:space-between;font-size:9.5px;color:#a3a3a3;line-height:1.55;border-top:1px dashed rgba(184,134,74,0.18);margin-top:3px;padding-top:2px`;
  const vs        = `font-weight:700;color:${GOLD};font-variant-numeric:tabular-nums`;
  const vsMuted   = `font-weight:500;color:#a3a3a3;font-variant-numeric:tabular-nums`;
  // data-field marks each numeric span so animateValue() can find it via querySelector
  const primarySpan = (field: string, n: number) => `<span style="${vs}" data-field="${field}">${n.toLocaleString()}</span>`;
  const mutedSpan   = (field: string, n: number) => `<span style="${vsMuted}" data-field="${field}">${n.toLocaleString()}</span>`;

  const rows: string[] = [];
  if (conv > 0) {
    if (city.company)   rows.push(`<div style="${rs}" data-row="company"><span>装企</span>${primarySpan('company', city.company)}</div>`);
    if (city.homeowner) rows.push(`<div style="${rs}" data-row="homeowner"><span>业主</span>${primarySpan('homeowner', city.homeowner)}</div>`);
    if (city.inquiry)   rows.push(`<div style="${rs}" data-row="inquiry"><span>询盘</span>${primarySpan('inquiry', city.inquiry)}</div>`);
    if (city.visitor)   rows.push(`<div style="${rsMuted}" data-row="visitor"><span>访客</span>${mutedSpan('visitor', city.visitor)}</div>`);
  } else if (city.visitor) {
    // Degraded: pure-visitor card (no real conversion yet) — show visitor in primary style
    rows.push(`<div style="${rs}" data-row="visitor"><span>访客</span>${primarySpan('visitor', city.visitor)}</div>`);
  }

  // Header total: real conversion total, or visitor count if degraded
  const headerNum   = conv > 0 ? conv : city.visitor;
  const headerLabel = conv > 0 ? '转化' : '访客';

  // Visual scale: keep anchor edge fixed (right for left-side card, left for right-side).
  // origin uses "center" vertically so the card grows symmetrically up/down — matches iconAnchor at H/2.
  const transformOrigin = side === 'left' ? 'right center' : 'left center';
  const transform = scale !== 1 ? `transform:scale(${scale});transform-origin:${transformOrigin};` : '';
  return L.divIcon({
    className: '',
    iconSize: [W, H],
    iconAnchor: [side === 'left' ? W : 0, H / 2],
    html: `<div class="uae-card-wrap" data-side="${side}" style="background:white;border-radius:8px;padding:7px 10px;width:${CARD_W}px;${transform}
      box-shadow:0 2px 4px rgba(0,0,0,0.06),0 6px 18px ${gA(0.14)},0 0 0 1px ${gA(0.22)}">
      <div style="display:flex;align-items:center;gap:5px;padding-bottom:4px;margin-bottom:3px;border-bottom:1px solid ${gA(0.12)}">
        <span style="font-size:9px;font-weight:800;color:white;background:${GOLD};border-radius:3px;padding:1px 4px;line-height:1.4;flex-shrink:0">#${rank}</span>
        <span style="font-weight:700;font-size:12.5px;color:#1a1a1a;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${city.city}</span>
        <span style="font-size:9px;color:#9b9b9b;margin-right:2px;flex-shrink:0">${headerLabel}</span>
        <span style="font-size:12.5px;font-weight:800;color:${GOLD};font-variant-numeric:tabular-nums;flex-shrink:0" data-field="total">${headerNum.toLocaleString()}</span>
      </div>
      ${rows.join('')}
    </div>`,
  });
}

const UAE_BOUNDS    = L.latLngBounds([22.3, 51.5], [26.5, 56.8]);
// 海湾六国 (GCC: 沙特/UAE/卡塔尔/巴林/科威特/阿曼) — 全屏时拉宽视野
const GCC_BOUNDS    = L.latLngBounds([20.5, 46], [30.8, 60]);
const CARD_OFFSET_PX = 180;
const TOP_CALLOUT_N  = 5;

function cardSide(city: AggCity): 'left'|'right' {
  return city.coords[1] < 54.9 ? 'left' : 'right';
}

interface CardRect { x: number; y: number; w: number; h: number; side: 'left'|'right'; }

// Place cards left/right of bubbles, then iteratively push-apart in y. If a side is
// too crowded (cards push past the map edge), reassign the lowest-rank crowded card
// to the opposite side. Final positions are clamped inside the map viewport.
function computeCardLayout(
  map: L.Map,
  topCities: { city: AggCity; side: 'left'|'right' }[],
  scale = 1,
): { anchorPt: L.Point; bubbleLL: L.LatLng; cardSide: 'left'|'right' }[] {
  const sz = map.getSize();
  const sides: ('left'|'right')[] = topCities.map(t => t.side);
  const cardW = CARD_W * scale;
  const offset = CARD_OFFSET_PX * scale;

  function buildRects(): CardRect[] {
    const rects = topCities.map(({ city }, i) => {
      const side = sides[i];
      const h    = cardHeight(city, scale);
      const bPt  = map.latLngToContainerPoint(L.latLng(city.coords));
      const ax   = bPt.x + (side === 'left' ? -offset : offset);
      const x    = side === 'left' ? ax - cardW : ax;
      const y    = bPt.y - h / 2;
      return { x, y, w: cardW, h, side };
    });
    // Column-align cards on the same side: pick the x closest to map content
    // (right side → min x, left side → max x). When a side has only 1 card,
    // it stays at its natural x. Dragged cards' computed x is discarded by
    // the caller, so user drags survive this alignment.
    for (const side of ['left', 'right'] as const) {
      const idxs: number[] = [];
      for (let i = 0; i < rects.length; i++) if (rects[i].side === side) idxs.push(i);
      if (idxs.length <= 1) continue;
      const xs = idxs.map(i => rects[i].x);
      const alignedX = side === 'right' ? Math.min(...xs) : Math.max(...xs);
      for (const i of idxs) rects[i].x = alignedX;
    }
    return rects;
  }
  function resolveOverlaps(rects: CardRect[]) {
    // Within each side group: sort by y, cascade-down so each card sits below the
    // previous (no y-overlap), then shift the whole stack up if its bottom overflows
    // the map. Deterministic, single pass — replaces the iterative push-apart that
    // could oscillate for >2 cards on the same column.
    const GAP = 8;
    const M   = 16;
    const isFs = scale > 1;
    for (const side of ['left', 'right'] as const) {
      const idxs: number[] = [];
      for (let i = 0; i < rects.length; i++) if (rects[i].side === side) idxs.push(i);
      if (idxs.length <= 1) continue;
      idxs.sort((a, b) => rects[a].y - rects[b].y);
      for (let i = 1; i < idxs.length; i++) {
        const prev = rects[idxs[i-1]], cur = rects[idxs[i]];
        const minY = prev.y + prev.h + GAP;
        if (cur.y < minY) cur.y = minY;
      }
      const first = rects[idxs[0]];
      const last  = rects[idxs[idxs.length - 1]];
      // Fullscreen: center stack slightly above viewport middle (≈42% from top)
      // so it doesn't crowd map dots near center yet still feels balanced.
      if (isFs) {
        const stackH = (last.y + last.h) - first.y;
        const desiredFirstY = Math.max(M, sz.y * 0.42 - stackH / 2);
        const shift = first.y - desiredFirstY;
        if (Math.abs(shift) > 0.5) for (const i of idxs) rects[i].y -= shift;
      } else {
        const overflowBottom = (last.y + last.h) - (sz.y - M);
        if (overflowBottom > 0) {
          const shift = Math.min(overflowBottom, first.y - M);
          if (shift > 0) for (const i of idxs) rects[i].y -= shift;
        }
      }
    }
  }
  function totalSpan(rects: CardRect[], side: 'left'|'right') {
    const own = rects.filter(r => r.side === side);
    if (!own.length) return 0;
    return own.reduce((s, r) => s + r.h + 8, -8);
  }

  let rects = buildRects();
  resolveOverlaps(rects);

  // If one side overflows the map height, flip the lowest-priority card on that
  // side to the other side and retry, until both sides fit (or we've tried all).
  const mapH = sz.y;
  for (let i = topCities.length - 1; i >= 0 && (totalSpan(rects, 'left') > mapH || totalSpan(rects, 'right') > mapH); i--) {
    const overSide = totalSpan(rects, 'right') > totalSpan(rects, 'left') ? 'right' : 'left';
    if (sides[i] !== overSide) continue;
    sides[i] = overSide === 'right' ? 'left' : 'right';
    rects = buildRects();
    resolveOverlaps(rects);
  }

  // Note: resolveOverlaps already handles top/bottom overflow by shifting the
  // whole same-side stack up (capped by margin). Don't re-clamp individual cards
  // here — that would re-introduce overlap when shift was capped.

  return rects.map((r, i) => ({
    anchorPt: L.point(r.side === 'left' ? r.x + r.w : r.x, r.y + r.h / 2),
    bubbleLL: L.latLng(topCities[i].city.coords),
    cardSide: r.side,
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

// Roll a numeric value from `from` to `to` over `ms` (cubic ease-out).
// Updates el.textContent and adds a brief flash class for visual emphasis.
function animateValue(el: HTMLElement, from: number, to: number, ms = 600) {
  const t0 = performance.now();
  el.classList.add('map-num-rolling');
  setTimeout(() => el.classList.remove('map-num-rolling'), 700);
  function frame(t: number) {
    const p = Math.min((t - t0) / ms, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.round(from + (to - from) * eased);
    el.textContent = v.toLocaleString();
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// "+N 标签" toast popping above a card row or bubble. Auto-cleans up after 2.4s.
const FIELD_LABEL: Record<string, string> = {
  visitor: '访客', company: '装企', homeowner: '业主', inquiry: '询盘', total: '合计',
};
function spawnDeltaToast(
  map: L.Map,
  anchorLL: L.LatLng,
  label: string,
  delta: number,
  yOffsetPx: number,    // pixels above the anchor
  delayMs = 0,          // stagger when multiple toasts fire in same paint
) {
  // animation-fill-mode:both in the CSS class handles invisibility during the delay phase
  const styleAttr = delayMs > 0 ? ` style="animation-delay:${delayMs}ms"` : '';
  const html = `<div class="map-delta-toast"${styleAttr}>${label} +${delta}</div>`;
  const icon = L.divIcon({
    className: '',
    iconSize: [80, 24],
    iconAnchor: [40, yOffsetPx],
    html,
  });
  const m = L.marker(anchorLL, { icon, interactive: false, zIndexOffset: 5000 }).addTo(map);
  // Total lifetime = delay + 2.4s animation
  setTimeout(() => { try { map.removeLayer(m); } catch { /* map may be gone */ } }, 2400 + delayMs);
}

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
  const cardSidesRef   = useRef<('left'|'right')[]>([]);
  const userMovedRef   = useRef<boolean[]>([]);  // per-index: true if user dragged
  const prevAggRef     = useRef<Map<string, AggCity>>(new Map());  // last seen agg, keyed by city.key
  const cardRef        = useRef<HTMLDivElement>(null);  // outer card for fullscreen
  const cardScaleRef   = useRef(1);                     // 1 normal, 1.5 fullscreen
  const [mapReady, setMapReady] = useState(false);
  const [isFs, setIsFs] = useState(false);

  // Fullscreen toggle + listener (ESC handled by browser)
  useEffect(() => {
    const onChange = () => {
      const inFs = document.fullscreenElement === cardRef.current;
      setIsFs(inFs);
      cardScaleRef.current = inFs ? 1.5 : 1;
      setTimeout(() => {
        mapRef.current?.invalidateSize();
        if (mapRef.current) {
          if (inFs) {
            // 全屏 → 沙迦 (Sharjah) 居中，比 GCC fit 再放大 2× (zoom+1)
            const gccZoom = mapRef.current.getBoundsZoom(GCC_BOUNDS, false);
            mapRef.current.setView([25.3463, 55.4209], gccZoom + 1, { animate: false });
          } else {
            mapRef.current.fitBounds(UAE_BOUNDS, { padding: [40, 40] });
          }
          // Re-render every card icon with new scale
          for (let i = 0; i < cardMarkersRef.current.length; i++) {
            const m = cardMarkersRef.current[i];
            const tc = topCitiesRef.current[i];
            const sd = cardSidesRef.current[i] ?? tc?.side ?? 'right';
            if (m && tc) m.setIcon(makeCardIcon(tc.city, sd, i + 1, cardScaleRef.current));
          }
          syncCallouts(mapRef.current);
        }
      }, 80);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleFullscreen() {
    if (!cardRef.current) return;
    if (document.fullscreenElement === cardRef.current) {
      document.exitFullscreen?.();
    } else {
      cardRef.current.requestFullscreen?.();
    }
  }

  // Update one leader line when its card moves (drag or auto-relayout)
  // 单根斜线：从 bubble 中心直连卡片中心。L 形折线在卡片列对齐时退化成水平段，
  // 看起来全水平不"指向"，所以改回斜线。
  function leaderPath(map: L.Map, bubbleLL: L.LatLng, cardLL: L.LatLng): L.LatLng[] {
    // If the natural straight line is shallower than 45°, insert a kink so the
    // segment hitting the bubble is at exactly 45° (more visually distinct than
    // a near-horizontal line, esp. for far-south cities like Abu Dhabi).
    const A = map.latLngToContainerPoint(cardLL);
    const B = map.latLngToContainerPoint(bubbleLL);
    const dx = B.x - A.x, dy = B.y - A.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (ady < 6 || ady >= adx) return [bubbleLL, cardLL];
    // Kink point: on the card's horizontal line, |dy| pixels away from bubble in x.
    const kx = B.x - Math.sign(dx) * ady;
    const kink = map.containerPointToLatLng(L.point(kx, A.y));
    return [bubbleLL, kink, cardLL];
  }

  function updateLeaderLine(map: L.Map, i: number) {
    const card = cardMarkersRef.current[i];
    const line = leaderLinesRef.current[i];
    if (!card || !line || !topCitiesRef.current[i]) return;
    const bubbleLL = L.latLng(topCitiesRef.current[i].city.coords);
    line.setLatLngs(leaderPath(map, bubbleLL, card.getLatLng()));
  }

  function syncCallouts(map: L.Map) {
    if (!topCitiesRef.current.length) return;
    const layout = computeCardLayout(map, topCitiesRef.current, cardScaleRef.current);
    layout.forEach(({ anchorPt, bubbleLL, cardSide: newSide }, i) => {
      // Skip cards user has dragged manually - keep their position
      if (userMovedRef.current[i]) {
        updateLeaderLine(map, i);
        return;
      }
      // If side flipped (auto-relayout chose other side), rebuild the icon so anchor is correct
      if (cardSidesRef.current[i] !== newSide) {
        cardSidesRef.current[i] = newSide;
        cardMarkersRef.current[i]?.setIcon(makeCardIcon(topCitiesRef.current[i].city, newSide, i + 1, cardScaleRef.current));
      }
      const cLL = map.containerPointToLatLng(anchorPt);
      cardMarkersRef.current[i]?.setLatLng(cLL);
      leaderLinesRef.current[i]?.setLatLngs(leaderPath(map, bubbleLL, cLL));
    });
  }

  useEffect(() => {
    ensurePingStyle();
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, { zoomControl:true, scrollWheelZoom:true, attributionControl:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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
      const r = Math.max(4, Math.sqrt(city.total / maxT) * 14);
      const m = L.marker(city.coords, { icon: makeBubbleIcon(r), zIndexOffset: Math.round(city.total) });
      m.bindTooltip(`<b>${city.city}</b>: ${city.total}`, { sticky:true, direction:'top' });
      m.addTo(map);
      markersRef.current.push(m);
    }

    const topCities = agg.slice(0, TOP_CALLOUT_N).map(city => ({ city, side: cardSide(city) }));
    topCitiesRef.current = topCities;
    cardSidesRef.current = topCities.map(t => t.side);
    userMovedRef.current = new Array(topCities.length).fill(false);

    // ─── Detect deltas vs last fetch (skip on first load) ─────────────────
    type Field = 'visitor'|'company'|'homeowner'|'inquiry';
    const FIELD_ORDER: Field[] = ['company', 'homeowner', 'inquiry', 'visitor'];
    interface CardDelta { rank: number; field: Field; from: number; to: number; delta: number; rowOffsetFromCenterPx: number; }
    interface BubbleDelta { aggIdx: number; field: Field; delta: number; city: AggCity; }
    const cardDeltas: CardDelta[] = [];
    const bubbleDeltas: BubbleDelta[] = [];
    // Map of rank → {from, to} for header total (conv-only or visitor in degraded mode)
    const headerDeltas = new Map<number, { from: number; to: number }>();

    // Compute the y-offset (from card center) for a given field, matching makeCardIcon's layout.
    // Returned in screen pixels — must match the *scaled* card so the toast lines up with the row.
    function fieldRowOffset(c: AggCity, field: Field): number | null {
      const conv = conversionTotal(c);
      const s = cardScaleRef.current;
      const cardH = cardHeight(c, s);
      if (conv === 0) {
        // Degraded: visitor is the only row, in primary position
        if (field === 'visitor' && c.visitor > 0) {
          return cardH / 2 - (HEAD_PX + ROW_PX / 2) * s;
        }
        return null;
      }
      let y = HEAD_PX;
      for (const f of ['company', 'homeowner', 'inquiry'] as const) {
        if (c[f] > 0) {
          if (f === field) return cardH / 2 - (y + ROW_PX / 2) * s;
          y += ROW_PX;
        }
      }
      if (field === 'visitor' && c.visitor > 0) {
        return cardH / 2 - (y + SEPARATOR_PX + VISITOR_FOOTER_PX / 2) * s;
      }
      return null;
    }

    const isFirstLoad = prevAggRef.current.size === 0;
    if (!isFirstLoad) {
      for (let i = 0; i < agg.length; i++) {
        const cur = agg[i];
        const prev = prevAggRef.current.get(cur.key);
        if (!prev) continue;
        const isTop = i < TOP_CALLOUT_N;
        for (const f of FIELD_ORDER) {
          if (cur[f] > prev[f]) {
            const delta = cur[f] - prev[f];
            if (isTop) {
              const off = fieldRowOffset(cur, f) ?? 0;
              cardDeltas.push({ rank: i, field: f, from: prev[f], to: cur[f], delta, rowOffsetFromCenterPx: off });
            } else {
              bubbleDeltas.push({ aggIdx: i, field: f, delta, city: cur });
            }
          }
        }
        // Header total: conv-mode shows conversionTotal; degraded shows visitor count
        if (isTop) {
          const prevConv = prev.company + prev.homeowner + prev.inquiry;
          const curConv = conversionTotal(cur);
          const prevHeader = prevConv > 0 ? prevConv : prev.visitor;
          const curHeader  = curConv > 0  ? curConv  : cur.visitor;
          if (prevHeader !== curHeader) {
            headerDeltas.set(i, { from: prevHeader, to: curHeader });
          }
        }
      }
    }
    // Store new aggregation for next comparison
    prevAggRef.current = new Map(agg.map(c => [c.key, c]));

    // Create markers at placeholder positions; syncCallouts will apply collision-resolved positions
    for (let i = 0; i < topCities.length; i++) {
      const { city, side } = topCities[i];
      const bLL = L.latLng(city.coords);
      leaderLinesRef.current.push(
        L.polyline([bLL, bLL], { color: GOLD, weight: 0.8, opacity: 0.3 }).addTo(map)
      );
      const idx = i;
      const cardMarker = L.marker(bLL, {
        icon: makeCardIcon(city, side, idx + 1, cardScaleRef.current),
        draggable: true,
        zIndexOffset: 2000,
      })
        .on('dragstart', () => { userMovedRef.current[idx] = true; })
        .on('drag',      () => { updateLeaderLine(map, idx); })
        .on('dragend',   () => { updateLeaderLine(map, idx); })
        .addTo(map);
      cardMarkersRef.current.push(cardMarker);
    }
    // Apply collision-avoided positions immediately
    syncCallouts(map);

    // ─── Trigger animations (next paint, after DOM is in place) ───────────
    if (cardDeltas.length || bubbleDeltas.length) {
      // Group card deltas by rank so total only rolls once per card.
      const byRank = new Map<number, CardDelta[]>();
      for (const d of cardDeltas) {
        const arr = byRank.get(d.rank) ?? [];
        arr.push(d);
        byRank.set(d.rank, arr);
      }
      requestAnimationFrame(() => {
        // Stagger toasts globally: each toast 150ms after previous
        const STAGGER_MS = 150;
        let toastIdx = 0;

        // Top cities: animate card row + spawn toast above the row
        byRank.forEach((fieldDeltas, rank) => {
          const cardMarker = cardMarkersRef.current[rank];
          const el = cardMarker?.getElement();
          if (!cardMarker || !el) return;
          for (const d of fieldDeltas) {
            const fieldEl = el.querySelector(`[data-field="${d.field}"]`);
            if (fieldEl instanceof HTMLElement) animateValue(fieldEl, d.from, d.to, 600);
            spawnDeltaToast(map, cardMarker.getLatLng(), FIELD_LABEL[d.field] ?? d.field, d.delta, d.rowOffsetFromCenterPx + 32, toastIdx++ * STAGGER_MS);
          }
          // Header total animation uses headerDeltas (conv-only, or visitor in degraded mode)
          const headerDelta = headerDeltas.get(rank);
          const totalEl = el.querySelector('[data-field="total"]');
          if (totalEl instanceof HTMLElement && headerDelta) {
            animateValue(totalEl, headerDelta.from, headerDelta.to, 600);
          }
        });
        // Non-top cities: toast above the bubble with city name + field
        for (const d of bubbleDeltas) {
          const bubble = markersRef.current[d.aggIdx];
          if (!bubble) continue;
          const label = `${d.city.city} · ${FIELD_LABEL[d.field] ?? d.field}`;
          spawnDeltaToast(map, bubble.getLatLng(), label, d.delta, 24, toastIdx++ * STAGGER_MS);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, companyCities, inquiryCities, visitorCities, homeownerCities]);

  const topInquiryCities = inquiryCities.slice(0, 8);
  const maxInquiry = topInquiryCities[0]?.count || 1;

  return (
    <div
      ref={cardRef}
      className={`bg-white border border-stone-200 shadow-sm overflow-hidden ${isFs ? '' : 'rounded-2xl'}`}
      style={isFs ? { display: 'flex', flexDirection: 'column', height: '100vh' } : undefined}
    >
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-white shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[#2c2c2c]">地理分布</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">城市综合热度 · 气泡大小代表活跃度</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: GOLD }} />
            <span className="text-[10px] text-[#6b6b6b]">访客 · 装企 · 业主 · 询盘</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 hover:text-[#B8864A] transition"
            title={isFs ? '退出全屏 (ESC)' : '全屏查看'}
            aria-label={isFs ? '退出全屏' : '全屏查看'}
          >
            {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Fixed-height row in card mode; flex-1 fills remaining viewport in fullscreen */}
      <div className="flex" style={isFs ? { flex: 1, minHeight: 0 } : { height: 520 }}>
        <div className="flex-1 min-w-0 border-r border-stone-100 relative">
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
