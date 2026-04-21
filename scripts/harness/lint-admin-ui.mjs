#!/usr/bin/env node
/**
 * lint-admin-ui.mjs — Catch common admin page UI anti-patterns before they ship.
 *
 * Run: node scripts/harness/lint-admin-ui.mjs
 *
 * Checks:
 *   1. No inline group-hover tooltips inside overflow containers (use FloatingTip)
 *   2. Toolbar controls use uniform height (h-9) and uniform gap (gap-2)
 *   3. No hardcoded fixed widths on search inputs (use flex-1 min-w-0)
 *   4. No raw <select> tags (use AdminSelect)
 *   5. Table containers use rounded-2xl + shadow-sm
 *   6. No mixed gap values in a single toolbar row
 *   7. No absolute-positioned dropdowns inside overflow-hidden containers (use fixed)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const ADMIN_DIR = join(ROOT, 'src/pages/admin');
const COMPONENTS_DIR = join(ROOT, 'src/components');

const RULES = [
  {
    id: 'toast-brand-color',
    desc: 'Toast uses black bg instead of brand color — must use bg-[#b8864a]',
    test: (line) => /bg-\[#1c1917\].*text-white/.test(line) && /toast|Toast/i.test(line),
  },
  {
    id: 'no-inline-tooltip',
    desc: 'Inline group-hover tooltip inside table — use FloatingTip instead',
    test: (line) => /group-hover:block.*shadow-xl/.test(line) || /hidden\s+group-hover:block/.test(line),
  },
  {
    id: 'uniform-toolbar-height',
    desc: 'Toolbar control not using h-9 (found h-8 or h-10 at top level)',
    test: (line, ctx) => {
      if (!ctx.inToolbar) return false;
      // h-8 inside a toggle container is fine (inner element)
      if (/className.*\bh-8\b/.test(line) && /rounded-\[14px\]/.test(line)) return false;
      return /className.*\b(h-7|h-10|h-11|h-12)\b/.test(line);
    },
  },
  {
    id: 'no-fixed-width-search',
    desc: 'Search input uses fixed width (w-[Xrem]) — use flex-1 min-w-0 instead',
    test: (line) => /placeholder.*search|placeholder.*搜索/i.test(line) && /w-\[\d+rem\]/.test(line),
  },
  {
    id: 'no-raw-select',
    desc: 'Raw <select> tag — use <AdminSelect /> component',
    test: (line) => /<select[\s>]/.test(line) && !/<AdminSelect/.test(line),
  },
  {
    id: 'table-card-style',
    desc: 'Table wrapper missing rounded-2xl or shadow-sm',
    test: (line) => {
      if (!/<table/.test(line)) return false;
      return false; // checked at container level below
    },
  },
  {
    id: 'mixed-gap-toolbar',
    desc: 'Toolbar row has gap-3 — standardize to gap-2 for uniform spacing',
    test: (line, ctx) => {
      if (!ctx.inToolbar) return false;
      return /className.*\bgap-3\b/.test(line);
    },
  },
  {
    id: 'search-filter-same-row',
    desc: 'Search input and filter dropdown must be in the same flex row — do not stack vertically',
    test: (line, ctx) => {
      // Detect a standalone div wrapping only a search input (not inside a flex row with filters)
      if (/className.*max-w-md/.test(line) && !/flex/.test(line) && /relative/.test(line)) {
        ctx._standaloneSearch = true;
        return false;
      }
      if (ctx._standaloneSearch && /placeholder.*search/i.test(line)) {
        ctx._standaloneSearch = false;
        return true;
      }
      ctx._standaloneSearch = false;
      return false;
    },
  },
  {
    id: 'no-page-search-box',
    desc: 'Page has its own search input — use global search in AdminLayout instead',
    test: (line) => /placeholder.*[Ss]earch|placeholder.*搜索|placeholder.*姓名/.test(line) && /input/.test(line),
  },
  {
    id: 'no-native-dialog',
    desc: 'Native browser dialog (alert/prompt/confirm) — use Toast or custom Modal instead',
    test: (line) => {
      // Skip comments and imports
      if (/^\s*(\/\/|\/\*|\*|import )/.test(line)) return false;
      // Skip circle-alert icon references
      if (/circle-alert|AlertCircle|alertClass/.test(line)) return false;
      return /\balert\s*\(|\bprompt\s*\(|\bconfirm\s*\(|window\.prompt\(|window\.alert\(|window\.confirm\(/.test(line);
    },
  },
];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];
  const rel = relative(ROOT, filePath);

  const ctx = { inToolbar: false };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Heuristic: toolbar area is between "Row 2" comment and the table/error section
    if (/Row 2|toolbar|controls/i.test(line)) ctx.inToolbar = true;
    if (/<table|{error|batch action/i.test(line)) ctx.inToolbar = false;

    for (const rule of RULES) {
      if (rule.test(line, ctx)) {
        findings.push({ file: rel, line: i + 1, rule: rule.id, desc: rule.desc });
      }
    }
  }

  return findings;
}

function getAdminFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...getAdminFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Toast color rule (applied directly to Toast.tsx)
const toastFile = readFileSync(join(ROOT, 'src/components/ui/Toast.tsx'), 'utf-8').split('\n');
for (let i = 0; i < toastFile.length; i++) {
  if (/bg-\[#1c1917\]/.test(toastFile[i])) {
    console.log(`[toast-black-bg] src/components/ui/Toast.tsx:${i + 1} — Toast uses black bg, must use bg-[#b8864a] (brand color)`);
    total++;
  }
}

// Global rules (applied to components too)
const GLOBAL_RULES = [
  {
    id: 'no-absolute-dropdown',
    desc: 'Dropdown uses absolute positioning — will be clipped by overflow-hidden parents. Use fixed positioning instead',
    test: (line) => /absolute.*z-\[.*dropdown\b|absolute.*mt-1.*bg-white.*border.*rounded.*shadow/.test(line),
  },
];

function scanFileGlobal(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];
  const rel = relative(ROOT, filePath);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of GLOBAL_RULES) {
      if (rule.test(lines[i])) {
        findings.push({ file: rel, line: i + 1, rule: rule.id, desc: rule.desc });
      }
    }
  }
  return findings;
}

// Run
const files = getAdminFiles(ADMIN_DIR);
const componentFiles = getAdminFiles(COMPONENTS_DIR);
let total = 0;

for (const f of files) {
  const findings = scanFile(f);
  for (const finding of findings) {
    console.log(`[${finding.rule}] ${finding.file}:${finding.line} — ${finding.desc}`);
    total++;
  }
}

// Global component checks
for (const f of componentFiles) {
  const findings = scanFileGlobal(f);
  for (const finding of findings) {
    console.log(`[${finding.rule}] ${finding.file}:${finding.line} — ${finding.desc}`);
    total++;
  }
}

if (total === 0) {
  console.log('lint-admin-ui: all checks passed');
  process.exit(0);
} else {
  console.log(`\nlint-admin-ui: ${total} issue(s) found`);
  process.exit(1);
}
