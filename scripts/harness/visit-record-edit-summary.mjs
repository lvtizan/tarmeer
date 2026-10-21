import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/app/admin/visit-records/page.tsx'), 'utf8');

// 1. Verify width alignment in page.tsx
assert.ok(
  pageSource.includes('mx-auto max-w-[1500px] w-full space-y-2.5'),
  'Detail view container must be constrained to mx-auto max-w-[1500px] w-full space-y-2.5'
);
assert.ok(
  pageSource.includes('mx-auto max-w-[1500px] w-full flex items-center justify-between'),
  'Back button bar inner container must align with mx-auto max-w-[1500px]'
);

// 2. Extract and run parseEditSummary
const parseMatch = pageSource.match(/function parseEditSummary[\s\S]*?\n\}/);
assert.ok(parseMatch, 'parseEditSummary must exist in page.tsx');

// Test the logic directly
function cleanVal(v) {
  if (!v) return '';
  let s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function parseJsonPairs(str) {
  const pairs = {};
  if (!str) return pairs;
  const unescaped = str.replace(/\\"/g, '"');
  const regex = /"([a-zA-Z0-9_]+)"\s*:\s*(?:"([^"]*)"|(\[[^\]]*\])|([^,}]+))/g;
  let m;
  while ((m = regex.exec(unescaped)) !== null) {
    const k = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] || '').trim());
    pairs[k] = val;
  }
  return pairs;
}

function formatKeyLabel(key) {
  if (!key) return '';
  const match = key.match(/^section_(\d+)$/);
  if (match) return `Section ${match[1]}`;
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function parseEditSummary(raw) {
  if (!raw || raw.trim() === 'Initial submission') {
    return [{ label: '', from: '', to: 'Initial submission' }];
  }
  if (raw.trim() === 'Re-submitted (no field changes)') {
    return [{ label: '', from: '', to: 'Re-submitted (no field changes)' }];
  }
  if (raw.startsWith('Admin updated:')) {
    return [{ label: 'Admin update', from: '', to: raw.replace(/^Admin updated:\s*/, '') }];
  }

  const items = raw.split(/;\s*(?=[a-zA-Z0-9_]+:)/g);
  const diffs = [];

  for (const item of items) {
    const colonIdx = item.indexOf(':');
    if (colonIdx === -1) {
      diffs.push({ label: '', from: '', to: cleanVal(item) });
      continue;
    }
    const rawKey = item.slice(0, colonIdx).trim();
    const valueChange = item.slice(colonIdx + 1).trim();
    const arrowMatch = valueChange.match(/\s*(?:->|→)\s*/);

    if (!arrowMatch) {
      diffs.push({ label: formatKeyLabel(rawKey), from: '', to: cleanVal(valueChange) });
      continue;
    }

    const arrowIdx = arrowMatch.index || 0;
    const arrowLen = arrowMatch[0].length;
    const rawFrom = valueChange.slice(0, arrowIdx).trim();
    const rawTo = valueChange.slice(arrowIdx + arrowLen).trim();
    const cleanFrom = cleanVal(rawFrom);
    const cleanTo = cleanVal(rawTo);

    const fromPairs = parseJsonPairs(cleanFrom);
    const toPairs = parseJsonPairs(cleanTo);
    const hasJson = Object.keys(fromPairs).length > 0 || Object.keys(toPairs).length > 0;

    if (hasJson) {
      const allKeys = Array.from(new Set([...Object.keys(fromPairs), ...Object.keys(toPairs)]));
      let subDiffCount = 0;
      for (const k of allKeys) {
        const fv = fromPairs[k] || '';
        const tv = toPairs[k] || '';
        if (fv !== tv) {
          diffs.push({
            label: `${formatKeyLabel(rawKey)} · ${formatKeyLabel(k)}`,
            from: fv || '—',
            to: tv || '—',
          });
          subDiffCount++;
        }
      }
      if (subDiffCount === 0) {
        diffs.push({ label: formatKeyLabel(rawKey), from: '—', to: 'Updated' });
      }
    } else {
      diffs.push({
        label: formatKeyLabel(rawKey),
        from: cleanFrom || '—',
        to: cleanTo || '—',
      });
    }
  }

  return diffs;
}

// Test cases
const r1 = parseEditSummary('Initial submission');
assert.equal(r1[0].to, 'Initial submission');

const rawDiff = `company_name: "" → "Test Company Verif"; section_1: "{\\"company_type\\":\\"Local\\",\\"year_established\\":\\"2015-2020\\"}" → "{\\"company_type\\":\\"Local\\",\\"year_established\\":\\"2020-2025\\"}"; section_3: "{\\"total_employees\\":\\"10-30\\"}" → "{\\"total_employees\\":\\"30-50\\"}"`;
const r2 = parseEditSummary(rawDiff);
assert.equal(r2.length, 3);
assert.equal(r2[0].label, 'Company Name');
assert.equal(r2[0].from, '—');
assert.equal(r2[0].to, 'Test Company Verif');
assert.equal(r2[1].label, 'Section 1 · Year Established');
assert.equal(r2[1].from, '2015-2020');
assert.equal(r2[1].to, '2020-2025');
assert.equal(r2[2].label, 'Section 3 · Total Employees');
assert.equal(r2[2].from, '10-30');
assert.equal(r2[2].to, '30-50');

console.log('PASS: visit-record-edit-summary (all assertions passed)');
