# Showcase Seed Designers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable production-safe seed flow that publishes 26 showcase designers with unique names, unique avatars, and 6-8 published projects per designer so `www.tarmeer.com` immediately shows real-looking public content.

**Architecture:** Create one dedicated showcase seed script instead of mixing this content into admin demo data. The script will identify only showcase-owned rows by their dedicated email marker, delete only those prior rows, insert approved/public designers plus published projects and designer stats, and keep the showcase accounts non-login so public content appears without creating usable production credentials.

**Tech Stack:** MySQL, SQL seed files, Node.js deployment shell, Express public API

---

### Task 1: Add isolated showcase seed script

**Files:**
- Create: `server/scripts/seed-showcase-designers.js`

**Step 1: Define isolated seed scope**
- Reserve a dedicated ID range for showcase designers to avoid touching real user rows.
- Use fixed emails, phone numbers, cities, and avatar URLs so reruns are deterministic.

**Step 2: Build public-ready content**
- Insert 26 `approved` + `is_approved = 1` + `email_verified = 1` designers.
- Assign descending `display_order` so homepage ordering is deterministic.
- Insert 6-8 `published` projects per designer with public-safe image URLs and tags.
- Insert `designer_stats` rows so view-based admin widgets are not empty.

**Step 3: Make reruns safe**
- Delete only showcase `designer_stats`, `projects`, and `designers` rows before inserting.
- Identify showcase rows by dedicated marker values, not by a bare production ID range.
- End with a summary output so production import gives a clear success signal.

### Task 2: Apply showcase seed to production

**Files:**
- Modify: none

**Step 1: Upload and execute seed**
- Copy the new seed file to the deployed backend directory if needed.
- Run it against the production DB using server `.env` credentials.

**Step 2: Verify database result**
- Confirm the production DB now contains 26 approved showcase designers.
- Confirm published projects count matches the generated total.

### Task 3: Verify public site output

**Files:**
- Modify: none unless fixes are needed

**Step 1: API verification**
- Check `https://www.tarmeer.com/api/designers`
- Check `https://www.tarmeer.com/api/projects`
- Confirm both return populated arrays and pagination totals above zero.

**Step 2: Frontend verification**
- Check `https://www.tarmeer.com`
- Confirm homepage title still loads and public designer/project content is no longer empty.

**Step 3: Smoke verification**
- Re-run the public smoke script against `https://www.tarmeer.com/api`.
- If it still fails, separate “service failure” from “data expectation mismatch” and fix only the real blocker.
