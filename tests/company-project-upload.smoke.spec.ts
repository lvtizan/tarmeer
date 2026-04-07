import path from 'node:path';
import { test, expect } from '@playwright/test';

test.describe('company project upload payload smoke', () => {
  test('company draft save sends images and tags payload fields', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;

    await page.route('**/api/auth/company/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            company_name: 'Smoke Studio',
            contact_person: 'Smoke Owner',
            phone: '+971500000000',
            description: 'Smoke test company',
            city: 'Dubai',
            services: [],
          },
        }),
      });
    });

    await page.route('**/api/auth/company/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects: [] }),
      });
    });

    await page.route('**/api/projects', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Project submitted successfully.',
          project: {
            id: 101,
            title: capturedBody?.title || 'Smoke Draft',
            images: capturedBody?.images || [],
            tags: capturedBody?.tags || [],
            status: 'draft',
          },
        }),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('token', 'company-smoke-token');
      localStorage.setItem('active_role', 'company');
      localStorage.setItem('user', JSON.stringify({
        full_name: 'Smoke Company',
        email: 'company-smoke@example.com',
      }));
    });

    await page.goto('/company/projects');
    await expect(page.getByRole('heading', { name: 'Upload New Project' })).toBeVisible();

    await page.locator('input[placeholder="Enter project title"]').fill('Smoke Company Draft');
    await page.locator('textarea[placeholder*="Briefly describe"]').fill('Smoke draft description');
    await page.locator('select[name="style"]').selectOption('modern');
    await page.locator('input[placeholder="Enter city"]').fill('Dubai');
    await page.locator('input[placeholder="e.g. 450"]').fill('180');

    const imagePath = path.join(process.cwd(), 'public/images/designers/projects/covers/cover-001.jpg');
    await page.setInputFiles('#g-up', imagePath);

    await expect(page.getByText('1 images')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Save Draft' }).click();

    await expect.poll(() => capturedBody).not.toBeNull();
    expect(Array.isArray(capturedBody?.images)).toBe(true);
    expect((capturedBody?.images as unknown[]).length).toBeGreaterThan(0);
    expect(capturedBody?.imageUrls).toBeUndefined();
    expect(capturedBody?.tags).toEqual([]);
    expect(capturedBody?.productIds).toBeUndefined();
    expect(capturedBody?.status).toBe('draft');

    await expect(page.getByText('Draft saved!')).toBeVisible();
  });
});
