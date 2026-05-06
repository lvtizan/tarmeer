#!/usr/bin/env node
/**
 * test-uae-map-callout.mjs — Verify pure logic of UAEMapLeaflet callout system.
 *
 * Run: node scripts/harness/test-uae-map-callout.mjs
 *
 * Tests pure functions: aggregateCities, cardHeight, cardSide, computeCardLayout.
 * (Drag-and-drop / map rendering tested separately in Playwright when added.)
 */

// ─── Replicas of pure logic from src/components/admin/UAEMapLeaflet.tsx ────
// Keep these in sync with the component. If a test fails, sync first; then fix.

const CITY_COORDS = {
  'dubai':                   [25.2048, 55.2708],
  '迪拜':                    [25.2048, 55.2708],
  'abu dhabi':               [24.4539, 54.3773],
  '阿布扎比':                [24.4539, 54.3773],
  'sharjah':                 [25.3463, 55.4209],
  '沙迦':                    [25.3463, 55.4209],
  'ajman':                   [25.4052, 55.5136],
  'ras al khaimah':          [25.7895, 55.9432],
  '哈伊马角':                [25.7895, 55.9432],
  'fujairah':                [25.1288, 56.3265],
};
const HAS_CJK = /[一-鿿]/;

function aggregateCities(vC, cC, hC, iC) {
  const m = new Map();
  const add = (data, field) => {
    for (const { city, count } of data) {
      const lower = city.toLowerCase().trim();
      const coords = CITY_COORDS[lower];
      if (!coords) continue;
      const k = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
      let e = m.get(k);
      if (!e) {
        e = { city, key: k, coords, visitor:0, company:0, homeowner:0, inquiry:0, total:0 };
        m.set(k, e);
      } else if (HAS_CJK.test(city) && !HAS_CJK.test(e.city)) {
        e.city = city;
      }
      e[field] += count;
      e.total += count;
    }
  };
  add(vC, 'visitor'); add(cC, 'company'); add(hC, 'homeowner'); add(iC, 'inquiry');
  return [...m.values()].sort((a, b) => b.total - a.total);
}

const CARD_W            = 156;
const ROW_PX            = 17;
const VISITOR_FOOTER_PX = 14;
const SEPARATOR_PX      = 5;
const HEAD_PX           = 30;
const PAD_Y_PX          = 14;

const conversionTotal = (c) => c.company + c.homeowner + c.inquiry;
function cardRowCount(c) {
  return (c.company ? 1 : 0) + (c.homeowner ? 1 : 0) + (c.inquiry ? 1 : 0);
}
function cardHeight(c) {
  const conv = conversionTotal(c);
  const primary = cardRowCount(c);
  const hasVisitor = c.visitor > 0;
  if (conv === 0 && hasVisitor) return HEAD_PX + ROW_PX + PAD_Y_PX;
  const visitorBlock = hasVisitor ? SEPARATOR_PX + VISITOR_FOOTER_PX : 0;
  return HEAD_PX + primary * ROW_PX + visitorBlock + PAD_Y_PX;
}
function cardSide(city) { return city.coords[1] < 54.9 ? 'left' : 'right'; }

// Simulate Leaflet's container-point projection: lat/lng → pixel (x,y).
// We use a mock map with linear projection over UAE bounds for testing.
function mockMap(width, height, bounds) {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  return {
    getSize: () => ({ x: width, y: height }),
    latLngToContainerPoint: (ll) => ({
      x: ((ll.lng - minLng) / (maxLng - minLng)) * width,
      y: ((maxLat - ll.lat) / (maxLat - minLat)) * height,
    }),
  };
}

