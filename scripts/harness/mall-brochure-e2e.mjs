#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
assert.ok(chromePath, 'Chrome/Chromium not found; set CHROME_PATH to run the mall browser harness');

const baseUrl = process.env.MALL_E2E_URL || 'http://localhost:5180';
const directBaseUrl = baseUrl.replace('localhost', '127.0.0.1');
const port = 14000 + (process.pid % 1000);
const profile = await mkdtemp(join(tmpdir(), 'tarmeer-mall-e2e-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });
const chromeExited = new Promise((resolve) => chrome.once('exit', resolve));
const chromeFailed = new Promise((_, reject) => chrome.once('error', reject));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function statusWithHost(url, host) {
  return new Promise((resolve, reject) => {
    const request = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, { headers: { host } }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForJson(url, attempts = 60) {
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
  const response = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitUntil(expression, label, attempts = 80) {
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
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${baseUrl}/mall`)}`,
    { method: 'PUT' },
  );
  assert.ok(targetResponse.ok, 'Chrome opened the mall page');
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
  await call('Page.reload', { ignoreCache: true });
  await waitUntil("document.readyState === 'complete' && !!document.querySelector('h1')", 'mobile mall page');
  await delay(800);

  const mobile = await evaluate(`(() => ({
    title: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim(),
    documentTitle: document.title,
    width: innerWidth,
    noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
    fixedCtaVisible: [...document.querySelectorAll('button')].some((button) =>
      button.textContent?.includes('Talk to a Material Consultant') &&
      getComputedStyle(button).display !== 'none' &&
      button.closest('.fixed')
    ),
  }))()`);
  assert.equal(mobile.width, 390, 'mobile viewport is 390px wide');
  assert.match(mobile.title, /^Source China\.\s*See it your way\.$/, 'hero communicates the sourcing proposition');
  assert.equal(
    mobile.documentTitle,
    'Explore China Building Materials Online, in the UAE or in China | Tarmeer',
    'metadata contains the Tarmeer brand once',
  );
  assert.equal(mobile.noHorizontalOverflow, true, 'mobile page has no horizontal overflow');
  assert.equal(Boolean(mobile.fixedCtaVisible), true, 'mobile consultation CTA remains visible');

  const switched = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Backlit Slabs'));
    button?.click();
    return !!button;
  })()`);
  assert.equal(switched, true, 'backlit slab viewpoint control exists');
  await waitUntil(
    "document.querySelector('#digital-showroom img')?.getAttribute('src')?.includes('vr-showroom-slabs')",
    'VR viewpoint image change',
  );
  assert.equal(
    await evaluate("document.querySelector('#digital-showroom img')?.getAttribute('src')?.includes('vr-showroom-slabs')"),
    true,
    'VR preview switches to the selected viewpoint',
  );

  const opened = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Talk to a Material Consultant') &&
      getComputedStyle(item).display !== 'none'
    );
    window.__mallTrigger = button;
    button?.focus();
    button?.click();
    return !!button;
  })()`);
  assert.equal(opened, true, 'consultation trigger exists');
  await waitUntil(
    "document.querySelector('[role=dialog]')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false'",
    'consultation dialog open',
  );
  await waitUntil(
    "document.querySelector('[role=dialog]')?.contains(document.activeElement)",
    'focus inside consultation dialog',
  );

  const dialogState = await evaluate(`(() => {
    const dialog = document.querySelector('[role=dialog]');
    return {
      label: dialog?.getAttribute('aria-labelledby'),
      focusInside: dialog?.contains(document.activeElement),
    };
  })()`);
  assert.equal(dialogState.label, 'mall-visit-title', 'dialog has an accessible name');
  assert.equal(dialogState.focusInside, true, 'focus moves inside the dialog');

  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Your name"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Draft persistence test');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const dialog = document.querySelector('[role=dialog]');
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    focusable.at(-1)?.focus();
  })()`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  assert.equal(
    await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"),
    true,
    'Tab focus remains inside the dialog',
  );

  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await waitUntil(
    "document.querySelector('[role=dialog]')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'true'",
    'dialog close',
  );
  await waitUntil('document.activeElement === window.__mallTrigger', 'focus return to trigger');
  assert.equal(await evaluate('document.activeElement === window.__mallTrigger'), true, 'focus returns to the trigger');

  await evaluate('window.__mallTrigger.click()');
  await waitUntil(
    "document.querySelector('[role=dialog]')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false'",
    'dialog reopen',
  );
  assert.equal(
    await evaluate("document.querySelector('input[placeholder=\"Your name\"]').value"),
    'Draft persistence test',
    'draft input survives close and reopen',
  );

  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await waitUntil(
    "document.querySelector('[role=dialog]')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'true'",
    'dialog close before footer check',
  );
  await waitUntil("document.body.style.overflow !== 'hidden'", 'background scroll unlock');
  await evaluate("document.querySelector('footer')?.scrollIntoView({ block: 'end' })");
  await waitUntil(
    "document.querySelector('[data-testid=\"mall-mobile-sticky-cta\"]')?.getAttribute('aria-hidden') === 'true'",
    'mobile CTA clears footer',
  );
  const footerState = await evaluate(`(() => {
    const sticky = document.querySelector('[data-testid="mall-mobile-sticky-cta"]');
    const stickyButton = sticky?.querySelector('button');
    const privacy = [...document.querySelectorAll('footer a')].find((link) => link.textContent?.includes('Privacy Policy'));
    const rect = privacy?.getBoundingClientRect();
    stickyButton?.focus();
    return {
      hidden: sticky?.getAttribute('aria-hidden') === 'true',
      inert: sticky?.inert === true,
      focusBlocked: document.activeElement !== stickyButton,
      noPointerCapture: getComputedStyle(sticky).pointerEvents === 'none',
      privacyVisible: !!rect && rect.top >= 0 && rect.bottom <= innerHeight,
    };
  })()`);
  assert.equal(footerState.hidden, true, 'mobile sticky CTA hides when the footer enters view');
  assert.equal(footerState.inert, true, 'hidden CTA subtree is inert');
  assert.equal(footerState.focusBlocked, true, 'hidden CTA cannot receive keyboard focus');
  assert.equal(footerState.noPointerCapture, true, 'hidden CTA cannot capture footer clicks');
  assert.equal(footerState.privacyVisible, true, 'footer legal links remain visible at page bottom');

  assert.equal(
    await statusWithHost(`${directBaseUrl}/mall`, 'vn.tarmeer.com'),
    404,
    'VN host receives a real 404 for the AE-only mall page',
  );

  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call('Page.reload', { ignoreCache: true });
  await waitUntil("document.readyState === 'complete' && !!document.querySelector('h1')", 'desktop mall page');
  await delay(1800);

  const desktop = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('article')].slice(0, 3).map((card) => card.getBoundingClientRect());
    const cta = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Talk to a Material Consultant') &&
      getComputedStyle(button).display !== 'none' &&
      !button.closest('.fixed')
    );
    return {
      width: innerWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
      cardsShareRow: cards.length === 3 && Math.max(...cards.map((card) => card.top)) - Math.min(...cards.map((card) => card.top)) < 2,
      ctaVisible: !!cta,
    };
  })()`);
  assert.equal(desktop.width, 1440, 'desktop viewport is 1440px wide');
  assert.equal(desktop.noHorizontalOverflow, true, 'desktop page has no horizontal overflow');
  assert.equal(desktop.cardsShareRow, true, 'desktop experience cards form one row');
  assert.equal(desktop.ctaVisible, true, 'desktop consultation CTA is visible');

  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Talk to a Material Consultant') &&
      getComputedStyle(item).display !== 'none' &&
      !item.closest('.fixed')
    );
    button.focus();
    button.click();
  })()`);
  await waitUntil(
    "document.querySelector('[role=dialog]')?.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false'",
    'desktop consultation drawer',
  );
  await waitUntil(
    "Math.abs(document.querySelector('[role=dialog]').getBoundingClientRect().right - document.documentElement.clientWidth) < 2",
    'desktop drawer animation',
  );
  const desktopDrawer = await evaluate(`(() => {
    const rect = document.querySelector('[role=dialog]').getBoundingClientRect();
    return { rightAligned: Math.abs(rect.right - document.documentElement.clientWidth) < 2, bounded: rect.width <= 470 && rect.height <= innerHeight };
  })()`);
  assert.equal(desktopDrawer.rightAligned, true, 'desktop form opens as a right-side drawer');
  assert.equal(desktopDrawer.bounded, true, 'desktop drawer remains inside the viewport');

  console.log('26/26 PASS — real browser PC/mobile layout, VR viewpoint, modal focus, inert footer clearance, metadata and country gate');
} finally {
  socket?.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await Promise.race([chromeExited, delay(3000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
