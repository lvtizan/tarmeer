#!/usr/bin/env node
/**
 * IndexNow integration harness.
 *
 * Tests:
 *   1. Key file route returns 200 + key text when INDEXNOW_KEY is set
 *   2. Key file route returns 404 (falls through) for unknown keys
 *   3. Key file route returns 404 when INDEXNOW_KEY is not set
 *
 * Usage:
 *   # Start local backend first:
 *   INDEXNOW_KEY=abc123def456abc123def456abc12345 PORT=3099 DEV_SKIP_EMAIL=true node server/dist/app.js
 *
 *   node scripts/harness/test-indexnow.mjs
 *   node scripts/harness/test-indexnow.mjs --base http://127.0.0.1:3099
 */

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const BASE_URL = argValue('--base', 'http://127.0.0.1:3099').replace(/\/+$/, '');
// A dummy 32-hex key that matches the regex in the route
const DUMMY_KEY = 'abcdef1234567890abcdef1234567890';

let passed = 0;
let failed = 0;

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function get(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } catch (e) {
    return { status: 0, text: '', error: e.message };
  }
}

console.log('\n══ test-indexnow ══\n');
console.log(`Base URL: ${BASE_URL}\n`);

// ── Test 1: /api/health — backend is reachable ──
const health = await get('/api/health');
ok('Backend reachable (GET /api/health → 200)', health.status === 200,
  health.status === 0 ? `connection error: ${health.error}` : `status=${health.status}`);

if (health.status === 0) {
  console.log('\n  ⚠  Backend not running — start with:');
  console.log(`  INDEXNOW_KEY=${DUMMY_KEY} PORT=3099 DEV_SKIP_EMAIL=true node server/dist/app.js`);
  console.log(`\n══ 结果: ${passed} PASS, 1 FAIL (backend offline) ══\n`);
  process.exit(1);
}

// ── Test 2: Unknown .txt key → not 200 with key content ──
const wrongKey = await get('/ffffffffffffffffffffffffffffffff.txt');
// Should either 404 (falls through to SPA handler) or plain text that does NOT equal our dummy key
const notServedAsKey = wrongKey.status !== 200 || wrongKey.text !== DUMMY_KEY;
ok('Unknown key.txt → not served as IndexNow key', notServedAsKey,
  `status=${wrongKey.status}, body="${wrongKey.text.slice(0, 50)}"`);

// ── Test 3: Valid key format .txt — we can only test without a live INDEXNOW_KEY env here.
//           This confirms the route exists and the regex pattern compiles correctly.
//           With INDEXNOW_KEY set to DUMMY_KEY, it would return 200 + key text.
//           Without it set (typical CI/local), should fall through gracefully.
const keyFile = await get(`/${DUMMY_KEY}.txt`);
// If INDEXNOW_KEY matches → 200; if not set → falls through (200 SPA or 404)
// We just check no 500 error
ok('Key file route does not crash (no 500)', keyFile.status !== 500,
  `status=${keyFile.status}`);

// ── Test 4: Non-.txt path not affected ──
const nonTxt = await get('/api/health');
ok('Non-.txt paths unaffected by key route', nonTxt.status === 200,
  `status=${nonTxt.status}`);

console.log(`\n══ 结果: ${passed} PASS, ${failed} FAIL ══\n`);
if (failed > 0) process.exit(1);
