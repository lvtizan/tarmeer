#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}/Google/Chrome/Application/chrome.exe`,
].find((candidate) => candidate && existsSync(candidate));
assert.ok(chromePath, 'Chrome/Chromium not found; set CHROME_PATH to run this harness');

const baseUrl = process.env.SUPPLIER_STICKY_E2E_URL || 'http://127.0.0.1:5180';
const serverUrl = new URL(baseUrl);
const isLocal = ['localhost', '127.0.0.1'].includes(serverUrl.hostname);
const pageUrl = isLocal
  ? `http://ae.tarmeer.test:${serverUrl.port || '5180'}/materials/suppliers/supplier-1127?from=products`
  : `${serverUrl.origin}/materials/suppliers/supplier-1127?from=products`;
const port = 16000 + (process.pid % 1000);
const profile = await mkdtemp(join(tmpdir(), 'tarmeer-supplier-sticky-e2e-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  ...(isLocal ? ['--no-proxy-server', '--host-resolver-rules=MAP ae.tarmeer.test 127.0.0.1'] : []),
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });
const chromeExited = new Promise((resolve) => chrome.once('exit', resolve));
const chromeFailed = new Promise((_, reject) => chrome.once('error', reject));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let socket;
let messageId = 0;
const pending = new Map();
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitUntil(expression, label, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function assertViewport(width, height, expectedTop, label) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1024 });
  await delay(250);
  await evaluate(`(() => {
    const tabs = document.querySelector('[data-testid="supplier-section-tabs"]');
    const documentTop = tabs.getBoundingClientRect().top + scrollY;
    scrollTo(0, documentTop + 240);
  })()`);
  await waitUntil(
    `Math.abs(document.querySelector('[data-testid="supplier-section-tabs"]').getBoundingClientRect().top - ${expectedTop}) <= 1`,
    `${label} sticky top`,
  );
  const motion = await evaluate(`(async () => {
    const tabs = document.querySelector('[data-testid="supplier-section-tabs"]');
    const samples = [];
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (let pass = 0; pass < 3; pass += 1) {
      for (const delta of [8, 8, 8, 8, -8, -8, -8, -8]) {
        scrollBy(0, delta);
        await frame();
        samples.push(tabs.getBoundingClientRect().top);
      }
    }
    return {
      samples,
      min: Math.min(...samples),
      max: Math.max(...samples),
    };
  })()`);
  const result = await evaluate(`(() => {
    const root = document.documentElement;
    const tabs = document.querySelector('[data-testid="supplier-section-tabs"]');
    return {
      position: getComputedStyle(tabs).position,
      top: tabs.getBoundingClientRect().top,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  })()`);
  assert.equal(result.position, 'sticky', `${label}: tab bar is sticky`);
  assert.ok(Math.abs(result.top - expectedTop) <= 1, `${label}: tab bar is pinned at ${expectedTop}px`);
  assert.ok(
    motion.samples.every((top) => Math.abs(top - expectedTop) <= 1),
    `${label}: tab bar is stable across ${motion.samples.length} consecutive scroll frames (${motion.min}–${motion.max}px)`,
  );
  assert.ok(result.scrollWidth <= result.clientWidth + 1, `${label}: no horizontal page overflow`);
}

try {
  await Promise.race([
    waitForJson(`http://127.0.0.1:${port}/json/version`),
    chromeFailed,
  ]);
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' });
  assert.ok(targetResponse.ok, 'Chrome opened the supplier page');
  const target = await targetResponse.json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: pageUrl });
  await waitUntil(
    `document.readyState === 'complete' && !!document.querySelector('[data-testid="supplier-section-tabs"]')`,
    'supplier tab strip',
  );
  await assertViewport(390, 844, 56, '390px portrait');
  await assertViewport(844, 390, 64, '844px landscape');
  await assertViewport(1440, 900, 64, '1440px desktop');
  console.log('supplier-mobile-sticky-tabs-e2e: 12/12 PASS — sticky position, 24-frame scroll stability and horizontal overflow at 390/844/1440');
} finally {
  socket?.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await Promise.race([chromeExited, delay(3_000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
