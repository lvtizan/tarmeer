#!/usr/bin/env node

/**
 * lint-docs-freshness.mjs
 *
 * Garbage-collection layer: checks critical documentation files for staleness.
 * Flags docs last committed > 30 days ago, or not yet committed.
 * Informational only — always exits 0.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const CRITICAL_DOCS = [
  "docs/RELIABILITY.md",
  "docs/SECURITY.md",
  "docs/DESIGN.md",
  "docs/FRONTEND.md",
  "docs/QUALITY.md",
  "docs/operations/deploy-runbook.md",
  "docs/testing/index.md",
  "docs/references/cors-domains.md",
  "ARCHITECTURE.md",
];

const STALE_THRESHOLD_DAYS = 30;

function getLastCommitDate(filePath) {
  try {
    const output = execSync(`git log -1 --format="%ai" -- "${filePath}"`, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function daysBetween(dateStr, now) {
  const then = new Date(dateStr);
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function run() {
  const now = new Date();
  let staleCount = 0;

  console.log("=== Documentation Freshness Check ===\n");

  for (const relPath of CRITICAL_DOCS) {
    const absPath = resolve(ROOT, relPath);
    const exists = existsSync(absPath);

    if (!exists) {
      console.log(`  ❌  ${relPath} — file not found, skipping`);
      continue;
    }

    const lastCommitDate = getLastCommitDate(relPath);

    if (!lastCommitDate) {
      // File exists but has never been committed
      console.log(`  🆕  ${relPath} — not yet committed`);
      continue;
    }

    const age = daysBetween(lastCommitDate, now);

    if (age > STALE_THRESHOLD_DAYS) {
      staleCount++;
      console.log(
        `  ⚠️   ${relPath} — last updated ${age} days ago (${lastCommitDate.split(" ")[0]})`
      );
    } else {
      console.log(
        `  ✅  ${relPath} — fresh (${age} days ago, ${lastCommitDate.split(" ")[0]})`
      );
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Stale docs (>${STALE_THRESHOLD_DAYS} days): ${staleCount}`);

  if (staleCount > 0) {
    console.log("Consider reviewing and updating the stale documents above.");
  } else {
    console.log("All committed docs are within the freshness threshold.");
  }
}

run();
