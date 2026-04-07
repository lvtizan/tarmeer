#!/usr/bin/env node
/**
 * lint-cors-nginx.mjs
 * Checks that the CORS whitelist and Nginx configs are consistent.
 *
 * - Every production domain in corsOrigins.ts (excluding IPs) must have
 *   a matching server_name in one of the nginx-*.conf files.
 * - Both nginx-tarmeer.conf and nginx-admin.conf must exist locally.
 *
 * Exit 1 on any failure.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../..');

let failures = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); failures++; }

// ── 1. Parse production domains from corsOrigins.ts ─────────────────────────

const corsPath = join(ROOT, 'server/src/lib/corsOrigins.ts');
const corsSource = readFileSync(corsPath, 'utf-8');

// Extract the production array from CORS_CONFIG
const prodMatch = corsSource.match(/production:\s*\[([\s\S]*?)\]/);
if (!prodMatch) {
  fail('Could not parse production array from corsOrigins.ts');
  process.exit(1);
}

// Remove lines that are purely comments (leading whitespace + //)
const prodBlock = prodMatch[1]
  .split('\n')
  .filter(line => !/^\s*\/\//.test(line))
  .join('\n');

const prodDomains = [...prodBlock.matchAll(/'([^']+)'|"([^"]+)"/g)]
  .map(m => m[1] || m[2])
  .filter(Boolean);

// Extract hostnames, skip IPs
const corsHosts = prodDomains
  .map(url => { try { return new URL(url).hostname; } catch { return null; } })
  .filter(Boolean)
  .filter(h => !/^\d+\.\d+\.\d+\.\d+$/.test(h));

const uniqueCorsHosts = [...new Set(corsHosts)];

console.log('\n🔍 CORS ↔ Nginx consistency check\n');
console.log(`   CORS production hosts: ${uniqueCorsHosts.join(', ')}`);

// ── 2. Parse server_name values from nginx-*.conf files ─────────────────────

const nginxFiles = readdirSync(ROOT).filter(f => /^nginx-.*\.conf$/.test(f));
const nginxServerNames = new Set();

for (const file of nginxFiles) {
  const content = readFileSync(join(ROOT, file), 'utf-8');
  const matches = content.matchAll(/server_name\s+([^;]+);/g);
  for (const m of matches) {
    m[1].trim().split(/\s+/).forEach(name => nginxServerNames.add(name));
  }
}

console.log(`   Nginx server_names:    ${[...nginxServerNames].join(', ')}\n`);

// ── 3. Check required nginx config files exist ──────────────────────────────

for (const required of ['nginx-tarmeer.conf', 'nginx-admin.conf']) {
  const p = join(ROOT, required);
  if (existsSync(p)) {
    pass(`${required} exists`);
  } else {
    fail(`${required} missing from repo root`);
  }
}

// ── 4. Check every CORS host has an nginx server block ──────────────────────

for (const host of uniqueCorsHosts) {
  if (nginxServerNames.has(host)) {
    pass(`${host} has nginx server block`);
  } else {
    fail(`${host} in CORS whitelist but NO nginx server block found`);
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.log(`❌ ${failures} problem(s) found.\n`);
  process.exit(1);
} else {
  console.log('✅ CORS and Nginx configs are consistent.\n');
}
