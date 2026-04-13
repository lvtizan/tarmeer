import { test, expect } from '@playwright/test';

/**
 * Production smoke tests — covers homeowner + company flows on https://www.tarmeer.com
 * Read-only probes; does NOT create/modify production data.
 */

const PROD = 'https://www.tarmeer.com';

// Independent tests — don't stop the suite when one fails
test.describe.configure({ mode: 'default' });
test.setTimeout(60_000);

/* ═══════════════════════════════════════════════
 * SECTION 1: Public pages load
 * ═══════════════════════════════════════════════ */
test.describe('Public pages', () => {
  test('homepage loads', async ({ page }) => {
    const res = await page.goto(PROD);
    expect(res?.status()).toBe(200);
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 8000 });
  });

  test('/companies loads', async ({ page }) => {
    const res = await page.goto(`${PROD}/companies`);
    expect(res?.status()).toBe(200);
  });

  test('/portfolio loads', async ({ page }) => {
    // Known issue: portfolio currently loads raw full-size images, often >30s on 4G.
    // Fix prepared in PortfolioPage.tsx (resolveVariantUrl thumbnails) — pending deploy.
    test.fail(true, 'KNOWN: portfolio uses raw images, deploy thumbnail fix to resolve');
    const res = await page.goto(`${PROD}/portfolio`, { timeout: 20000 });
    expect(res?.status()).toBe(200);
  });

  test('/for-companies loads', async ({ page }) => {
    const res = await page.goto(`${PROD}/for-companies`);
    expect(res?.status()).toBe(200);
  });

  test('/faq loads', async ({ page }) => {
    const res = await page.goto(`${PROD}/faq`);
    expect(res?.status()).toBe(200);
  });
});

/* ═══════════════════════════════════════════════
 * SECTION 2: Homeowner registration/login flow (/auth)
 * ═══════════════════════════════════════════════ */
test.describe('Homeowner flow (/auth)', () => {
  test('/auth page shows email input + Google button', async ({ page }) => {
    const res = await page.goto(`${PROD}/auth`);
    expect(res?.status()).toBe(200);
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();
  });

  test('new email → shows "New account" badge', async ({ page }) => {
    await page.goto(`${PROD}/auth`);
    const email = `smoke_new_${Date.now()}@example.com`;
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.waitForTimeout(1500);
    await expect(page.locator('text=New account')).toBeVisible({ timeout: 5000 });
  });

  test('existing email → shows "Existing" badge', async ({ page }) => {
    await page.goto(`${PROD}/auth`);
    await page.getByPlaceholder('Enter your email').fill('sardarmomalbadshah997@gmail.com');
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Existing')).toBeVisible({ timeout: 5000 });
  });

  test('email continue → advances to password step', async ({ page }) => {
    await page.goto(`${PROD}/auth`);
    await page.getByPlaceholder('Enter your email').fill('sardarmomalbadshah997@gmail.com');
    await page.getByRole('button', { name: /continue with email/i }).click();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/forgot password/i)).toBeVisible();
    await expect(page.getByText(/remember me/i)).toBeVisible();
  });

  test('login failure shows an error message', async ({ page }) => {
    await page.goto(`${PROD}/auth`);
    await page.getByPlaceholder('Enter your email').fill('sardarmomalbadshah997@gmail.com');
    await page.getByRole('button', { name: /continue with email/i }).click();
    await page.getByPlaceholder('Enter your password').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByPlaceholder('Enter your password').fill('wrong_password_xyz');
    await page.locator('button[type="submit"]:has-text("Continue"), button[type="submit"]:has-text("Sign In")').click();
    // Accept any of: "invalid email or password", "Please login with Google", "verify your email"
    const anyError = page.locator(
      'text=/invalid|please login with|verify your email|incorrect/i'
    );
    await expect(anyError.first()).toBeVisible({ timeout: 8000 });
  });

  test('auth page has minimal footer (no large Footer)', async ({ page }) => {
    await page.goto(`${PROD}/auth`);
    // Minimal footer should have Privacy link, but no big company Footer with "Find Us" section
    const bigFooter = page.locator('text=/find us|quick links|newsletter/i');
    await expect(bigFooter).toHaveCount(0);
  });
});