const CARD_OFFSET_PX = 180;
function computeCardLayout(map, topCities) {
  const sz = map.getSize();
  const sides = topCities.map(t => t.side);

  const buildRects = () => {
    const rects = topCities.map(({ city }, i) => {
      const side = sides[i];
      const h    = cardHeight(city);
      const bPt  = map.latLngToContainerPoint({ lat: city.coords[0], lng: city.coords[1] });
      const ax   = bPt.x + (side === 'left' ? -CARD_OFFSET_PX : CARD_OFFSET_PX);
      const x    = side === 'left' ? ax - CARD_W : ax;
      const y    = bPt.y - h / 2;
      return { x, y, w: CARD_W, h, side };
    });
    for (const side of ['left', 'right']) {
      const idxs = [];
      for (let i = 0; i < rects.length; i++) if (rects[i].side === side) idxs.push(i);
      if (idxs.length <= 1) continue;
      const xs = idxs.map(i => rects[i].x);
      const alignedX = side === 'right' ? Math.min(...xs) : Math.max(...xs);
      for (const i of idxs) rects[i].x = alignedX;
    }
    return rects;
  };
  const resolveOverlaps = (rects) => {
    const GAP = 8, M = 16;
    for (const side of ['left', 'right']) {
      const idxs = [];
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
      const overflowBottom = (last.y + last.h) - (sz.y - M);
      if (overflowBottom > 0) {
        const shift = Math.min(overflowBottom, first.y - M);
        if (shift > 0) for (const i of idxs) rects[i].y -= shift;
      }
    }
  };
  const totalSpan = (rects, side) => {
    const own = rects.filter(r => r.side === side);
    if (!own.length) return 0;
    return own.reduce((s, r) => s + r.h + 8, -8);
  };

  let rects = buildRects();
  resolveOverlaps(rects);
  for (let i = topCities.length - 1; i >= 0 && (totalSpan(rects, 'left') > sz.y || totalSpan(rects, 'right') > sz.y); i--) {
    const overSide = totalSpan(rects, 'right') > totalSpan(rects, 'left') ? 'right' : 'left';
    if (sides[i] !== overSide) continue;
    sides[i] = overSide === 'right' ? 'left' : 'right';
    rects = buildRects();
    resolveOverlaps(rects);
  }
  // Note: resolveOverlaps already handles overflow (shifts whole stack up).
  // No post-clamp here — clamping individual cards would re-introduce overlap.
  return rects;
}

