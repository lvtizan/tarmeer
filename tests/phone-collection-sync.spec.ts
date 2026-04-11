import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, '..', 'server');

/**
 * Phone Collection Modal → Profile Sync Tests
 *
 * Verifies that after the forced phone collection modal saves a phone number,
 * the phone field in the personal center / company dashboard is updated.
 */

/* ── DB helpers ── */
function runMysql(sql: string) {
  execSync(`mysql -uroot tarmeer -e "${sql.replace(/"/g, '\\"')}"`);
}

function createTestUser(email: string, password: string, role: 'user' | 'company') {
  const tmpFile = join(SERVER_DIR, `_test_create_user_${Date.now()}.cjs`);
  const script = [
    `const bcrypt = require('bcryptjs');`,
    `const mysql = require('mysql2/promise');`,
    `(async () => {`,
    `  const hash = await bcrypt.hash(${JSON.stringify(password)}, 10);`,
    `  const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'tarmeer' });`,
    `  const activeRole = ${JSON.stringify(role === 'company' ? 'company' : 'homeowner')};`,
    `  await conn.execute(`,
    `    'INSERT INTO users (email, password, full_name, phone, role, active_role, email_verified, status) VALUES (?, ?, ?, NULL, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE phone = NULL, password = VALUES(password), active_role = VALUES(active_role)',`,
    `    [${JSON.stringify(email)}, hash, 'Test User', ${JSON.stringify(role)}, activeRole, 'active']`,
    `  );`,
    `  await conn.end();`,
    `})();`,
  ].join('\n');
  writeFileSync(tmpFile, script);
  try {
    execSync(`node ${tmpFile}`, { cwd: SERVER_DIR, timeout: 10000 });
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

function clearTestUserPhone(email: string) {
  runMysql(`UPDATE users SET phone = NULL WHERE email = '${email}'`);
}

function getTestUserPhone(email: string): string {
  const result = execSync(
    `mysql -uroot tarmeer -N -e "SELECT IFNULL(phone,'') FROM users WHERE email = '${email}'"`,
  ).toString().trim();
  return result;
}

function cleanupTestUser(email: string) {
  // Use subquery-safe delete order
  runMysql(`DELETE cp FROM company_profiles cp INNER JOIN users u ON cp.user_id = u.id WHERE u.email = '${email}'`);
  runMysql(`DELETE FROM users WHERE email = '${email}'`);
}

/* ── Login helper (two-step auth flow) ── */
async function loginAs(page: any, email: string, password: string) {
  await page.goto('/auth');
  // Step 1: enter email
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByRole('button', { name: /continue with email/i }).click();
  // Step 2: enter password (wait for password step to appear)
  const pwdInput = page.getByPlaceholder('Enter your password');
  await pwdInput.waitFor({ state: 'visible', timeout: 5000 });
  await pwdInput.fill(password);
  // Click the Continue/Sign In button (not "Continue with email")
  await page.locator('button[type="submit"]:has-text("Continue"), button[type="submit"]:has-text("Sign In")').click();
  // Wait for redirect away from /auth
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/auth'), { timeout: 10000 });
}

/* ══════════════════════════════════════════════════
   Test Suite: Individual User (role = 'user')
   ══════════════════════════════════════════════════ */
test.describe('Phone modal → Profile sync (individual user)', () => {
  test.describe.configure({ mode: 'serial' });

  const EMAIL = `phonetest_user_${Date.now()}@example.com`;
  const PASSWORD = 'test123456';

  test.beforeAll(() => {
    createTestUser(EMAIL, PASSWORD, 'user');
  });

  test.afterAll(() => {
    cleanupTestUser(EMAIL);
  });

  test('phone modal appears when phone is missing', async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);

    // Navigate to dashboard profile
    await page.goto('/dashboard/profile');

    // The forced phone modal should appear
    const modal = page.locator('text=Phone Number Required');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('phone saved via modal appears in profile page', async ({ page }) => {
    clearTestUserPhone(EMAIL);
    await loginAs(page, EMAIL, PASSWORD);

    await page.goto('/dashboard/profile');

    // Wait for modal
    const modal = page.locator('text=Phone Number Required');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Select UAE (+971) and enter 9-digit number
    const digitsInput = page.locator('input[type="tel"][inputmode="numeric"]');
    await digitsInput.fill('501234567');

    // Submit
    await page.getByRole('button', { name: 'Continue' }).click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // The profile page phone field should now contain the phone number
    const profilePhoneInput = page.locator('section input[type="tel"]');
    await expect(profilePhoneInput).toHaveValue('+971501234567', { timeout: 5000 });

    // Verify DB was updated
    const dbPhone = getTestUserPhone(EMAIL);
    expect(dbPhone).toBe('+971501234567');
  });

  test('phone persists in profile after page reload', async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto('/dashboard/profile');

    // Modal should NOT appear (phone already saved)
    const modal = page.locator('text=Phone Number Required');
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // Phone field should still have the value
    const profilePhoneInput = page.locator('section input[type="tel"]');
    await expect(profilePhoneInput).toHaveValue('+971501234567', { timeout: 5000 });
  });
});

/* ══════════════════════════════════════════════════
   Test Suite: Company User (role = 'company')
   ══════════════════════════════════════════════════ */
test.describe('Phone modal → Company dashboard sync (company user)', () => {
  test.describe.configure({ mode: 'serial' });

  const EMAIL = `phonetest_company_${Date.now()}@example.com`;
  const PASSWORD = 'test123456';

  test.beforeAll(() => {
    createTestUser(EMAIL, PASSWORD, 'company');
  });

  test.afterAll(() => {
    cleanupTestUser(EMAIL);
  });

  test('phone modal appears for company user without phone', async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);

    // Company users land on /company/dashboard
    await page.goto('/company/dashboard');

    const modal = page.locator('text=Phone Number Required');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('phone saved via modal syncs to company dashboard phone field', async ({ page }) => {
    clearTestUserPhone(EMAIL);
    await loginAs(page, EMAIL, PASSWORD);

    await page.goto('/company/dashboard');

    // Wait for modal
    const modal = page.locator('text=Phone Number Required');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Enter phone: UAE +971, 9 digits
    const digitsInput = page.locator('input[type="tel"][inputmode="numeric"]');
    await digitsInput.fill('551234567');

    await page.getByRole('button', { name: 'Continue' }).click();

    // Modal closes
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Company dashboard phone field should have the number
    const companyPhoneInput = page.locator('input[type="tel"][placeholder="+971 50 123 4567"]');
    await expect(companyPhoneInput).toHaveValue('+971551234567', { timeout: 5000 });
  });
});

/* ══════════════════════════════════════════════════
   Test Suite: localStorage sync
   ══════════════════════════════════════════════════ */
test.describe('Phone modal → localStorage sync', () => {
  const EMAIL = `phonetest_ls_${Date.now()}@example.com`;
  const PASSWORD = 'test123456';

  test.beforeAll(() => {
    createTestUser(EMAIL, PASSWORD, 'user');
  });

  test.afterAll(() => {
    cleanupTestUser(EMAIL);
  });

  test('localStorage user.phone is updated after modal submit', async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto('/dashboard/profile');

    // Wait for modal
    await expect(page.locator('text=Phone Number Required')).toBeVisible({ timeout: 5000 });

    // Before: phone should be null/empty in localStorage
    const phoneBefore = await page.evaluate(() => {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw).phone : null;
    });
    expect(phoneBefore).toBeFalsy();

    // Fill and submit
    await page.locator('input[type="tel"][inputmode="numeric"]').fill('501234567');
    await page.getByRole('button', { name: 'Continue' }).click();

    // After: localStorage should have the phone
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('user');
      return raw && JSON.parse(raw).phone;
    }, null, { timeout: 5000 });

    const phoneAfter = await page.evaluate(() => {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw).phone : null;
    });
    expect(phoneAfter).toBe('+971501234567');
  });
});
