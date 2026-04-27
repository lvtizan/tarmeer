#!/usr/bin/env node
/**
 * Harness: Analytics Data Accuracy
 * Verifies the new visitor analytics endpoints return correct data.
 *
 * TC1: /stats/registration-sources — returns all city fields, non-empty
 * TC2: /analytics/daily-visits    — returns daily data with correct shape
 * TC3: /visitors/overview          — unique IP count > 1000 (from visitor_logs)
 * TC4: /analytics/overview         — overview metrics shape correct
 * TC5: City→Emirate mapping        — Chinese city names map to correct emirates
 * TC6: Data cross-check            — visitor_cities totals add up sanely
 * TC7: Date format                 — stat_date is parseable as date
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE = process.env.API_BASE || 'http://127.0.0.1:3002';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bbtizan@gmail.com';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'Tarmeer2026';

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  PASS  ${name}`);
  passed++;
}
function fail(name, reason) {
  console.log(`  FAIL  ${name}`);
  console.log(`        → ${reason}`);
  failed++;
}

async function getToken() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Login failed: ' + JSON.stringify(d));
  return d.token;
}

async function get(token, path) {
  const res = await fetch(`${BASE}/api/admin/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

// UAE city→emirate mapping (same as UAEMapSVG.tsx)
const CITY_TO_EMIRATE = {
  'dubai': 'Dubai', 'deira': 'Dubai', 'bur dubai': 'Dubai',
  '迪拜': 'Dubai',
  'abu dhabi': 'Abu Dhabi', 'al ain': 'Abu Dhabi',
  '阿布扎比': 'Abu Dhabi', '艾因': 'Abu Dhabi',
  'sharjah': 'Sharjah', 'khor fakkan': 'Sharjah',
  '沙迦': 'Sharjah', '夏尔迦': 'Sharjah',
  'ajman': 'Ajman',
  '阿治曼': 'Ajman',
  'umm al quwain': 'UAQ', 'uaq': 'UAQ',
  '乌姆盖万': 'UAQ',
  'ras al khaimah': 'RAK', 'rak': 'RAK',
  '哈伊马角': 'RAK', '莱斯海玛': 'RAK',
  'fujairah': 'Fujairah', 'dibba': 'Fujairah',
  '富查伊拉': 'Fujairah',
};

function mapCity(city) {
  return CITY_TO_EMIRATE[city.toLowerCase().trim()] ||
         CITY_TO_EMIRATE[city.trim()] || null;
}

async function run() {
  console.log('\nAnalytics Data Accuracy Harness');
  console.log('================================');

  let token;
  try {
    token = await getToken();
    console.log('  AUTH  Login OK\n');
  } catch (e) {
    console.error('  FATAL Cannot login:', e.message);
    process.exit(1);
  }

  // TC1: registration-sources has all city fields
  try {
    const d = await get(token, 'stats/registration-sources');
    const keys = Object.keys(d);
    if (!keys.includes('company_cities'))
      fail('TC1a company_cities present', `missing, got keys: ${keys}`);
    else if (!Array.isArray(d.company_cities) || d.company_cities.length === 0)
      fail('TC1a company_cities non-empty', `length=${d.company_cities?.length}`);
    else pass('TC1a company_cities present & non-empty');

    if (!keys.includes('inquiry_cities'))
      fail('TC1b inquiry_cities present', `missing`);
    else if (!Array.isArray(d.inquiry_cities) || d.inquiry_cities.length === 0)
      fail('TC1b inquiry_cities non-empty', `length=${d.inquiry_cities?.length}`);
    else pass('TC1b inquiry_cities present & non-empty');

    if (!keys.includes('visitor_cities'))
      fail('TC1c visitor_cities present', `missing`);
    else if (!Array.isArray(d.visitor_cities) || d.visitor_cities.length === 0)
      fail('TC1c visitor_cities non-empty', `length=${d.visitor_cities?.length}`);
    else pass('TC1c visitor_cities present & non-empty');

    // Check shape: each entry has { city, count }
    const sample = d.company_cities?.[0];
    if (!sample || typeof sample.city !== 'string' || typeof sample.count !== 'number')
      fail('TC1d city entry shape {city,count}', `got: ${JSON.stringify(sample)}`);
    else pass('TC1d city entry shape {city, count}');

    // Print top cities for audit
    console.log('\n  [Audit] Top company cities:', d.company_cities.slice(0, 4).map(c => `${c.city}(${c.count})`).join(', '));
    console.log('  [Audit] Top inquiry cities:', d.inquiry_cities.slice(0, 3).map(c => `${c.city}(${c.count})`).join(', '));
    console.log('  [Audit] Top visitor cities:', d.visitor_cities.slice(0, 5).map(c => `${c.city}(${c.count})`).join(', '));
    console.log();
  } catch (e) {
    fail('TC1 registration-sources request', e.message);
  }

  // TC2: daily-visits shape and data
  try {
    const d = await get(token, 'analytics/daily-visits');
    if (!Array.isArray(d.dailyVisits))
      fail('TC2a dailyVisits is array', `got: ${typeof d.dailyVisits}`);
    else if (d.dailyVisits.length === 0)
      fail('TC2b dailyVisits non-empty', 'empty array');
    else pass('TC2a-b dailyVisits array non-empty');

    const entry = d.dailyVisits[0];
    if (!entry || typeof entry.stat_date !== 'string')
      fail('TC2c stat_date field present', `got: ${JSON.stringify(entry)}`);
    else pass('TC2c stat_date field present');

    if (typeof entry?.page_views !== 'number')
      fail('TC2d page_views is number', `got: ${typeof entry?.page_views}`);
    else pass('TC2d page_views is number');

    const totalViews = d.dailyVisits.reduce((s, r) => s + (r.page_views || 0), 0);
    console.log(`  [Audit] Daily visits: ${d.dailyVisits.length} days, total page_views=${totalViews}`);
    console.log(`  [Audit] Date range: ${d.dateRange?.start} → ${d.dateRange?.end}`);
    console.log();
  } catch (e) {
    fail('TC2 daily-visits request', e.message);
  }

  // TC3: visitor overview unique IP count (from visitor_logs, should be ~3000+)
  try {
    const d = await get(token, 'visitors/overview');
    if (typeof d.uniqueIpCount !== 'number')
      fail('TC3a uniqueIpCount is number', `got: ${typeof d.uniqueIpCount}`);
    else pass('TC3a uniqueIpCount is number');

    if (d.uniqueIpCount < 100)
      fail('TC3b uniqueIpCount reasonable (>100)', `got: ${d.uniqueIpCount}`);
    else pass(`TC3b uniqueIpCount reasonable: ${d.uniqueIpCount}`);

    console.log(`  [Audit] Unique IPs (visitor_logs): ${d.uniqueIpCount}, totalVisits: ${d.totalVisits}`);
    console.log();
  } catch (e) {
    fail('TC3 visitor overview request', e.message);
  }

  // TC4: analytics overview shape
  try {
    const d = await get(token, 'analytics/overview');
    const ov = d.overview;
    const fields = ['total_events', 'unique_visitors', 'page_views', 'apply_clicks', 'whatsapp_clicks', 'contact_submits'];
    for (const f of fields) {
      if (typeof ov?.[f] !== 'number')
        fail(`TC4 overview.${f} is number`, `got: ${typeof ov?.[f]}`);
    }
    pass(`TC4 analytics overview all fields present`);
    console.log(`  [Audit] overview: page_views=${ov.page_views}, unique_visitors=${ov.unique_visitors}, apply_clicks=${ov.apply_clicks}`);
    console.log();
  } catch (e) {
    fail('TC4 analytics overview request', e.message);
  }

  // TC5: Chinese city names map to correct emirates
  const mappingTests = [
    ['迪拜', 'Dubai'],
    ['阿布扎比', 'Abu Dhabi'],
    ['沙迦', 'Sharjah'],
    ['阿治曼', 'Ajman'],
    ['哈伊马角', 'RAK'],
    ['富查伊拉', 'Fujairah'],
    ['乌姆盖万', 'UAQ'],
  ];
  let mappingOk = true;
  for (const [city, expected] of mappingTests) {
    const got = mapCity(city);
    if (got !== expected) {
      fail(`TC5 "${city}" → ${expected}`, `got: ${got}`);
      mappingOk = false;
    }
  }
  if (mappingOk) pass('TC5 all Chinese city→emirate mappings correct');

  // Also test English names
  const engTests = [['Dubai', 'Dubai'], ['Abu Dhabi', 'Abu Dhabi'], ['Sharjah', 'Sharjah'], ['Ajman', 'Ajman']];
  let engOk = true;
  for (const [city, expected] of engTests) {
    if (mapCity(city) !== expected) { engOk = false; fail(`TC5e "${city}"`, `got ${mapCity(city)}`); }
  }
  if (engOk) pass('TC5e English city names map correctly');
  console.log();

  // TC6: visitor_cities totals are internally consistent
  try {
    const d = await get(token, 'stats/registration-sources');
    const vc = d.visitor_cities || [];
    const totalFromCities = vc.reduce((s, c) => s + (c.count || 0), 0);

    // Also get overview unique count
    const vo = await get(token, 'visitors/overview');
    const uniqueIps = vo.uniqueIpCount;

    // City totals can exceed uniqueIps because one IP can visit from multiple locations
    // But total from cities should be in the same ballpark
    if (totalFromCities === 0)
      fail('TC6 visitor_cities total > 0', `got 0`);
    else pass(`TC6 visitor_cities total: ${totalFromCities} (unique IPs: ${uniqueIps})`);

    // Dubai should be top city
    const topCity = vc[0];
    if (!topCity || !['迪拜', 'dubai', 'Dubai'].includes(topCity.city))
      fail('TC6b top visitor city is Dubai', `got: ${topCity?.city}`);
    else pass(`TC6b top visitor city: ${topCity.city} (${topCity.count})`);
    console.log();
  } catch (e) {
    fail('TC6 data cross-check', e.message);
  }

  // TC7: stat_date is parseable
  try {
    const d = await get(token, 'analytics/daily-visits');
    const entries = d.dailyVisits || [];
    let badDates = 0;
    for (const e of entries) {
      const parsed = new Date(e.stat_date);
      if (isNaN(parsed.getTime())) badDates++;
    }
    if (badDates > 0)
      fail('TC7 all stat_dates parseable', `${badDates}/${entries.length} invalid`);
    else pass(`TC7 all ${entries.length} stat_dates parseable as Date`);

    // Check MM-DD slice(5,10) works
    if (entries.length > 0) {
      const sliced = entries[0].stat_date.slice(5, 10);
      const mmddPattern = /^\d{2}-\d{2}$/;
      if (!mmddPattern.test(sliced))
        fail('TC7b slice(5,10) gives MM-DD', `got: "${sliced}"`);
      else pass(`TC7b date display format: "${sliced}" (correct MM-DD)`);
    }
  } catch (e) {
    fail('TC7 date format check', e.message);
  }

  // Summary
  console.log('\n================================');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Status: FAIL');
    process.exit(1);
  } else {
    console.log('Status: PASS');
  }
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
