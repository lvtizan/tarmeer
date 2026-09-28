#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
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

const baseUrl = process.env.SUPPLIER_VR_E2E_URL || 'http://127.0.0.1:5180';
const serverUrl = new URL(baseUrl);
const isLocal = ['localhost', '127.0.0.1'].includes(serverUrl.hostname);
const browserOrigin = isLocal ? `http://ae.tarmeer.test:${serverUrl.port || '5180'}` : serverUrl.origin;
const pageUrl = `${browserOrigin}/materials/suppliers/supplier-1127?from=products`;
const directBaseUrl = isLocal ? `http://127.0.0.1:${serverUrl.port || '5180'}` : serverUrl.origin;
const port = 15000 + (process.pid % 1000);
const profile = await mkdtemp(join(tmpdir(), 'tarmeer-supplier-vr-e2e-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  ...(isLocal ? ['--no-proxy-server'] : []),
  ...(isLocal ? ['--host-resolver-rules=MAP ae.tarmeer.test 127.0.0.1'] : []),
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

function statusWithHost(url, host) {
  return new Promise((resolve, reject) => {
    const request = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, { headers: { host } }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    req.setTimeout(10_000, () => req.destroy(new Error('Host-gate request timed out')));
    req.on('error', reject);
    req.end();
  });
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
  const response = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
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

try {
  await Promise.race([
    waitForJson(`http://127.0.0.1:${port}/json/version`),
    chromeFailed,
  ]);
  const targetResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`,
    { method: 'PUT' },
  );
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
  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  });
  await call('Page.navigate', { url: pageUrl });
  await waitUntil("document.readyState === 'complete' && !!document.querySelector('#section-vr-showroom iframe')", 'mobile VR section');

  const mobile = await evaluate(`(() => {
    const section = document.querySelector('#section-vr-showroom');
    const iframe = section?.querySelector('iframe');
    const frameRect = iframe?.parentElement?.getBoundingClientRect();
    const tab = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('VR Showroom'));
    return {
      tabExists: !!tab,
      url: iframe?.getAttribute('src'),
      title: iframe?.getAttribute('title'),
      lazy: iframe?.getAttribute('loading'),
      sandbox: iframe?.getAttribute('sandbox'),
      allowFullscreen: iframe?.hasAttribute('allowfullscreen'),
      sectionCount: document.querySelectorAll('#section-vr-showroom').length,
      ratio: frameRect ? frameRect.height / frameRect.width : 0,
      bounded: frameRect ? frameRect.left >= 0 && frameRect.right <= innerWidth + 1 : false,
      pointerEvents: iframe ? getComputedStyle(iframe).pointerEvents : null,
      hasActivationGate: Array.from(section?.querySelectorAll('button') || []).some((button) => button.textContent?.includes('Tap to explore VR')),
      coarsePointer: matchMedia('(hover: none) and (pointer: coarse)').matches,
    };
  })()`);
  assert.equal(mobile.tabExists, true, 'configured supplier has a VR navigation tab');
  assert.equal(mobile.url, 'https://realsee.ai/lq22JMMX', 'iframe uses the configured Realsee URL');
  assert.equal(mobile.title, 'Supplier VR showroom', 'iframe has an accessible title');
  assert.equal(mobile.lazy, 'lazy', 'iframe is lazy loaded');
  assert.equal(mobile.allowFullscreen, true, 'iframe allows fullscreen');
  assert.equal(mobile.sectionCount, 1, 'VR section renders exactly once');
  assert.equal(mobile.sandbox.includes('allow-popups-to-escape-sandbox'), false, 'iframe cannot escape its sandbox');
  assert.ok(Math.abs(mobile.ratio - 1.25) < 0.03, 'mobile embed uses a 4:5 aspect ratio');
  assert.equal(mobile.bounded, true, 'mobile embed stays inside the viewport');
  assert.equal(mobile.pointerEvents, 'none', 'mobile iframe initially leaves touch scrolling to the page');
  assert.equal(mobile.hasActivationGate, true, 'mobile VR has an explicit interaction gate');
  assert.equal(mobile.coarsePointer, true, 'mobile test uses the production coarse-pointer media condition');

  await evaluate("document.querySelector('#section-vr-showroom iframe').scrollIntoView({ block: 'center' })");
  const scrollBeforeSwipe = await evaluate('scrollY');
  await call('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 195, y: 620 }],
  });
  await call('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 195, y: 300 }],
  });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(500);
  assert.ok(await evaluate('scrollY') > scrollBeforeSwipe, 'swiping over inactive mobile VR scrolls the outer page');

  const activated = await evaluate(`(() => {
    const button = [...document.querySelectorAll('#section-vr-showroom button')].find((item) => item.textContent?.includes('Tap to explore VR'));
    button?.click();
    return !!button;
  })()`);
  assert.equal(activated, true, 'mobile user can activate VR interaction');
  await waitUntil(
    "getComputedStyle(document.querySelector('#section-vr-showroom iframe')).pointerEvents === 'auto' && [...document.querySelectorAll('#section-vr-showroom button')].some((button) => button.textContent?.includes('Resume scrolling'))",
    'active mobile VR controls',
  );
  const resumed = await evaluate(`(() => {
    const button = [...document.querySelectorAll('#section-vr-showroom button')].find((item) => item.textContent?.includes('Resume scrolling'));
    button?.click();
    return !!button;
  })()`);
  assert.equal(resumed, true, 'mobile user can exit VR interaction');
  await waitUntil(
    "getComputedStyle(document.querySelector('#section-vr-showroom iframe')).pointerEvents === 'none'",
    'mobile page scrolling restored',
  );
  await waitUntil(`(() => {
    const frame = document.querySelector('#section-vr-showroom iframe');
    try { void frame.contentWindow.location.href; return false; } catch { return true; }
  })()`, 'cross-origin Realsee iframe navigation');
  assert.equal(
    await evaluate(`(() => {
      const frame = document.querySelector('#section-vr-showroom iframe');
      try { void frame.contentWindow.location.href; return false; } catch { return true; }
    })()`),
    true,
    'browser navigates the embedded frame to Realsee',
  );

  await evaluate("document.querySelector('#section-products').scrollIntoView({ block: 'center' })");
  await waitUntil(`[...document.querySelectorAll('button')].some((button) =>
    button.textContent?.includes('Products') && button.className.includes('border-[#b8864a]')
  )`, 'products active tab');

  const vrTabClicked = await evaluate(`(() => {
    const tab = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('VR Showroom'));
    tab?.click();
    return !!tab;
  })()`);
  assert.equal(vrTabClicked, true, 'VR tab is clickable after leaving its section');
  await waitUntil("document.querySelector('#section-vr-showroom').getBoundingClientRect().top < 200", 'VR tab scroll target');
  await waitUntil(`[...document.querySelectorAll('button')].some((button) =>
    button.textContent?.includes('VR Showroom') && button.className.includes('border-[#b8864a]')
  )`, 'VR active tab');

  assert.equal(
    await statusWithHost(`${directBaseUrl}/materials/suppliers/supplier-1127?from=products`, 'vn.tarmeer.com'),
    404,
    'VN host receives a real 404 for the AE-only supplier',
  );

  await call('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(300);
  await evaluate("document.querySelector('#section-vr-showroom iframe').scrollIntoView({ block: 'center' })");
  const landscapeTouch = await evaluate(`(() => {
    const section = document.querySelector('#section-vr-showroom');
    const frame = section?.querySelector('iframe');
    const gate = [...section.querySelectorAll('button')].find((button) => button.textContent?.includes('Tap to explore VR'));
    return {
      pointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
      gateVisible: gate ? getComputedStyle(gate).display !== 'none' : false,
      scrollY,
    };
  })()`);
  assert.equal(landscapeTouch.pointerEvents, 'none', 'landscape touch devices keep page scrolling enabled');
  assert.equal(landscapeTouch.gateVisible, true, 'landscape touch devices retain the VR activation gate');
  await call('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 422, y: 300 }],
  });
  await call('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 422, y: 100 }],
  });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(500);
  assert.ok(await evaluate('scrollY') > landscapeTouch.scrollY, 'landscape swipe over inactive VR scrolls the page');

  await call('Emulation.setTouchEmulationEnabled', { enabled: false });
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(300);
  const desktop = await evaluate(`(() => {
    const frameRect = document.querySelector('#section-vr-showroom iframe')?.parentElement?.getBoundingClientRect();
    return {
      ratio: frameRect ? frameRect.width / frameRect.height : 0,
      maxWidth: frameRect?.width || 0,
      bounded: frameRect ? frameRect.left >= 0 && frameRect.right <= innerWidth + 1 : false,
    };
  })()`);
  assert.ok(Math.abs(desktop.ratio - (16 / 9)) < 0.03, 'desktop embed uses a 16:9 aspect ratio');
  assert.ok(desktop.maxWidth > 1200, 'desktop VR experience uses the wide supplier layout');
  assert.equal(desktop.bounded, true, 'desktop embed stays inside the viewport');

  console.log('29/29 PASS — real browser supplier gate, portrait/landscape touch escape, tab/observer wiring, iframe navigation and PC/mobile layout');
} finally {
  socket?.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await Promise.race([chromeExited, delay(3_000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