// ─── Test runner ─────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const results = [];
function test(name, fn) {
  try { fn(); pass++; results.push(`  ✓ ${name}`); }
  catch (e) { fail++; results.push(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// TC-1 Dubai + 迪拜 合并
test('TC-1: Dubai + 迪拜 合并为一条，中文优先', () => {
  const out = aggregateCities(
    [{ city: '迪拜', count: 200 }],
    [{ city: 'Dubai', count: 100 }],
    [], []
  );
  eq(out.length, 1, 'agg length');
  eq(out[0].city, '迪拜', 'preferred city name');
  eq(out[0].visitor, 200, 'visitor');
  eq(out[0].company, 100, 'company');
  eq(out[0].total, 300, 'total');
  eq(out[0].coords, [25.2048, 55.2708], 'coords');
});

// TC-2 英文先到，中文后到，应该被中文覆盖
test('TC-2: 英文先到，中文后到 → 用中文', () => {
  const out = aggregateCities(
    [{ city: 'Abu Dhabi', count: 50 }],
    [{ city: '阿布扎比', count: 30 }],
    [], []
  );
  eq(out.length, 1, 'agg length');
  eq(out[0].city, '阿布扎比', 'should overwrite to Chinese');
  eq(out[0].visitor, 50, 'visitor');
  eq(out[0].company, 30, 'company');
  eq(out[0].total, 80, 'total');
});

// TC-3 未识别城市跳过
test('TC-3: 未识别城市跳过', () => {
  const out = aggregateCities([{ city: 'Atlantis', count: 999 }], [], [], []);
  eq(out.length, 0, 'unknown city dropped');
});

// TC-4 cardHeight 按行数（C 版：转化总计 + 访客 muted footer）
//   有 conv 行：HEAD(30) + primary*ROW_PX(17) + (有 visitor: SEP(5)+FOOTER(14)) + PAD(14)
//   无 conv 仅 visitor：HEAD(30) + ROW_PX(17) + PAD(14) = 61（degraded）
test('TC-4: cardHeight 按行数', () => {
  eq(cardHeight({ visitor:0, company:0, homeowner:0, inquiry:1 }), 61,  '1 conv 无 visitor');
  eq(cardHeight({ visitor:1, company:0, homeowner:0, inquiry:1 }), 80,  '1 conv + visitor footer');
  eq(cardHeight({ visitor:1, company:1, homeowner:0, inquiry:1 }), 97,  '2 conv + visitor footer');
  eq(cardHeight({ visitor:1, company:1, homeowner:1, inquiry:1 }), 114, '3 conv + visitor footer');
  eq(cardHeight({ visitor:1, company:0, homeowner:0, inquiry:0 }), 61,  'degraded: 仅 visitor');
});

// TC-5 cardSide 阈值
test('TC-5: cardSide lng 阈值 54.9', () => {
  eq(cardSide({ coords: [24.4539, 54.3773] }), 'left',  'Abu Dhabi');
  eq(cardSide({ coords: [25.2048, 55.2708] }), 'right', 'Dubai');
  eq(cardSide({ coords: [25.3463, 55.4209] }), 'right', 'Sharjah');
  eq(cardSide({ coords: [25.1288, 56.3265] }), 'right', 'Fujairah');
});

// TC-6 layout 不留重叠
test('TC-6: computeCardLayout 不留 overlap', () => {
  const cities = [
    { coords: [25.2048, 55.2708], visitor:2030, company:104, homeowner:1, inquiry:265 }, // Dubai
    { coords: [25.3463, 55.4209], visitor:549,  company:7,   homeowner:0, inquiry:7   }, // Sharjah
    { coords: [25.4052, 55.5136], visitor:239,  company:3,   homeowner:0, inquiry:6   }, // Ajman
    { coords: [25.7895, 55.9432], visitor:63,   company:0,   homeowner:0, inquiry:0   }, // RAK
    { coords: [25.1288, 56.3265], visitor:30,   company:0,   homeowner:0, inquiry:0   }, // Fujairah
  ].map(c => ({ ...c, total: c.visitor + c.company + c.homeowner + c.inquiry }));
  const map = mockMap(900, 480, [[22.3, 51.5], [26.5, 56.8]]);
  const top = cities.map(city => ({ city, side: cardSide(city) }));
  const rects = computeCardLayout(map, top);
  for (let i = 0; i < rects.length; i++) for (let j = i+1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x;
    const yOverlap = a.y < b.y + b.h && a.y + a.h > b.y;
    assert(!(xOverlap && yOverlap), `cards ${i},${j} overlap (x:${xOverlap} y:${yOverlap})`);
  }
});

// TC-9 同侧对齐（TC-8 是 E2E drag 测试，待 Playwright 接入）
test('TC-9: 同侧多张卡 x 全部对齐', () => {
  const cities = [
    { coords: [25.2048, 55.2708], visitor:2030, company:104, homeowner:1, inquiry:265 }, // Dubai
    { coords: [25.3463, 55.4209], visitor:549,  company:7,   homeowner:0, inquiry:7   }, // Sharjah
    { coords: [25.4052, 55.5136], visitor:239,  company:3,   homeowner:0, inquiry:6   }, // Ajman
    { coords: [25.7895, 55.9432], visitor:63,   company:0,   homeowner:0, inquiry:0   }, // RAK
  ].map(c => ({ ...c, total: c.visitor + c.company + c.homeowner + c.inquiry }));
  const map = mockMap(900, 480, [[22.3, 51.5], [26.5, 56.8]]);
  const top = cities.map(city => ({ city, side: cardSide(city) }));   // all right
  const rects = computeCardLayout(map, top);
  const xs = [...new Set(rects.filter(r => r.side === 'right').map(r => r.x))];
  assert(xs.length === 1, `right-side cards should share 1 x, got ${xs.length}: ${JSON.stringify(xs)}`);
});

// TC-7 超界换边
test('TC-7: 5 张全右侧 + 矮地图 → 至少 1 张换到左侧', () => {
  // Force all to right side, then small map height to trigger overflow
  const cities = [
    { coords: [25.7895, 55.9432], visitor:1, company:1, homeowner:1, inquiry:1, total:4 },
    { coords: [25.4052, 55.5136], visitor:1, company:1, homeowner:1, inquiry:1, total:4 },
    { coords: [25.3463, 55.4209], visitor:1, company:1, homeowner:1, inquiry:1, total:4 },
    { coords: [25.2048, 55.2708], visitor:1, company:1, homeowner:1, inquiry:1, total:4 },
    { coords: [25.1288, 56.3265], visitor:1, company:1, homeowner:1, inquiry:1, total:4 },
  ];
  // Small map (180px tall) — 5 * 151 = 755 way exceeds 180
  const map = mockMap(900, 180, [[22.3, 51.5], [26.5, 56.8]]);
  const top = cities.map(city => ({ city, side: 'right' }));
  const rects = computeCardLayout(map, top);
  const leftCount = rects.filter(r => r.side === 'left').length;
  assert(leftCount > 0, `expected ≥1 card on left, got ${leftCount}`);
});

// ─── Output ──────────────────────────────────────────────────────────────
console.log('\nUAE Map Callout — Pure Logic Tests\n');
console.log(results.join('\n'));
console.log(`\n${pass}/${pass+fail} PASS, ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