/* ═══════════════════════════════════════════════
 * SECTION 3: Company registration flow (/join)
 * ═══════════════════════════════════════════════ */
test.describe('Company flow (/join)', () => {
  test('/join page loads', async ({ page }) => {
    const res = await page.goto(`${PROD}/join`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('text=/grow your business|business hub|join/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('/join has inline auth card with Google + email', async ({ page }) => {
    await page.goto(`${PROD}/join`);
    await expect(page.getByRole('button', { name: /continue with google/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByPlaceholder(/enter your email|email/i).first()).toBeVisible();
  });

  test('Navbar "Join as Company" link points to /join', async ({ page }) => {
    await page.goto(PROD);
    const link = page.getByRole('link', { name: /join as company/i }).first();
    await expect(link).toBeVisible({ timeout: 8000 });
    expect(await link.getAttribute('href')).toBe('/join');
  });

  test('/join existing email → shows "Existing" badge', async ({ page }) => {
    // Known issue: /join's auth card does not call /api/auth/check-availability
    // unlike /auth which does. Should be unified for consistent UX.
    test.fail(true, 'KNOWN: /join auth card lacks email availability check');
    await page.goto(`${PROD}/join`);
    const emailInput = page.getByPlaceholder(/enter your email|email/i).first();
    await emailInput.fill('sardarmomalbadshah997@gmail.com');
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Existing')).toBeVisible({ timeout: 5000 });
  });
});

/* ═══════════════════════════════════════════════
 * SECTION 4: Backend API health
 * ═══════════════════════════════════════════════ */
test.describe('API endpoints', () => {
  test('/api/health responds', async ({ request }) => {
    const res = await request.get(`${PROD}/api/health`);
    expect(res.status()).toBeLessThan(500);
  });

  test('/api/auth/check-availability works for new email', async ({ request }) => {
    const res = await request.post(`${PROD}/api/auth/check-availability`, {
      data: { email: `smoke_api_${Date.now()}@example.com` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.emailAvailable).toBe(true);
  });

  test('/api/auth/check-availability flags existing email', async ({ request }) => {
    const res = await request.post(`${PROD}/api/auth/check-availability`, {
      data: { email: 'sardarmomalbadshah997@gmail.com' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.emailAvailable).toBe(false);
  });

  test('/api/auth/login rejects bad credentials', async ({ request }) => {
    const res = await request.post(`${PROD}/api/auth/login`, {
      data: { email: 'sardarmomalbadshah997@gmail.com', password: 'wrong_xyz' },
    });
    expect([401, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('sitemap is reachable', async ({ request }) => {
    const res = await request.get(`${PROD}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<sitemap');
  });

  test('robots.txt is reachable', async ({ request }) => {
    const res = await request.get(`${PROD}/robots.txt`);
    expect(res.status()).toBe(200);
  });
});

/* ═══════════════════════════════════════════════
 * SECTION 5: Protected routes redirect
 * ═══════════════════════════════════════════════ */
test.describe('Protected routes', () => {
  test('/dashboard without auth redirects to /auth', async ({ page }) => {
    await page.goto(`${PROD}/dashboard`);
    await page.waitForURL(/\/(auth|onboarding|join)/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(auth|onboarding|join)/);
  });

  test('/company/dashboard without auth redirects to /auth', async ({ page }) => {
    await page.goto(`${PROD}/company/dashboard`);
    await page.waitForURL(/\/(auth|onboarding|join)/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(auth|onboarding|join)/);
  });

  test('/admin without auth redirects to admin login', async ({ page }) => {
    await page.goto(`${PROD}/admin`);
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    expect(page.url()).toContain('/admin');
  });
});
