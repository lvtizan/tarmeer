import { test, expect } from '@playwright/test';

test.describe('layout and navbar smoke', () => {
  test('admin login uses top-biased layout and hides user-specific navbar actions', async ({ page }) => {
    await page.route('**/api/admin/check-installation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('token', 'frontend-user-token');
      localStorage.setItem('user', JSON.stringify({
        full_name: 'Smoke User',
        avatar_url: '/images/designers/avatars/omar-farouk.jpg',
      }));
      localStorage.setItem('active_role', 'homeowner');
    });

    await page.goto('/admin/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Tarmeer Admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Join as Company')).toHaveCount(0);

    const avatarLinks = page.locator('a[aria-label="Open dashboard"]');
    await expect(avatarLinks).toHaveCount(0);

    const wrapper = page.locator('div.min-h-\\[calc\\(100vh-4rem\\)\\]').first();
    await expect(wrapper).toBeVisible();
    await expect(wrapper).toHaveClass(/pt-\[clamp\(28px,10vh,96px\)\]/);
  });

  test('user dashboard sidebar reuses the fixed company-style navigation shell', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            full_name: 'Smoke Homeowner',
            email: 'smoke@example.com',
            phone: '',
            city: 'Dubai',
            avatar_url: '',
            created_at: new Date().toISOString(),
          },
          active_role: 'homeowner',
        }),
      });
    });

    await page.route('**/api/auth/homeowner/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: null }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('token', 'homeowner-token');
      localStorage.setItem('active_role', 'homeowner');
      localStorage.setItem('user', JSON.stringify({
        full_name: 'Smoke Homeowner',
        email: 'smoke@example.com',
      }));
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveClass(/fixed/);
    await expect(sidebar).toHaveClass(/top-\[57px\]/);
    await expect(sidebar).toHaveClass(/bottom-0/);

    const main = page.locator('main').first();
    await expect(main).toHaveClass(/md:ml-64/);
  });
});
